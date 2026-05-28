import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ImageContent, OAuthProviderId, OAuthSelectPrompt } from "@earendil-works/pi-ai";
import { getOAuthProviders } from "@earendil-works/pi-ai/oauth";
import { AuthStorage } from "../core/auth-storage.ts";
import { getDefaultSessionDir, type SessionInfo, SessionManager } from "../core/session-manager.ts";
import { SettingsManager } from "../core/settings-manager.ts";
import type { RpcExtensionUIResponse, RpcResponse } from "../modes/rpc/rpc-types.ts";
import {
	type CustomModelInput,
	getAuthOverview,
	getCustomModelsOverview,
	getWebAuthPath,
	removeProviderAuth,
	setProviderApiKey,
	upsertCustomModel,
	type WebConfigPaths,
} from "./model-auth-config.ts";
import {
	addResourcePath,
	createSkill,
	getResourceOverview,
	installPackage,
	type ResourceConfigPaths,
	type ResourceScope,
	type ResourceType,
	readResourceFile,
	removePackage,
	removeResourcePath,
	setResourceEnabled,
} from "./resource-manager.ts";
import { RpcBridge, type RpcBridgeMessage, type RpcBridgeStatus, type WebRpcCommand } from "./rpc-bridge.ts";
import { acceptWebSocket, isWebSocketUpgrade, type WebSocketConnection } from "./websocket.ts";

export interface WebBridge {
	readonly cwd: string;
	readonly currentStatus: RpcBridgeStatus;
	readonly stderrText: string;
	start(): Promise<void>;
	stop(): Promise<void>;
	restart(cwd: string): Promise<void>;
	send(command: WebRpcCommand): Promise<RpcResponse>;
	sendExtensionResponse(response: RpcExtensionUIResponse): void;
	onMessage(listener: (message: RpcBridgeMessage) => void): () => void;
}

export interface PiWebServerOptions {
	host: string;
	port: number;
	cwd: string;
	agentDir?: string;
	publicDir?: string;
	bridge?: WebBridge;
	rpcCliPath?: string;
	rpcArgs?: string[];
}

export interface PiWebServerHandle {
	readonly url: string;
	readonly server: Server;
	start(): Promise<void>;
	stop(): Promise<void>;
}

interface JsonObject {
	[key: string]: unknown;
}

interface CwdEntry {
	name: string;
	path: string;
}

interface CwdListing {
	cwd: string;
	path: string;
	parent?: string;
	home: string;
	entries: CwdEntry[];
}

interface PromptFileAttachment {
	name: string;
	mimeType?: string;
	content: string;
	encoding?: "text" | "base64";
}

interface WebSessionListItem {
	path: string;
	id: string;
	cwd: string;
	name?: string;
	parentSessionPath?: string;
	created: string;
	modified: string;
	messageCount: number;
	firstMessage: string;
	lastModel?: { provider: string; modelId: string };
}

const CONTENT_TYPES: Record<string, string> = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
};

const RESOURCE_TYPES = new Set<ResourceType>(["extensions", "skills", "prompts", "themes"]);

