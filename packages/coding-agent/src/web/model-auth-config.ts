import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getModels, getProviders } from "@earendil-works/pi-ai";
import { getOAuthProviders } from "@earendil-works/pi-ai/oauth";
import { getAgentDir } from "../config.ts";
import { AuthStorage } from "../core/auth-storage.ts";

type JsonObject = Record<string, unknown>;

export interface WebConfigPaths {
	agentDir?: string;
	authPath?: string;
	modelsPath?: string;
}

export interface AuthProviderInfo {
	id: string;
	name: string;
	available: boolean;
	stored: boolean;
	credentialType?: "api_key" | "oauth";
	source?: string;
	label?: string;
	supportsOAuth: boolean;
	modelCount: number;
}

export interface CustomModelInput {
	provider: string;
	modelId: string;
	name?: string;
	api?: string;
	baseUrl?: string;
	apiKey?: string;
	reasoning?: boolean;
	imageInput?: boolean;
	localCompat?: boolean;
	contextWindow?: number;
	maxTokens?: number;
}

interface CustomModelConfig {
	id: string;
	name?: string;
	api?: string;
	baseUrl?: string;
	reasoning?: boolean;
	input?: Array<"text" | "image">;
	cost?: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
	contextWindow?: number;
	maxTokens?: number;
	compat?: JsonObject;
}

interface ProviderConfig {
	name?: string;
	baseUrl?: string;
	apiKey?: string;
	api?: string;
	headers?: Record<string, string>;
	compat?: JsonObject;
	authHeader?: boolean;
	models?: CustomModelConfig[];
	modelOverrides?: Record<string, JsonObject>;
}

interface ModelsConfig {
	providers: Record<string, ProviderConfig>;
}

const PROVIDER_NAMES: Record<string, string> = {
	anthropic: "Anthropic",
	"azure-openai-responses": "Azure OpenAI Responses",
	cerebras: "Cerebras",
	"cloudflare-ai-gateway": "Cloudflare AI Gateway",
	"cloudflare-workers-ai": "Cloudflare Workers AI",
	deepseek: "DeepSeek",
	fireworks: "Fireworks",
	google: "Google Gemini",
	groq: "Groq",
	huggingface: "Hugging Face",
	"kimi-coding": "Kimi For Coding",
	minimax: "MiniMax",
	"minimax-cn": "MiniMax China",
	mistral: "Mistral",
	openai: "OpenAI API",
	"openai-codex": "ChatGPT Plus/Pro Codex",
	opencode: "OpenCode Zen",
	"opencode-go": "OpenCode Go",
	openrouter: "OpenRouter",
	together: "Together AI",
	"vercel-ai-gateway": "Vercel AI Gateway",
	xai: "xAI",
	xiaomi: "Xiaomi MiMo",
	"xiaomi-token-plan-ams": "Xiaomi Token Plan Amsterdam",
	"xiaomi-token-plan-cn": "Xiaomi Token Plan China",
	"xiaomi-token-plan-sgp": "Xiaomi Token Plan Singapore",
	zai: "ZAI",
};

export function getWebAuthPath(paths: WebConfigPaths = {}): string {
	return paths.authPath ?? join(paths.agentDir ?? getAgentDir(), "auth.json");
}

