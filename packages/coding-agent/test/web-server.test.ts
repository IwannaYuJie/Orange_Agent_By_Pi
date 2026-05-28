import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { getDefaultSessionDir } from "../src/core/session-manager.ts";
import type { RpcExtensionUIResponse, RpcResponse } from "../src/modes/rpc/rpc-types.ts";
import type { RpcBridgeMessage, RpcBridgeStatus, WebRpcCommand } from "../src/web/rpc-bridge.ts";
import { createPiWebServer, type WebBridge } from "../src/web/server.ts";

class FakeBridge implements WebBridge {
	cwd: string;
	currentStatus: RpcBridgeStatus = "ready";
	stderrText = "";
	commands: WebRpcCommand[] = [];
	extensionResponses: RpcExtensionUIResponse[] = [];
	startCount = 0;
	stopCount = 0;
	private listeners = new Set<(message: RpcBridgeMessage) => void>();

	constructor(cwd = process.cwd()) {
		this.cwd = cwd;
	}

	async start(): Promise<void> {
		this.startCount++;
		this.currentStatus = "ready";
	}

	async stop(): Promise<void> {
		this.stopCount++;
		this.currentStatus = "exited";
	}

	async restart(cwd: string): Promise<void> {
		await this.stop();
		this.cwd = cwd;
		await this.start();
	}

	async send(command: WebRpcCommand): Promise<RpcResponse> {
		this.commands.push(command);
		if (command.type === "get_state") {
			return {
				type: "response",
				command: "get_state",
				success: true,
				data: {
					cwd: this.cwd,
					thinkingLevel: "off",
					isStreaming: false,
					isCompacting: false,
					steeringMode: "one-at-a-time",
					followUpMode: "one-at-a-time",
					sessionId: "session-1",
					autoCompactionEnabled: true,
					messageCount: 0,
					pendingMessageCount: 0,
				},
			};
		}
		if (command.type === "get_messages") {
			return {
				type: "response",
				command: "get_messages",
				success: true,
				data: { messages: [] },
			};
		}
		if (command.type === "prompt") {
			return { type: "response", command: "prompt", success: true };
		}
		return { type: "response", command: command.type, success: true } as RpcResponse;
	}

	sendExtensionResponse(response: RpcExtensionUIResponse): void {
		this.extensionResponses.push(response);
	}

	onMessage(listener: (message: RpcBridgeMessage) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	emit(message: RpcBridgeMessage): void {
		for (const listener of this.listeners) {
			listener(message);
		}
	}
}

const handles: Array<{ stop(): Promise<void> }> = [];
const tempDirs: string[] = [];

afterEach(async () => {
	for (const handle of handles.splice(0)) {
		await handle.stop();
	}
	for (const dir of tempDirs.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function startServer(bridge: FakeBridge, options: { agentDir?: string } = {}) {
	const handle = createPiWebServer({
		host: "127.0.0.1",
		port: 0,
		cwd: process.cwd(),
		bridge,
		agentDir: options.agentDir,
	});
	await handle.start();
	handles.push(handle);
	const address = handle.server.address() as AddressInfo;
	return { handle, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function readHttpJson(url: string): Promise<unknown> {
	const response = await fetch(url);
	return response.json();
}

async function postHttpJson(url: string, body: unknown): Promise<unknown> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	return response.json();
}

function connectWebSocket(port: number): Promise<{ socket: Socket; firstMessage: unknown }> {
	return new Promise((resolve, reject) => {
		const socket = connect(port, "127.0.0.1");
		const key = randomBytes(16).toString("base64");
		let buffer = Buffer.alloc(0);
		socket.once("error", reject);
		socket.once("connect", () => {
			socket.write(
				[
					"GET /api/events HTTP/1.1",
					`Host: 127.0.0.1:${port}`,
					"Upgrade: websocket",
					"Connection: Upgrade",
					`Sec-WebSocket-Key: ${key}`,
					"Sec-WebSocket-Version: 13",
					"",
					"",
				].join("\r\n"),
			);
		});
		socket.on("data", (chunk) => {
			buffer = Buffer.concat([buffer, chunk]);
			const separator = buffer.indexOf("\r\n\r\n");
			if (separator === -1 || buffer.length <= separator + 2) {
				return;
			}
			const frame = buffer.subarray(separator + 4);
			if (frame.length < 2) {
				return;
			}
			const length = frame[1] & 0x7f;
			if (frame.length < 2 + length) {
				return;
			}
			const payload = frame.subarray(2, 2 + length).toString("utf8");
			resolve({ socket, firstMessage: JSON.parse(payload) });
		});
	});
}

describe("Pi Web server", () => {
	test("proxies state and prompt requests to the bridge", async () => {
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge);

		await expect(readHttpJson(`${baseUrl}/api/state`)).resolves.toMatchObject({
			success: true,
			data: { cwd: process.cwd(), sessionId: "session-1" },
		});

		const promptResponse = await fetch(`${baseUrl}/api/prompt`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ message: "hello" }),
		});
		await expect(promptResponse.json()).resolves.toMatchObject({ success: true, command: "prompt" });
		expect(bridge.commands.map((command) => command.type)).toEqual(["get_state", "prompt"]);
	});

	test("includes uploaded text files in prompt requests", async () => {
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge);

		await expect(
			postHttpJson(`${baseUrl}/api/prompt`, {
				message: "请总结这个文件",
				files: [{ name: 'notes"one.md', mimeType: "text/markdown", content: "# Notes\nhello" }],
			}),
		).resolves.toMatchObject({ success: true, command: "prompt" });

		expect(bridge.commands).toEqual([
			expect.objectContaining({
				type: "prompt",
				message: '<file name="notes&quot;one.md">\n# Notes\nhello\n</file>\n\n请总结这个文件',
			}),
		]);
	});

	test("includes uploaded base64 files in prompt requests", async () => {
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge);

		await expect(
			postHttpJson(`${baseUrl}/api/prompt`, {
				message: "请阅读这个 PDF",
				files: [
					{
						name: "paper.pdf",
						mimeType: "application/pdf",
						encoding: "base64",
						content: "JVBERi0xLjQK",
					},
				],
			}),
		).resolves.toMatchObject({ success: true, command: "prompt" });

		expect(bridge.commands).toEqual([
			expect.objectContaining({
				type: "prompt",
				message:
					'<file name="paper.pdf" mimeType="application/pdf" encoding="base64">\nJVBERi0xLjQK\n</file>\n\n请阅读这个 PDF',
			}),
		]);
	});