function defaultPublicDir(): string {
	return fileURLToPath(new URL("./public", import.meta.url));
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function thinkingLevelValue(value: unknown): ThinkingLevel | undefined {
	if (
		value === "off" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	return undefined;
}

function imageArrayValue(value: unknown): ImageContent[] | undefined {
	return Array.isArray(value) ? (value as ImageContent[]) : undefined;
}

function promptFileEncodingValue(value: unknown): PromptFileAttachment["encoding"] | undefined {
	return value === "text" || value === "base64" ? value : undefined;
}

function promptFileArrayValue(value: unknown): PromptFileAttachment[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const files: PromptFileAttachment[] = [];
	for (const item of value) {
		if (!isRecord(item)) {
			continue;
		}
		const name = textValue(item.name);
		const content = textValue(item.content);
		if (!name || content === undefined) {
			continue;
		}
		files.push({
			name,
			mimeType: textValue(item.mimeType),
			content,
			encoding: promptFileEncodingValue(item.encoding),
		});
	}
	return files;
}

function escapeAttributeValue(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function promptFileAttributes(file: PromptFileAttachment): string {
	const attributes = [`name="${escapeAttributeValue(file.name)}"`];
	if (file.encoding === "base64" && file.mimeType) {
		attributes.push(`mimeType="${escapeAttributeValue(file.mimeType)}"`);
	}
	if (file.encoding === "base64") {
		attributes.push('encoding="base64"');
	}
	return attributes.join(" ");
}

function promptMessageWithFiles(message: string, files: PromptFileAttachment[]): string {
	if (files.length === 0) {
		return message;
	}
	const fileText = files.map((file) => `<file ${promptFileAttributes(file)}>\n${file.content}\n</file>`).join("\n");
	if (!message.trim()) {
		return fileText;
	}
	return `${fileText}\n\n${message}`;
}

function markdownFence(value: string, language = ""): string {
	const backtickRuns = value.match(/`+/g) ?? [];
	const longestRun = backtickRuns.reduce((max, run) => Math.max(max, run.length), 0);
	const fence = "`".repeat(Math.max(3, longestRun + 1));
	const body = value.endsWith("\n") ? value : `${value}\n`;
	return `${fence}${language}\n${body}${fence}`;
}

function contentBlockToMarkdown(block: unknown): string {
	if (!isRecord(block)) {
		return "";
	}
	if (block.type === "text") {
		return textValue(block.text) ?? "";
	}
	if (block.type === "image") {
		return `[image: ${textValue(block.mimeType) ?? "unknown"}]`;
	}
	if (block.type === "thinking") {
		const thinking = textValue(block.thinking)?.trim();
		if (!thinking) {
			return "<details><summary>Thinking</summary>\n\n_Redacted or encrypted reasoning._\n\n</details>";
		}
		return `<details><summary>Thinking</summary>\n\n${thinking}\n\n</details>`;
	}
	if (block.type === "toolCall") {
		const name = textValue(block.name) ?? "tool";
		const args = JSON.stringify(block.arguments ?? {}, null, 2);
		return `**Tool call:** \`${name}\`\n\n${markdownFence(args, "json")}`;
	}
	return "";
}

function contentToMarkdown(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return "";
	}
	return content.map(contentBlockToMarkdown).filter(Boolean).join("\n\n");
}

function messageTimestampSuffix(message: JsonObject): string {
	const timestamp = numberValue(message.timestamp);
	return timestamp === undefined ? "" : ` · ${new Date(timestamp).toISOString()}`;
}

function messageToMarkdown(message: unknown): string {
	if (!isRecord(message)) {
		return "";
	}
	const role = textValue(message.role);
	if (role === "user") {
		return `## User${messageTimestampSuffix(message)}\n\n${contentToMarkdown(message.content)}`;
	}
	if (role === "assistant") {
		const provider = textValue(message.provider);
		const model = textValue(message.model);
		const modelLabel = provider && model ? ` (${provider}/${model})` : "";
		return `## Assistant${modelLabel}${messageTimestampSuffix(message)}\n\n${contentToMarkdown(message.content)}`;
	}
	if (role === "toolResult") {
		const name = textValue(message.toolName) ?? "tool";
		const errorLabel = message.isError === true ? " (error)" : "";
		return `## Tool Result: ${name}${errorLabel}${messageTimestampSuffix(message)}\n\n${contentToMarkdown(message.content)}`;
	}
	return `## Message${messageTimestampSuffix(message)}\n\n${markdownFence(JSON.stringify(message, null, 2), "json")}`;
}

function messagesToMarkdown(messages: unknown[]): string {
	const renderedMessages = messages.map(messageToMarkdown).filter(Boolean);
	const body = renderedMessages.length > 0 ? renderedMessages.join("\n\n") : "_No messages in this session._";
	return `# Pi Session Export\n\nExported at ${new Date().toISOString()}.\n\n${body}\n`;
}

function selectedTextToMarkdown(
	selectedText: string,
	context?: { sessionId?: string; sessionFile?: string; cwd?: string },
): string {
	const metadata = [
		context?.sessionId ? `Session: ${context.sessionId}` : undefined,
		context?.sessionFile ? `Session file: ${context.sessionFile}` : undefined,
		context?.cwd ? `Cwd: ${context.cwd}` : undefined,
	]
		.filter(Boolean)
		.join("\n");
	return `# Pi Selection Export\n\nExported at ${new Date().toISOString()}.${
		metadata ? `\n\n${metadata}` : ""
	}\n\n${selectedText.trim()}\n`;
}

function streamingBehaviorValue(value: unknown): "steer" | "followUp" | undefined {
	return value === "steer" || value === "followUp" ? value : undefined;
}

function resourceTypeValue(value: unknown): ResourceType | undefined {
	return typeof value === "string" && RESOURCE_TYPES.has(value as ResourceType) ? (value as ResourceType) : undefined;
}

function resourceScopeValue(value: unknown): ResourceScope | undefined {
	return value === "project" || value === "user" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function expandCwdInput(cwd: string, currentCwd: string): string {
	const trimmed = cwd.trim();
	if (trimmed === "~") {
		return homedir();
	}
	if (trimmed.startsWith("~/")) {
		return join(homedir(), trimmed.slice(2));
	}
	return resolve(currentCwd, trimmed);
}

function isExtensionUiRequest(
	message: unknown,
): message is { type: "extension_ui_request"; id: string; method: string } {
	return (
		isRecord(message) &&
		message.type === "extension_ui_request" &&
		typeof message.id === "string" &&
		typeof message.method === "string"
	);
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
	response.writeHead(statusCode, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
	});
	response.end(JSON.stringify(payload));
}

function sendText(response: ServerResponse, statusCode: number, text: string): void {
	response.writeHead(statusCode, {
		"content-type": "text/plain; charset=utf-8",
		"cache-control": "no-store",
	});
	response.end(text);
}

async function readJsonBody(request: IncomingMessage): Promise<JsonObject> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of request) {
		const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
		size += buffer.length;
		if (size > 12 * 1024 * 1024) {
			throw new Error("Request body is too large");
		}
		chunks.push(buffer);
	}
	if (chunks.length === 0) {
		return {};
	}
	const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
	if (!isRecord(parsed)) {
		throw new Error("JSON body must be an object");
	}
	return parsed;
}

function rpcHttpPayload(response: RpcResponse): { status: number; payload: unknown } {
	if (!response.success) {
		return { status: 400, payload: response };
	}
	return { status: 200, payload: response };
}

async function serveStatic(publicDir: string, pathname: string, response: ServerResponse): Promise<void> {
	const requested = pathname === "/" ? "/index.html" : pathname;
	const normalized = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
	const absolutePath = join(publicDir, normalized);
	const relativePath = relative(publicDir, absolutePath);
	if (relativePath.startsWith("..")) {
		sendText(response, 403, "Forbidden");
		return;
	}

	try {
		const contents = await readFile(absolutePath);
		response.writeHead(200, {
			"content-type": CONTENT_TYPES[extname(absolutePath)] ?? "application/octet-stream",
			"cache-control": "no-store",
		});
		response.end(contents);
	} catch {
		sendText(response, 404, "Not found");
	}
}

export function createPiWebServer(options: PiWebServerOptions): PiWebServerHandle {
	const bridge =
		options.bridge ??
		new RpcBridge({
			cwd: options.cwd,
			cliPath: options.rpcCliPath,
			extraArgs: options.rpcArgs,
		});
	const publicDir = options.publicDir ?? defaultPublicDir();
	const configPaths: WebConfigPaths = { agentDir: options.agentDir };
	const resourcePaths: ResourceConfigPaths = { cwd: bridge.cwd, agentDir: options.agentDir };
	const sockets = new Set<WebSocketConnection>();
	const broadcast = (value: unknown) => {
		for (const socket of sockets) {
			socket.sendJson(value);
		}
	};
	const oauthJobs = new Map<string, OAuthJob>();

	const unsubscribeBridge = bridge.onMessage((message) => {
		broadcast(message);
		if (message.type !== "rpc_message" || !isExtensionUiRequest(message.message)) {
			return;
		}
		if (sockets.size === 0 && (message.message.method === "confirm" || message.message.method === "select")) {
			bridge.sendExtensionResponse({ type: "extension_ui_response", id: message.message.id, cancelled: true });
		}
	});

	const server = createServer((request, response) => {
		void handleRequest(request, response).catch((error: unknown) => {
			sendJson(response, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
		});
	});

	server.on("upgrade", (request, socket) => {
		const url = new URL(request.url ?? "/", `http://${options.host}:${options.port}`);
		if (!isWebSocketUpgrade(request) || url.pathname !== "/api/events") {
			socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
			return;
		}

		const role = sockets.size === 0 ? "owner" : "observer";
		const ws = acceptWebSocket(request, socket as Socket);
		sockets.add(ws);
		ws.onClose(() => sockets.delete(ws));
		ws.onMessage((message) => {
			let parsed: unknown;
			try {
				parsed = JSON.parse(message);
			} catch {
				return;
			}
			if (!isRecord(parsed) || parsed.type !== "extension_ui_response" || typeof parsed.id !== "string") {
				return;
			}
			if ("cancelled" in parsed) {
				bridge.sendExtensionResponse({ type: "extension_ui_response", id: parsed.id, cancelled: true });
			} else if (typeof parsed.confirmed === "boolean") {
				bridge.sendExtensionResponse({
					type: "extension_ui_response",
					id: parsed.id,
					confirmed: parsed.confirmed,
				});
			} else if (typeof parsed.value === "string") {
				bridge.sendExtensionResponse({ type: "extension_ui_response", id: parsed.id, value: parsed.value });
			}
		});
		ws.sendJson({ type: "web_status", status: "connected", rpcStatus: bridge.currentStatus, role });
	});

	async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
		const url = new URL(request.url ?? "/", `http://${options.host}:${options.port}`);
		if (!url.pathname.startsWith("/api/")) {
			await serveStatic(publicDir, url.pathname, response);
			return;
		}

		if (url.pathname === "/api/health" && request.method === "GET") {
			sendJson(response, 200, { status: "ok", rpcStatus: bridge.currentStatus });
			return;
		}

		if (request.method === "GET") {
			await handleGetApi(url, response);
			return;
		}
		if (request.method === "POST") {
			const body = await readJsonBody(request);
			await handlePostApi(url.pathname, body, response);
			return;
		}
		sendText(response, 405, "Method not allowed");
	}

	async function sendRpc(response: ServerResponse, command: WebRpcCommand): Promise<void> {
		const rpcResponse = await bridge.send(command);
		const { status, payload } = rpcHttpPayload(rpcResponse);
		sendJson(response, status, payload);
	}

	async function mutateResourceAndReload(response: ServerResponse, mutation: () => Promise<unknown>): Promise<void> {
		const data = await mutation();
		const reloadResponse = await bridge.send({ type: "reload_resources" });
		if (!reloadResponse.success) {
			sendJson(response, 500, {
				success: false,
				error: `Resource change was saved, but reload failed: ${reloadResponse.error}`,
				data,
			});
			return;
		}
		sendJson(response, 200, { success: true, data });
	}

	async function sendMarkdownExport(response: ServerResponse, markdown: string, outputPath?: string): Promise<void> {
		const data: { markdown: string; bytes: number; path?: string } = {
			markdown,
			bytes: Buffer.byteLength(markdown, "utf8"),
		};
		if (outputPath) {
			if (isAbsolute(outputPath)) {
				sendJson(response, 400, { success: false, error: "outputPath must be relative to the current cwd" });
				return;
			}
			const resolvedPath = resolve(bridge.cwd, outputPath);
			const relativePath = relative(bridge.cwd, resolvedPath);
			if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
				sendJson(response, 400, { success: false, error: "outputPath must stay within the current cwd" });
				return;
			}
			await writeFile(resolvedPath, markdown, "utf-8");
			data.path = resolvedPath;
		}
		sendJson(response, 200, { success: true, data });
	}

	async function sendState(response: ServerResponse): Promise<void> {
		const rpcResponse = await bridge.send({ type: "get_state" });
		if (rpcResponse.success && rpcResponse.command === "get_state") {
			sendJson(response, 200, { ...rpcResponse, data: { ...rpcResponse.data, cwd: bridge.cwd } });
			return;
		}
		const { status, payload } = rpcHttpPayload(rpcResponse);
		sendJson(response, status, payload);
	}

	async function changeCwd(cwd: string, response: ServerResponse): Promise<void> {
		const nextCwd = expandCwdInput(cwd, bridge.cwd);
		const stats = await stat(nextCwd).catch(() => undefined);
		if (!stats?.isDirectory()) {
			sendJson(response, 400, { success: false, error: `working directory does not exist: ${nextCwd}` });
			return;
		}

		if (nextCwd !== bridge.cwd) {
			await bridge.restart(nextCwd);
			resourcePaths.cwd = nextCwd;
		}
		sendJson(response, 200, { success: true, data: { cwd: bridge.cwd } });
	}

	async function listCwd(path: string | null): Promise<CwdListing> {
		const targetPath = path ? expandCwdInput(path, bridge.cwd) : bridge.cwd;
		const stats = await stat(targetPath).catch(() => undefined);
		if (!stats?.isDirectory()) {
			throw new Error(`working directory does not exist: ${targetPath}`);
		}

		const dirents = await readdir(targetPath, { withFileTypes: true });
		const entries = dirents
			.filter((entry) => entry.isDirectory())
			.map((entry) => ({ name: entry.name, path: join(targetPath, entry.name) }))
			.sort((left, right) => left.name.localeCompare(right.name));
		const parent = dirname(targetPath);
		return {
			cwd: bridge.cwd,
			path: targetPath,
			parent: parent === targetPath ? undefined : parent,
			home: homedir(),
			entries,
		};
	}

	function serializeSessionInfo(info: SessionInfo): WebSessionListItem {
		return {
			path: info.path,
			id: info.id,
			cwd: info.cwd,
			name: info.name,
			parentSessionPath: info.parentSessionPath,
			created: info.created.toISOString(),
			modified: info.modified.toISOString(),
			messageCount: info.messageCount,
			firstMessage: info.firstMessage,
			lastModel: info.lastModel,
		};
	}

	async function listSessions(cwd: string | null): Promise<{ cwd: string; sessions: WebSessionListItem[] }> {
		const targetCwd = cwd ? expandCwdInput(cwd, bridge.cwd) : bridge.cwd;
		const settingsManager = SettingsManager.create(targetCwd, options.agentDir);
		const sessionDir = settingsManager.getSessionDir() ?? getDefaultSessionDir(targetCwd, options.agentDir);
		const sessions = await SessionManager.list(targetCwd, sessionDir);
		return { cwd: targetCwd, sessions: sessions.map(serializeSessionInfo) };
	}

	async function handleGetApi(url: URL, response: ServerResponse): Promise<void> {
		const pathname = url.pathname;
		if (pathname === "/api/state") {
			await sendState(response);
			return;
		}
		if (pathname === "/api/cwd") {
			try {
				sendJson(response, 200, { success: true, data: await listCwd(url.searchParams.get("path")) });
			} catch (error) {
				sendJson(response, 400, { success: false, error: error instanceof Error ? error.message : String(error) });
			}
			return;
		}
		if (pathname === "/api/auth") {
			sendJson(response, 200, { success: true, data: await getAuthOverview(configPaths) });
			return;
		}
		if (pathname === "/api/custom-models") {
			sendJson(response, 200, { success: true, data: await getCustomModelsOverview(configPaths) });
			return;
		}
		if (pathname === "/api/resources") {
			sendJson(response, 200, { success: true, data: await getResourceOverview(resourcePaths) });
			return;
		}
		if (pathname === "/api/models") {
			await sendRpc(response, { type: "get_available_models" });
			return;
		}
		if (pathname === "/api/messages") {
			await sendRpc(response, { type: "get_messages" });
			return;
		}
		if (pathname === "/api/commands") {
			await sendRpc(response, { type: "get_commands" });
			return;
		}
		if (pathname === "/api/session/fork-messages") {
			await sendRpc(response, { type: "get_fork_messages" });
			return;
		}
		if (pathname === "/api/sessions/list") {
			sendJson(response, 200, { success: true, data: await listSessions(url.searchParams.get("cwd")) });
			return;
		}
		if (pathname === "/api/session/stats") {
			await sendRpc(response, { type: "get_session_stats" });
			return;
		}
		sendText(response, 404, "Not found");
	}

	async function handlePostApi(pathname: string, body: JsonObject, response: ServerResponse): Promise<void> {
		if (pathname === "/api/prompt") {
			const message = textValue(body.message) ?? "";
			const images = imageArrayValue(body.images);
			const files = promptFileArrayValue(body.files);
			if (!message.trim() && files.length === 0 && (!images || images.length === 0)) {
				sendJson(response, 400, { success: false, error: "message or attachments are required" });
				return;
			}
			await sendRpc(response, {
				type: "prompt",
				message: promptMessageWithFiles(message, files),
				images,
				streamingBehavior: streamingBehaviorValue(body.streamingBehavior),
			});
			return;
		}
		if (pathname === "/api/abort") {
			await sendRpc(response, { type: "abort" });
			return;
		}
		if (pathname === "/api/cwd") {
			const cwd = textValue(body.cwd);
			if (!cwd) {
				sendJson(response, 400, { success: false, error: "cwd is required" });
				return;
			}
			await changeCwd(cwd, response);
			return;
		}
		if (pathname === "/api/auth/key") {
			const provider = textValue(body.provider);
			const apiKey = textValue(body.apiKey);
			if (!provider || !apiKey) {
				sendJson(response, 400, { success: false, error: "provider and apiKey are required" });
				return;
			}
			sendJson(response, 200, { success: true, data: await setProviderApiKey(provider, apiKey, configPaths) });
			return;
		}
		if (pathname === "/api/auth/logout") {
			const provider = textValue(body.provider);
			if (!provider) {
				sendJson(response, 400, { success: false, error: "provider is required" });
				return;
			}
			sendJson(response, 200, { success: true, data: await removeProviderAuth(provider, configPaths) });
			return;
		}
		if (pathname === "/api/auth/oauth/start") {
			const provider = textValue(body.provider);
			if (!provider) {
				sendJson(response, 400, { success: false, error: "provider is required" });
				return;
			}
			sendJson(response, 200, { success: true, data: startOAuthLogin(provider) });
			return;
		}
		if (pathname === "/api/auth/oauth/input") {
			const jobId = textValue(body.jobId);
			const value = textValue(body.value);
			if (!jobId || value === undefined) {
				sendJson(response, 400, { success: false, error: "jobId and value are required" });
				return;
			}
			resolveOAuthInput(jobId, value);
			sendJson(response, 200, { success: true, data: { jobId } });
			return;
		}
		if (pathname === "/api/auth/oauth/cancel") {
			const jobId = textValue(body.jobId);
			if (!jobId) {
				sendJson(response, 400, { success: false, error: "jobId is required" });
				return;
			}
			cancelOAuthLogin(jobId);
			sendJson(response, 200, { success: true, data: { jobId } });
			return;
		}
		if (pathname === "/api/custom-models") {
			const provider = textValue(body.provider);
			const modelId = textValue(body.modelId);
			if (!provider || !modelId) {
				sendJson(response, 400, { success: false, error: "provider and modelId are required" });
				return;
			}
			const input: CustomModelInput = {
				provider,
				modelId,
				name: textValue(body.name),
				api: textValue(body.api),
				baseUrl: textValue(body.baseUrl),
				apiKey: textValue(body.apiKey),
				reasoning: booleanValue(body.reasoning),
				imageInput: booleanValue(body.imageInput),
				localCompat: booleanValue(body.localCompat),
				contextWindow: numberValue(body.contextWindow),
				maxTokens: numberValue(body.maxTokens),
			};
			sendJson(response, 200, { success: true, data: await upsertCustomModel(input, configPaths) });
			return;
		}
		if (pathname === "/api/resources/skill") {
			const name = textValue(body.name);
			const description = textValue(body.description);
			if (!name || !description) {
				sendJson(response, 400, { success: false, error: "name and description are required" });
				return;
			}
			await mutateResourceAndReload(response, () =>
				createSkill(
					{
						name,
						description,
						instructions: textValue(body.instructions),
						scope: resourceScopeValue(body.scope),
						overwrite: booleanValue(body.overwrite),
					},
					resourcePaths,
				),
			);
			return;
		}
		if (pathname === "/api/resources/read") {
			const path = textValue(body.path);
			if (!path) {
				sendJson(response, 400, { success: false, error: "path is required" });
				return;
			}
			sendJson(response, 200, { success: true, data: await readResourceFile(path) });
			return;
		}
		if (pathname === "/api/resources/path") {
			const type = resourceTypeValue(body.type);
			const path = textValue(body.path);
			if (!type || !path) {
				sendJson(response, 400, { success: false, error: "valid type and path are required" });
				return;
			}
			await mutateResourceAndReload(response, () =>
				addResourcePath({ type, path, scope: resourceScopeValue(body.scope) }, resourcePaths),
			);
			return;
		}
		if (pathname === "/api/resources/path/remove") {
			const type = resourceTypeValue(body.type);
			const path = textValue(body.path);
			if (!type || !path) {
				sendJson(response, 400, { success: false, error: "valid type and path are required" });
				return;
			}
			await mutateResourceAndReload(response, () =>
				removeResourcePath({ type, path, scope: resourceScopeValue(body.scope) }, resourcePaths),
			);
			return;
		}
		if (pathname === "/api/resources/enabled") {
			const type = resourceTypeValue(body.type);
			const path = textValue(body.path);
			const enabled = booleanValue(body.enabled);
			if (!type || !path || enabled === undefined) {
				sendJson(response, 400, { success: false, error: "valid type, path, and enabled boolean are required" });
				return;
			}
			await mutateResourceAndReload(response, () =>
				setResourceEnabled({ type, path, enabled, scope: resourceScopeValue(body.scope) }, resourcePaths),
			);
			return;
		}
		if (pathname === "/api/resources/package/install") {
			const source = textValue(body.source);
			if (!source) {
				sendJson(response, 400, { success: false, error: "source is required" });
				return;
			}
			await mutateResourceAndReload(response, () =>
				installPackage({ source, scope: resourceScopeValue(body.scope) }, resourcePaths),
			);
			return;
		}
		if (pathname === "/api/resources/package/remove") {
			const source = textValue(body.source);
			if (!source) {
				sendJson(response, 400, { success: false, error: "source is required" });
				return;
			}
			await mutateResourceAndReload(response, () =>
				removePackage({ source, scope: resourceScopeValue(body.scope) }, resourcePaths),
			);
			return;
		}
		if (pathname === "/api/resources/reload") {
			await sendRpc(response, { type: "reload_resources" });
			return;
		}
		if (pathname === "/api/session/new") {
			await sendRpc(response, { type: "new_session", parentSession: textValue(body.parentSession) });
			return;
		}
		if (pathname === "/api/session/switch") {
			const sessionPath = textValue(body.sessionPath);
			if (!sessionPath) {
				sendJson(response, 400, { success: false, error: "sessionPath is required" });
				return;
			}
			await sendRpc(response, { type: "switch_session", sessionPath });
			return;
		}
		if (pathname === "/api/session/fork") {
			const entryId = textValue(body.entryId);
			if (!entryId) {
				sendJson(response, 400, { success: false, error: "entryId is required" });
				return;
			}
			await sendRpc(response, { type: "fork", entryId });
			return;
		}
		if (pathname === "/api/session/clone") {
			await sendRpc(response, { type: "clone" });
			return;
		}
		if (pathname === "/api/session/name") {
			const name = textValue(body.name);
			if (!name) {
				sendJson(response, 400, { success: false, error: "name is required" });
				return;
			}
			await sendRpc(response, { type: "set_session_name", name });
			return;
		}
		if (pathname === "/api/model") {
			const provider = textValue(body.provider);
			const modelId = textValue(body.modelId);
			if (!provider || !modelId) {
				sendJson(response, 400, { success: false, error: "provider and modelId are required" });
				return;
			}
			await sendRpc(response, { type: "set_model", provider, modelId });
			return;
		}
		if (pathname === "/api/thinking") {
			const level = thinkingLevelValue(body.level);
			if (!level) {
				sendJson(response, 400, { success: false, error: "valid thinking level is required" });
				return;
			}
			await sendRpc(response, { type: "set_thinking_level", level });
			return;
		}
		if (pathname === "/api/compact") {
			await sendRpc(response, { type: "compact", customInstructions: textValue(body.customInstructions) });
			return;
		}
		if (pathname === "/api/auto-compaction") {
			const enabled = booleanValue(body.enabled);
			if (enabled === undefined) {
				sendJson(response, 400, { success: false, error: "enabled boolean is required" });
				return;
			}
			await sendRpc(response, { type: "set_auto_compaction", enabled });
			return;
		}
		if (pathname === "/api/bash") {
			const command = textValue(body.command);
			if (!command) {
				sendJson(response, 400, { success: false, error: "command is required" });
				return;
			}
			await sendRpc(response, { type: "bash", command });
			return;
		}
		if (pathname === "/api/bash/abort") {
			await sendRpc(response, { type: "abort_bash" });
			return;
		}
		if (pathname === "/api/export/markdown") {
			const selectedText = textValue(body.selectedText);
			if (selectedText?.trim()) {
				const stateResponse = await bridge.send({ type: "get_state" });
				const context =
					stateResponse.success && stateResponse.command === "get_state" ? stateResponse.data : undefined;
				await sendMarkdownExport(
					response,
					selectedTextToMarkdown(selectedText, context),
					textValue(body.outputPath),
				);
				return;
			}
			const rpcResponse = await bridge.send({ type: "get_messages" });
			if (!rpcResponse.success || rpcResponse.command !== "get_messages") {
				const { status, payload } = rpcHttpPayload(rpcResponse);
				sendJson(response, status, payload);
				return;
			}
			await sendMarkdownExport(response, messagesToMarkdown(rpcResponse.data.messages), textValue(body.outputPath));
			return;
		}
		if (pathname === "/api/export") {
			await sendRpc(response, { type: "export_html", outputPath: textValue(body.outputPath) });
			return;
		}
		sendText(response, 404, "Not found");
	}

	type OAuthAwaiting =
		| { kind: "prompt" | "manual"; resolve: (value: string) => void; reject: (error: Error) => void }
		| { kind: "select"; resolve: (value: string | undefined) => void; reject: (error: Error) => void };

	interface OAuthJob {
		id: string;
		provider: string;
		providerName: string;
		abortController: AbortController;
		awaiting?: OAuthAwaiting;
	}

	function nextOAuthJobId(): string {
		return `oauth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	function rejectOAuthAwaiting(job: OAuthJob, error: Error): void {
		job.awaiting?.reject(error);
		job.awaiting = undefined;
	}

	function setOAuthAwaiting(
		job: OAuthJob,
		kind: "prompt" | "manual",
		payload: Record<string, unknown>,
	): Promise<string>;
	function setOAuthAwaiting(
		job: OAuthJob,
		kind: "select",
		payload: Record<string, unknown>,
	): Promise<string | undefined>;
	function setOAuthAwaiting(
		job: OAuthJob,
		kind: OAuthAwaiting["kind"],
		payload: Record<string, unknown>,
	): Promise<string | undefined> {
		rejectOAuthAwaiting(job, new Error("Superseded by a new OAuth input request"));
		broadcast({
			type: "auth_oauth_update",
			jobId: job.id,
			provider: job.provider,
			providerName: job.providerName,
			phase: kind,
			...payload,
		});
		return new Promise<string | undefined>((resolve, reject) => {
			job.awaiting =
				kind === "select"
					? { kind, resolve, reject }
					: { kind, resolve: resolve as (value: string) => void, reject };
		});
	}

	function startOAuthLogin(provider: string): {
		jobId: string;
		provider: string;
		providerName: string;
		authPath: string;
	} {
		const providerInfo = getOAuthProviders().find((candidate) => candidate.id === provider);
		if (!providerInfo) {
			throw new Error(`OAuth is not supported for provider: ${provider}`);
		}

		const job: OAuthJob = {
			id: nextOAuthJobId(),
			provider,
			providerName: providerInfo.name,
			abortController: new AbortController(),
		};
		oauthJobs.set(job.id, job);

		const authStorage = AuthStorage.create(getWebAuthPath(configPaths));
		void authStorage
			.login(provider as OAuthProviderId, {
				onAuth: (info) => {
					broadcast({
						type: "auth_oauth_update",
						jobId: job.id,
						provider,
						providerName: providerInfo.name,
						phase: "auth",
						url: info.url,
						instructions: info.instructions,
					});
				},
				onDeviceCode: (info) => {
					broadcast({
						type: "auth_oauth_update",
						jobId: job.id,
						provider,
						providerName: providerInfo.name,
						phase: "device",
						...info,
					});
				},
				onPrompt: (prompt) => setOAuthAwaiting(job, "prompt", prompt),
				onProgress: (message) => {
					broadcast({
						type: "auth_oauth_update",
						jobId: job.id,
						provider,
						providerName: providerInfo.name,
						phase: "progress",
						message,
					});
				},
				onManualCodeInput: () =>
					setOAuthAwaiting(job, "manual", {
						message: "Paste redirect URL or authorization code",
					}).then((value) => value ?? ""),
				onSelect: (prompt: OAuthSelectPrompt) => setOAuthAwaiting(job, "select", prompt),
				signal: job.abortController.signal,
			})
			.then(() => {
				rejectOAuthAwaiting(job, new Error("OAuth login completed"));
				oauthJobs.delete(job.id);
				const errors = authStorage.drainErrors();
				if (errors.length > 0) {
					throw new Error(errors.map((error) => error.message).join("\n"));
				}
				broadcast({
					type: "auth_oauth_update",
					jobId: job.id,
					provider,
					providerName: providerInfo.name,
					phase: "complete",
				});
			})
			.catch((error: unknown) => {
				rejectOAuthAwaiting(job, error instanceof Error ? error : new Error(String(error)));
				oauthJobs.delete(job.id);
				broadcast({
					type: "auth_oauth_update",
					jobId: job.id,
					provider,
					providerName: providerInfo.name,
					phase: "error",
					error: error instanceof Error ? error.message : String(error),
				});
			});

		return { jobId: job.id, provider, providerName: providerInfo.name, authPath: getWebAuthPath(configPaths) };
	}

	function resolveOAuthInput(jobId: string, value: string): void {
		const job = oauthJobs.get(jobId);
		if (!job?.awaiting) {
			throw new Error(`No OAuth input is pending for job: ${jobId}`);
		}
		const awaiting = job.awaiting;
		job.awaiting = undefined;
		awaiting.resolve(value);
	}

	function cancelOAuthLogin(jobId: string): void {
		const job = oauthJobs.get(jobId);
		if (!job) {
			return;
		}
		job.abortController.abort();
		rejectOAuthAwaiting(job, new Error("OAuth login cancelled"));
		oauthJobs.delete(jobId);
		broadcast({
			type: "auth_oauth_update",
			jobId: job.id,
			provider: job.provider,
			providerName: job.providerName,
			phase: "cancelled",
		});
	}

	const url = `http://${options.host}:${options.port}`;
	return {
		url,
		server,
		async start() {
			await bridge.start();
			await new Promise<void>((resolve, reject) => {
				server.once("error", reject);
				server.listen(options.port, options.host, () => {
					server.off("error", reject);
					resolve();
				});
			});
		},
		async stop() {
			unsubscribeBridge();
			for (const socket of sockets) {
				socket.close();
			}
			sockets.clear();
			await new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			});
			await bridge.stop();
		},
	};
}
