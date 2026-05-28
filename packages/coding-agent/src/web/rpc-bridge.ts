import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attachJsonlLineReader, serializeJsonLine } from "../modes/rpc/jsonl.ts";
import type { RpcCommand, RpcExtensionUIResponse, RpcResponse } from "../modes/rpc/rpc-types.ts";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type WebRpcCommand = DistributiveOmit<RpcCommand, "id">;

export type RpcBridgeStatus = "idle" | "starting" | "ready" | "exited";

export type RpcBridgeMessage =
	| { type: "bridge_status"; status: RpcBridgeStatus; detail?: string }
	| { type: "bridge_stderr"; text: string }
	| { type: "bridge_error"; error: string }
	| { type: "rpc_message"; message: unknown };

export interface RpcBridgeOptions {
	cwd: string;
	cliPath?: string;
	extraArgs?: string[];
	env?: NodeJS.ProcessEnv;
	permissionExtensionPath?: string;
}

interface PendingRequest {
	command: string;
	resolve: (response: RpcResponse) => void;
	reject: (error: Error) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

interface RpcProcessCommand {
	command: string;
	args: string[];
}

function getDefaultCliPath(): string {
	const currentFile = fileURLToPath(import.meta.url);
	const dir = dirname(currentFile);
	return currentFile.endsWith(".ts") ? resolve(dir, "../cli.ts") : resolve(dir, "../cli.js");
}

function createRpcProcessCommand(cliPath: string, extraArgs: string[]): RpcProcessCommand {
	if (!cliPath.endsWith(".ts")) {
		return { command: process.execPath, args: [cliPath, ...extraArgs] };
	}

	const currentFile = fileURLToPath(import.meta.url);
	const repoRoot = resolve(dirname(currentFile), "../../../..");
	const tsxPath = resolve(repoRoot, "node_modules/.bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
	if (!existsSync(tsxPath)) {
		return { command: process.execPath, args: [cliPath, ...extraArgs] };
	}

	return {
		command: tsxPath,
		args: ["--tsconfig", resolve(repoRoot, "tsconfig.json"), cliPath, ...extraArgs],
	};
}

export function getBundledPermissionExtensionPath(): string {
	const currentFile = fileURLToPath(import.meta.url);
	const dir = dirname(currentFile);
	return currentFile.endsWith(".ts")
		? resolve(dir, "extensions/web-permission-gate.ts")
		: resolve(dir, "extensions/web-permission-gate.js");
}

export class RpcBridge {
	private options: RpcBridgeOptions;
	private child: ChildProcessWithoutNullStreams | undefined;
	private status: RpcBridgeStatus = "idle";
	private nextRequestId = 1;
	private pendingRequests = new Map<string, PendingRequest>();
	private listeners = new Set<(message: RpcBridgeMessage) => void>();
	private detachStdout: (() => void) | undefined;
	private stderr = "";

	constructor(options: RpcBridgeOptions) {
		this.options = options;
	}

	get currentStatus(): RpcBridgeStatus {
		return this.status;
	}

	get cwd(): string {
		return this.options.cwd;
	}

	get stderrText(): string {
		return this.stderr;
	}

	onMessage(listener: (message: RpcBridgeMessage) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async start(): Promise<void> {
		if (this.child) {
			return;
		}

		this.setStatus("starting");
		const cliPath = this.options.cliPath ?? getDefaultCliPath();
		const args = ["--mode", "rpc"];
		const permissionExtensionPath = this.options.permissionExtensionPath ?? getBundledPermissionExtensionPath();
		if (permissionExtensionPath) {
			args.push("--extension", permissionExtensionPath);
		}
		if (this.options.extraArgs) {
			args.push(...this.options.extraArgs);
		}

		const rpcProcess = createRpcProcessCommand(cliPath, args);
		const child = spawn(rpcProcess.command, rpcProcess.args, {
			cwd: this.options.cwd,
			env: { ...process.env, ...this.options.env },
			stdio: ["pipe", "pipe", "pipe"],
		});
		this.child = child;

		this.detachStdout = attachJsonlLineReader(child.stdout, (line) => this.handleLine(line));
		child.stderr.on("data", (chunk: Buffer) => {
			const text = chunk.toString("utf8");
			this.stderr += text;
			this.emit({ type: "bridge_stderr", text });
		});
		child.once("error", (error) => {
			this.rejectAll(new Error(`RPC process error: ${error.message}`));
			this.emit({ type: "bridge_error", error: error.message });
			this.setStatus("exited", error.message);
			this.child = undefined;
		});
		child.once("exit", (code, signal) => {
			const detail = `RPC process exited (code=${code} signal=${signal})`;
			this.rejectAll(new Error(detail));
			this.detachStdout?.();
			this.detachStdout = undefined;
			this.setStatus("exited", detail);
			this.child = undefined;
		});

		await new Promise((resolve) => setTimeout(resolve, 100));
		if (child.exitCode !== null) {
			throw new Error(`RPC process exited during startup. ${this.stderr}`);
		}
		this.setStatus("ready");
	}

	async stop(): Promise<void> {
		const child = this.child;
		if (!child) {
			return;
		}

		this.detachStdout?.();
		this.detachStdout = undefined;
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				child.kill("SIGKILL");
				resolve();
			}, 1000);
			child.once("exit", () => {
				clearTimeout(timeout);
				resolve();
			});
		});
		this.child = undefined;
		this.setStatus("exited");
	}

	async restart(cwd: string): Promise<void> {
		await this.stop();
		this.options = { ...this.options, cwd };
		this.stderr = "";
		await this.start();
	}

	async send(command: WebRpcCommand): Promise<RpcResponse> {
		const child = this.child;
		if (!child || !child.stdin.writable) {
			throw new Error("RPC process is not running");
		}

		const id = `web-${this.nextRequestId++}`;
		const commandName = isRecord(command) && typeof command.type === "string" ? command.type : "unknown";
		const payload = { ...command, id };
		return new Promise<RpcResponse>((resolve, reject) => {
			this.pendingRequests.set(id, { command: commandName, resolve, reject });
			child.stdin.write(serializeJsonLine(payload), (error) => {
				if (!error) {
					return;
				}
				this.pendingRequests.delete(id);
				reject(error);
			});
		});
	}

	sendExtensionResponse(response: RpcExtensionUIResponse): void {
		const child = this.child;
		if (!child || !child.stdin.writable) {
			return;
		}
		child.stdin.write(serializeJsonLine(response));
	}

	private handleLine(line: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch (error) {
			this.emit({
				type: "bridge_error",
				error: `Failed to parse RPC output: ${error instanceof Error ? error.message : String(error)}`,
			});
			return;
		}

		if (isRecord(parsed) && parsed.type === "response" && typeof parsed.id === "string") {
			const pending = this.pendingRequests.get(parsed.id);
			if (pending) {
				this.pendingRequests.delete(parsed.id);
				pending.resolve(parsed as RpcResponse);
				return;
			}
		}

		this.emit({ type: "rpc_message", message: parsed });
	}

	private setStatus(status: RpcBridgeStatus, detail?: string): void {
		this.status = status;
		this.emit({ type: "bridge_status", status, detail });
	}

	private rejectAll(error: Error): void {
		for (const pending of this.pendingRequests.values()) {
			pending.reject(error);
		}
		this.pendingRequests.clear();
	}

	private emit(message: RpcBridgeMessage): void {
		for (const listener of this.listeners) {
			listener(message);
		}
	}
}