export function getWebModelsPath(paths: WebConfigPaths = {}): string {
	return paths.modelsPath ?? join(paths.agentDir ?? getAgentDir(), "models.json");
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequiredText(value: string | undefined, field: string): string {
	const normalized = value?.trim();
	if (!normalized) {
		throw new Error(`${field} is required`);
	}
	return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized || undefined;
}

function validateProviderId(provider: string): void {
	if (provider.includes("/") || /\s/.test(provider)) {
		throw new Error("provider cannot contain slashes or whitespace");
	}
}

function positiveInteger(value: number | undefined, field: string): number | undefined {
	if (value === undefined) return undefined;
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${field} must be a positive integer`);
	}
	return value;
}

/** Strip `//` line comments and trailing commas from JSON, leaving string literals untouched. */
function stripJsonComments(input: string): string {
	return input
		.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (match) => (match[0] === '"' ? match : ""))
		.replace(
			/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g,
			(match, tail: string | undefined) => tail ?? (match[0] === '"' ? match : ""),
		);
}

async function readModelsConfig(modelsPath: string): Promise<ModelsConfig> {
	let content = "";
	try {
		content = await readFile(modelsPath, "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { providers: {} };
		}
		throw error;
	}

	if (!content.trim()) {
		return { providers: {} };
	}

	const parsed = JSON.parse(stripJsonComments(content)) as unknown;
	if (!isRecord(parsed)) {
		throw new Error("models.json root must be an object");
	}
	if (parsed.providers !== undefined && !isRecord(parsed.providers)) {
		throw new Error("models.json providers must be an object");
	}
	const config = parsed as Partial<ModelsConfig>;
	return {
		...config,
		providers: isRecord(parsed.providers) ? ({ ...parsed.providers } as Record<string, ProviderConfig>) : {},
	};
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
	await chmod(path, 0o600);
}

export async function getAuthOverview(paths: WebConfigPaths = {}): Promise<{
	authPath: string;
	providers: AuthProviderInfo[];
}> {
	const authPath = getWebAuthPath(paths);
	const authStorage = AuthStorage.create(authPath);
	const errors = authStorage.drainErrors();
	if (errors.length > 0) {
		throw new Error(errors.map((error) => error.message).join("\n"));
	}

	const oauthProviders = new Map(getOAuthProviders().map((provider) => [provider.id, provider]));
	const providerIds = new Set<string>([...getProviders(), ...oauthProviders.keys(), ...authStorage.list()]);

	const providers = Array.from(providerIds)
		.map((providerId) => {
			const credential = authStorage.get(providerId);
			const status = authStorage.getAuthStatus(providerId);
			const oauthProvider = oauthProviders.get(providerId);
			const models = getProviders().includes(providerId as never)
				? getModels(providerId as Parameters<typeof getModels>[0])
				: [];
			return {
				id: providerId,
				name: oauthProvider?.name ?? PROVIDER_NAMES[providerId] ?? providerId,
				available: authStorage.hasAuth(providerId),
				stored: authStorage.has(providerId),
				credentialType: credential?.type,
				source: status.source,
				label: status.label,
				supportsOAuth: oauthProviders.has(providerId),
				modelCount: models.length,
			} satisfies AuthProviderInfo;
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	return { authPath, providers };
}

export async function setProviderApiKey(
	provider: string,
	apiKey: string,
	paths: WebConfigPaths = {},
): Promise<{ authPath: string; provider: string }> {
	const providerId = normalizeRequiredText(provider, "provider");
	validateProviderId(providerId);
	const key = normalizeRequiredText(apiKey, "apiKey");
	const authPath = getWebAuthPath(paths);
	const authStorage = AuthStorage.create(authPath);
	authStorage.set(providerId, { type: "api_key", key });
	const errors = authStorage.drainErrors();
	if (errors.length > 0) {
		throw new Error(errors.map((error) => error.message).join("\n"));
	}
	return { authPath, provider: providerId };
}

export async function removeProviderAuth(
	provider: string,
	paths: WebConfigPaths = {},
): Promise<{ authPath: string; provider: string }> {
	const providerId = normalizeRequiredText(provider, "provider");
	validateProviderId(providerId);
	const authPath = getWebAuthPath(paths);
	const authStorage = AuthStorage.create(authPath);
	authStorage.logout(providerId);
	const errors = authStorage.drainErrors();
	if (errors.length > 0) {
		throw new Error(errors.map((error) => error.message).join("\n"));
	}
	return { authPath, provider: providerId };
}

export async function getCustomModelsOverview(paths: WebConfigPaths = {}): Promise<{
	modelsPath: string;
	providers: Array<{
		id: string;
		api?: string;
		baseUrl?: string;
		hasApiKey: boolean;
		models: Array<{ id: string; name?: string; api?: string; baseUrl?: string }>;
	}>;
}> {
	const modelsPath = getWebModelsPath(paths);
	const config = await readModelsConfig(modelsPath);
	return {
		modelsPath,
		providers: Object.entries(config.providers)
			.map(([id, provider]) => ({
				id,
				api: provider.api,
				baseUrl: provider.baseUrl,
				hasApiKey: Boolean(provider.apiKey),
				models: (provider.models ?? []).map((model) => ({
					id: model.id,
					name: model.name,
					api: model.api,
					baseUrl: model.baseUrl,
				})),
			}))
			.sort((a, b) => a.id.localeCompare(b.id)),
	};
}

export async function upsertCustomModel(
	input: CustomModelInput,
	paths: WebConfigPaths = {},
): Promise<{ modelsPath: string; provider: string; modelId: string }> {
	const provider = normalizeRequiredText(input.provider, "provider");
	const modelId = normalizeRequiredText(input.modelId, "modelId");
	validateProviderId(provider);

	const api = normalizeOptionalText(input.api) ?? "openai-completions";
	const baseUrl = normalizeOptionalText(input.baseUrl);
	const apiKey = normalizeOptionalText(input.apiKey);
	const contextWindow = positiveInteger(input.contextWindow, "contextWindow") ?? 128000;
	const maxTokens = positiveInteger(input.maxTokens, "maxTokens") ?? 16384;
	const builtInProvider = getProviders().includes(provider as never);
	const modelsPath = getWebModelsPath(paths);
	const config = await readModelsConfig(modelsPath);
	const providerConfig: ProviderConfig = { ...(config.providers[provider] ?? {}) };

	providerConfig.api = api;
	if (baseUrl) providerConfig.baseUrl = baseUrl;
	if (apiKey) providerConfig.apiKey = apiKey;
	if (input.localCompat) {
		providerConfig.compat = {
			...(providerConfig.compat ?? {}),
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
		};
	}

	const nextModels = [...(providerConfig.models ?? [])];
	const modelConfig: CustomModelConfig = {
		id: modelId,
		name: normalizeOptionalText(input.name),
		reasoning: Boolean(input.reasoning),
		input: input.imageInput ? ["text", "image"] : ["text"],
		contextWindow,
		maxTokens,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	};
	const existingIndex = nextModels.findIndex((model) => model.id === modelId);
	if (existingIndex >= 0) {
		nextModels[existingIndex] = {
			...nextModels[existingIndex],
			...modelConfig,
		};
	} else {
		nextModels.push(modelConfig);
	}
	providerConfig.models = nextModels;

	if (!builtInProvider) {
		if (!providerConfig.baseUrl) {
			throw new Error("baseUrl is required for custom providers");
		}
		if (!providerConfig.apiKey) {
			throw new Error("apiKey is required for custom providers");
		}
		if (!providerConfig.api) {
			throw new Error("api is required for custom providers");
		}
	}

	config.providers[provider] = providerConfig;
	await writePrivateJson(modelsPath, config);
	return { modelsPath, provider, modelId };
}