	test("accepts attachment-only prompt requests", async () => {
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge);

		await expect(
			postHttpJson(`${baseUrl}/api/prompt`, {
				message: "",
				files: [{ name: "context.txt", content: "only file content" }],
			}),
		).resolves.toMatchObject({ success: true, command: "prompt" });

		expect(bridge.commands).toEqual([
			expect.objectContaining({
				type: "prompt",
				message: '<file name="context.txt">\nonly file content\n</file>',
			}),
		]);
	});

	test("exports selected text and current messages as markdown", async () => {
		const outputDir = await mkdtemp(join(tmpdir(), "pi-web-export-"));
		tempDirs.push(outputDir);
		const bridge = new FakeBridge(outputDir);
		const { baseUrl } = await startServer(bridge);
		const outputPath = "selection.md";
		const resolvedOutputPath = join(outputDir, outputPath);

		const selected = (await postHttpJson(`${baseUrl}/api/export/markdown`, {
			selectedText: "Only this paragraph",
			outputPath,
		})) as { data: { markdown: string; bytes: number; path?: string } };

		expect(selected.data).toMatchObject({ path: resolvedOutputPath, bytes: expect.any(Number) });
		expect(selected.data.markdown).toContain("# Pi Selection Export");
		expect(selected.data.markdown).toContain("Session: session-1");
		expect(selected.data.markdown).toContain(`Cwd: ${outputDir}`);
		expect(selected.data.markdown).toContain("Only this paragraph");
		await expect(readFile(resolvedOutputPath, "utf-8")).resolves.toContain("Only this paragraph");
		expect(bridge.commands).toEqual([expect.objectContaining({ type: "get_state" })]);

		const full = (await postHttpJson(`${baseUrl}/api/export/markdown`, {})) as {
			data: { markdown: string; bytes: number };
		};

		expect(full.data.markdown).toContain("# Pi Session Export");
		expect(full.data.markdown).toContain("_No messages in this session._");
		expect(bridge.commands).toEqual([
			expect.objectContaining({ type: "get_state" }),
			expect.objectContaining({ type: "get_messages" }),
		]);
	});

	test("rejects markdown export output paths outside cwd", async () => {
		const outputDir = await mkdtemp(join(tmpdir(), "pi-web-export-boundary-"));
		tempDirs.push(outputDir);
		const bridge = new FakeBridge(outputDir);
		const { baseUrl } = await startServer(bridge);

		await expect(
			postHttpJson(`${baseUrl}/api/export/markdown`, {
				selectedText: "outside",
				outputPath: "../outside.md",
			}),
		).resolves.toMatchObject({
			success: false,
			error: expect.stringContaining("within the current cwd"),
		});

		await expect(
			postHttpJson(`${baseUrl}/api/export/markdown`, {
				selectedText: "absolute",
				outputPath: join(tmpdir(), "absolute.md"),
			}),
		).resolves.toMatchObject({
			success: false,
			error: expect.stringContaining("relative to the current cwd"),
		});
	});

	test("proxies bash abort requests to RPC", async () => {
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge);

		await expect(postHttpJson(`${baseUrl}/api/bash/abort`, {})).resolves.toMatchObject({
			success: true,
			command: "abort_bash",
		});
		expect(bridge.commands).toEqual([expect.objectContaining({ type: "abort_bash" })]);
	});

	test("changes the working directory by restarting the bridge", async () => {
		const nextCwd = await mkdtemp(join(tmpdir(), "pi-web-cwd-"));
		tempDirs.push(nextCwd);
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge);

		await expect(postHttpJson(`${baseUrl}/api/cwd`, { cwd: nextCwd })).resolves.toMatchObject({
			success: true,
			data: { cwd: nextCwd },
		});
		expect(bridge.cwd).toBe(nextCwd);
		expect(bridge.startCount).toBe(2);
		expect(bridge.stopCount).toBe(1);
		await expect(readHttpJson(`${baseUrl}/api/state`)).resolves.toMatchObject({
			success: true,
			data: { cwd: nextCwd },
		});
	});

	test("rejects missing working directories", async () => {
		const missingParent = await mkdtemp(join(tmpdir(), "pi-web-missing-cwd-"));
		tempDirs.push(missingParent);
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge);

		await expect(postHttpJson(`${baseUrl}/api/cwd`, { cwd: join(missingParent, "missing") })).resolves.toMatchObject({
			success: false,
			error: expect.stringContaining("working directory does not exist"),
		});
		expect(bridge.cwd).toBe(process.cwd());
		expect(bridge.stopCount).toBe(0);
	});

	test("lists directories for the working-directory picker", async () => {
		const root = await mkdtemp(join(tmpdir(), "pi-web-cwd-list-"));
		tempDirs.push(root);
		await mkdir(join(root, "project-a"));
		await mkdir(join(root, "project-b"));
		const bridge = new FakeBridge(root);
		const { baseUrl } = await startServer(bridge);

		await expect(readHttpJson(`${baseUrl}/api/cwd?path=${encodeURIComponent(root)}`)).resolves.toMatchObject({
			success: true,
			data: {
				cwd: root,
				path: root,
				entries: [{ name: "project-a", path: join(root, "project-a") }, { name: "project-b" }],
			},
		});
	});

	test("cancels extension confirmations when no browser is connected", async () => {
		const bridge = new FakeBridge();
		await startServer(bridge);

		bridge.emit({
			type: "rpc_message",
			message: {
				type: "extension_ui_request",
				id: "confirm-1",
				method: "confirm",
				title: "Confirm",
				message: "rm -rf",
			},
		});

		expect(bridge.extensionResponses).toEqual([{ type: "extension_ui_response", id: "confirm-1", cancelled: true }]);
	});

	test("accepts websocket clients for event streaming", async () => {
		const bridge = new FakeBridge();
		const { handle } = await startServer(bridge);
		const address = handle.server.address() as AddressInfo;

		const { socket, firstMessage } = await connectWebSocket(address.port);
		socket.destroy();

		expect(firstMessage).toMatchObject({ type: "web_status", status: "connected", rpcStatus: "ready" });
	});

	test("stores provider API keys in the configured auth file", async () => {
		const agentDir = await mkdtemp(join(tmpdir(), "pi-web-auth-"));
		tempDirs.push(agentDir);
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge, { agentDir });

		await expect(
			postHttpJson(`${baseUrl}/api/auth/key`, { provider: "openai", apiKey: "OPENAI_API_KEY" }),
		).resolves.toMatchObject({ success: true, data: { provider: "openai" } });

		const authJson = JSON.parse(await readFile(join(agentDir, "auth.json"), "utf-8")) as Record<string, unknown>;
		expect(authJson).toMatchObject({ openai: { type: "api_key", key: "OPENAI_API_KEY" } });
	});

	test("writes custom models to the configured models file", async () => {
		const agentDir = await mkdtemp(join(tmpdir(), "pi-web-models-"));
		tempDirs.push(agentDir);
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge, { agentDir });

		await expect(
			postHttpJson(`${baseUrl}/api/custom-models`, {
				provider: "ollama",
				modelId: "qwen2.5-coder:7b",
				api: "openai-completions",
				baseUrl: "http://localhost:11434/v1",
				apiKey: "ollama",
				localCompat: true,
			}),
		).resolves.toMatchObject({
			success: true,
			data: { provider: "ollama", modelId: "qwen2.5-coder:7b" },
		});

		const modelsJson = JSON.parse(await readFile(join(agentDir, "models.json"), "utf-8")) as {
			providers: Record<string, { models: Array<{ id: string }> }>;
		};
		expect(modelsJson.providers.ollama.models).toEqual([expect.objectContaining({ id: "qwen2.5-coder:7b" })]);
	});

	test("creates skills and lists them through the resources API", async () => {
		const agentDir = await mkdtemp(join(tmpdir(), "pi-web-resources-"));
		tempDirs.push(agentDir);
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge, { agentDir });

		await expect(
			postHttpJson(`${baseUrl}/api/resources/skill`, {
				name: "code-review",
				description: "Review code changes for bugs and missing tests.",
				instructions: "Read the diff and report findings first.",
			}),
		).resolves.toMatchObject({ success: true, data: { name: "code-review", scope: "user" } });

		const skillPath = join(agentDir, "skills", "code-review", "SKILL.md");
		await expect(readFile(skillPath, "utf-8")).resolves.toContain("name: code-review");
		const resources = (await readHttpJson(`${baseUrl}/api/resources`)) as {
			data: { resources: { skills: Array<{ name?: string; enabled: boolean }> } };
		};
		expect(resources.data.resources.skills).toContainEqual(
			expect.objectContaining({ name: "code-review", enabled: true }),
		);
	});

	test("resource enable toggles replace bare path entries", async () => {
		const agentDir = await mkdtemp(join(tmpdir(), "pi-web-resource-toggle-"));
		const skillDir = await mkdtemp(join(tmpdir(), "pi-web-skill-dir-"));
		tempDirs.push(agentDir, skillDir);
		const bridge = new FakeBridge();
		const { baseUrl } = await startServer(bridge, { agentDir });

		await expect(
			postHttpJson(`${baseUrl}/api/resources/path`, {
				type: "skills",
				path: skillDir,
				scope: "user",
			}),
		).resolves.toMatchObject({ success: true });

		await expect(
			postHttpJson(`${baseUrl}/api/resources/enabled`, {
				type: "skills",
				path: skillDir,
				scope: "user",
				enabled: false,
			}),
		).resolves.toMatchObject({ success: true });

		const settings = JSON.parse(await readFile(join(agentDir, "settings.json"), "utf-8")) as {
			skills?: string[];
		};
		expect(settings.skills).toEqual([`-${skillDir}`]);
	});

	test("lists saved sessions for the current working directory", async () => {
		const agentDir = await mkdtemp(join(tmpdir(), "pi-web-sessions-"));
		const projectDir = await mkdtemp(join(tmpdir(), "pi-web-project-"));
		tempDirs.push(agentDir, projectDir);
		const bridge = new FakeBridge(projectDir);
		const sessionDir = getDefaultSessionDir(projectDir, agentDir);
		await mkdir(sessionDir, { recursive: true });
		const sessionPath = join(sessionDir, "session-one.jsonl");
		await writeFile(
			sessionPath,
			[
				JSON.stringify({
					type: "session",
					version: 3,
					id: "session-one",
					cwd: projectDir,
					timestamp: "2026-05-27T01:00:00.000Z",
				}),
				JSON.stringify({
					type: "model_change",
					id: "model-1",
					parentId: null,
					timestamp: "2026-05-27T01:01:00.000Z",
					provider: "anthropic",
					modelId: "claude-sonnet-4",
				}),
				JSON.stringify({
					type: "message",
					id: "msg-1",
					parentId: "model-1",
					timestamp: "2026-05-27T01:02:00.000Z",
					message: { role: "user", content: "continue tomorrow", timestamp: 1779843720000 },
				}),
			].join("\n"),
			"utf-8",
		);
		const { baseUrl } = await startServer(bridge, { agentDir });

		await expect(readHttpJson(`${baseUrl}/api/sessions/list`)).resolves.toMatchObject({
			success: true,
			data: {
				cwd: projectDir,
				sessions: [
					{
						path: sessionPath,
						id: "session-one",
						cwd: projectDir,
						messageCount: 1,
						firstMessage: "continue tomorrow",
						lastModel: { provider: "anthropic", modelId: "claude-sonnet-4" },
					},
				],
			},
		});
	});
});
