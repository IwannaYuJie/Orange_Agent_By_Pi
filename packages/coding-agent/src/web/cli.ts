#!/usr/bin/env node
import { spawn } from "node:child_process";
import { APP_NAME } from "../config.ts";
import { configureHttpDispatcher } from "../core/http-dispatcher.ts";
import { createPiWebServer } from "./server.ts";

interface WebCliArgs {
	host: string;
	port: number;
	cwd: string;
	open: boolean;
	rpcArgs: string[];
	help: boolean;
}

function parseWebArgs(args: string[]): WebCliArgs {
	const parsed: WebCliArgs = {
		host: "127.0.0.1",
		port: 42173,
		cwd: process.cwd(),
		open: false,
		rpcArgs: [],
		help: false,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--help" || arg === "-h") {
			parsed.help = true;
		} else if (arg === "--host" && args[i + 1]) {
			parsed.host = args[++i];
		} else if (arg === "--port" && args[i + 1]) {
			const port = Number(args[++i]);
			if (Number.isInteger(port) && port > 0 && port <= 65535) {
				parsed.port = port;
			}
		} else if (arg === "--cwd" && args[i + 1]) {
			parsed.cwd = args[++i];
		} else if (arg === "--open") {
			parsed.open = true;
		} else if (arg === "--") {
			parsed.rpcArgs.push(...args.slice(i + 1));
			break;
		} else {
			parsed.rpcArgs.push(arg);
		}
	}

	return parsed;
}

function printHelp(): void {
	console.log(`pi-web - local browser UI for ${APP_NAME}

Usage:
  pi-web [options] [-- pi rpc options]

Options:
  --host <host>    Host to bind. Defaults to 127.0.0.1.
  --port <port>    Port to bind. Defaults to 42173.
  --cwd <dir>      Working directory for the Pi RPC agent. Defaults to current directory.
  --open           Open the local Web UI in the default browser.
  --help, -h       Show this help.

Examples:
  pi-web
  pi-web --open -- --provider anthropic --model claude-sonnet-4-20250514
`);
}

function openBrowser(url: string): void {
	const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
	const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
	const child = spawn(command, args, {
		detached: true,
		stdio: "ignore",
	});
	child.unref();
}

process.title = "pi-web";
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;
configureHttpDispatcher();

const args = parseWebArgs(process.argv.slice(2));
if (args.help) {
	printHelp();
	process.exit(0);
}

const server = createPiWebServer({
	host: args.host,
	port: args.port,
	cwd: args.cwd,
	rpcArgs: args.rpcArgs,
});

const shutdown = async () => {
	await server.stop();
	process.exit(0);
};

process.once("SIGINT", () => {
	void shutdown();
});
process.once("SIGTERM", () => {
	void shutdown();
});

server
	.start()
	.then(() => {
		console.log(`Pi Web is running at ${server.url}`);
		if (args.open) {
			openBrowser(server.url);
		}
	})
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
