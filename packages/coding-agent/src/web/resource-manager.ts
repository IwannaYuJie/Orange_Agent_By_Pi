import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "../config.ts";
import { DefaultPackageManager, type ResolvedResource } from "../core/package-manager.ts";
import { type PackageSource, type Settings, SettingsManager } from "../core/settings-manager.ts";
import { loadSkills, type Skill } from "../core/skills.ts";

export type ResourceType = "extensions" | "skills" | "prompts" | "themes";
export type ResourceScope = "user" | "project";

export interface ResourceConfigPaths {
	cwd: string;
	agentDir?: string;
}

export interface SkillCreateInput {
	name: string;
	description: string;
	instructions?: string;
	scope?: ResourceScope;
	overwrite?: boolean;
}

export interface ResourcePathInput {
	type: ResourceType;
	path: string;
	scope?: ResourceScope;
}

export interface ResourceEnableInput {
	type: ResourceType;
	path: string;
	scope?: ResourceScope;
	enabled: boolean;
}

export interface PackageInput {
	source: string;
	scope?: ResourceScope;
}

interface ResourceView {
	path: string;
	enabled: boolean;
	scope: string;
	source: string;
	origin: string;
	baseDir?: string;
	name?: string;
	description?: string;
}

function agentDir(paths: ResourceConfigPaths): string {
	return paths.agentDir ?? getAgentDir();
}

function normalizeScope(scope: ResourceScope | undefined): ResourceScope {
	return scope === "project" ? "project" : "user";
}

function normalizeRequiredText(value: string | undefined, field: string): string {
	const normalized = value?.trim();
	if (!normalized) {
		throw new Error(`${field} is required`);
	}
	return normalized;
}

function validateSkillName(name: string): void {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
		throw new Error("skill name must use lowercase letters, numbers, and single hyphens");
	}
}

function titleFromName(name: string): string {
	return name
		.split("-")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function createSettingsManager(paths: ResourceConfigPaths): SettingsManager {
	return SettingsManager.create(paths.cwd, agentDir(paths));
}

function createPackageManager(paths: ResourceConfigPaths, settingsManager: SettingsManager): DefaultPackageManager {
	return new DefaultPackageManager({
		cwd: paths.cwd,
		agentDir: agentDir(paths),
		settingsManager,
	});
}

function getScopedSettings(settingsManager: SettingsManager, scope: ResourceScope): Settings {
	return scope === "project" ? settingsManager.getProjectSettings() : settingsManager.getGlobalSettings();
}

function getResourceArray(settings: Settings, type: ResourceType): string[] {
	return [...((settings[type] ?? []) as string[])];
}

function setResourceArray(
	settingsManager: SettingsManager,
	type: ResourceType,
	scope: ResourceScope,
	values: string[],
): void {
	if (scope === "project") {
		if (type === "extensions") settingsManager.setProjectExtensionPaths(values);
		else if (type === "skills") settingsManager.setProjectSkillPaths(values);
		else if (type === "prompts") settingsManager.setProjectPromptTemplatePaths(values);
		else settingsManager.setProjectThemePaths(values);
		return;
	}
	if (type === "extensions") settingsManager.setExtensionPaths(values);
	else if (type === "skills") settingsManager.setSkillPaths(values);
	else if (type === "prompts") settingsManager.setPromptTemplatePaths(values);
	else settingsManager.setThemePaths(values);
}

function resourceKey(path: string): string {
	return path.endsWith("/SKILL.md") ? dirname(path) : path;
}

function makeSkillLookup(skills: Skill[]): Map<string, Skill> {
	const lookup = new Map<string, Skill>();
	for (const skill of skills) {
		lookup.set(skill.filePath, skill);
		lookup.set(skill.baseDir, skill);
	}
	return lookup;
}

function mapResource(resource: ResolvedResource, skills?: Map<string, Skill>): ResourceView {
	const skill = skills?.get(resource.path) ?? skills?.get(resourceKey(resource.path));
	return {
		path: resource.path,
		enabled: resource.enabled,
		scope: resource.metadata.scope,
		source: resource.metadata.source,
		origin: resource.metadata.origin,
		baseDir: resource.metadata.baseDir,
		name: skill?.name,
		description: skill?.description,
	};
}

function packageSourceText(source: PackageSource): string {
	return typeof source === "string" ? source : source.source;
}

export async function getResourceOverview(paths: ResourceConfigPaths) {
	const resolvedAgentDir = agentDir(paths);
	const settingsManager = createSettingsManager(paths);
	const packageManager = createPackageManager(paths, settingsManager);
	const resolved = await packageManager.resolve(async () => "skip");
	const enabledSkillPaths = resolved.skills.filter((skill) => skill.enabled).map((skill) => skill.path);
	const skillsResult = loadSkills({
		cwd: paths.cwd,
		agentDir: resolvedAgentDir,
		skillPaths: enabledSkillPaths,
		includeDefaults: false,
	});
	const skillLookup = makeSkillLookup(skillsResult.skills);
	const globalSettings = settingsManager.getGlobalSettings();
	const projectSettings = settingsManager.getProjectSettings();

	return {
		paths: {
			agentDir: resolvedAgentDir,
			userSkillsDir: join(resolvedAgentDir, "skills"),
			userExtensionsDir: join(resolvedAgentDir, "extensions"),
			projectSkillsDir: join(paths.cwd, CONFIG_DIR_NAME, "skills"),
			projectExtensionsDir: join(paths.cwd, CONFIG_DIR_NAME, "extensions"),
		},
		configured: {
			user: {
				packages: (globalSettings.packages ?? []).map(packageSourceText),
				extensions: getResourceArray(globalSettings, "extensions"),
				skills: getResourceArray(globalSettings, "skills"),
			},
			project: {
				packages: (projectSettings.packages ?? []).map(packageSourceText),
				extensions: getResourceArray(projectSettings, "extensions"),
				skills: getResourceArray(projectSettings, "skills"),
			},
		},
		packages: packageManager.listConfiguredPackages(),
		resources: {
			skills: resolved.skills.map((resource) => mapResource(resource, skillLookup)),
			extensions: resolved.extensions.map((resource) => mapResource(resource)),
			prompts: resolved.prompts.map((resource) => mapResource(resource)),
			themes: resolved.themes.map((resource) => mapResource(resource)),
		},
		diagnostics: skillsResult.diagnostics,
	};
}

export async function createSkill(input: SkillCreateInput, paths: ResourceConfigPaths) {
	const name = normalizeRequiredText(input.name, "name");
	const description = normalizeRequiredText(input.description, "description");
	validateSkillName(name);
	const scope = normalizeScope(input.scope);
	const baseDir = scope === "project" ? join(paths.cwd, CONFIG_DIR_NAME, "skills") : join(agentDir(paths), "skills");
	const skillDir = join(baseDir, name);
	const skillPath = join(skillDir, "SKILL.md");
	if (existsSync(skillPath) && !input.overwrite) {
		throw new Error(`Skill already exists: ${skillPath}`);
	}
	const instructions =
		input.instructions?.trim() || "Describe the workflow, commands, references, and constraints here.";
	const body = `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${titleFromName(name)}\n\n${instructions}\n`;
	await mkdir(skillDir, { recursive: true, mode: 0o700 });
	await writeFile(skillPath, body, "utf-8");
	return { name, description, path: skillPath, scope };
}

export async function readResourceFile(path: string): Promise<{ path: string; content: string }> {
	const filePath = normalizeRequiredText(path, "path");
	return { path: filePath, content: await readFile(filePath, "utf-8") };
}

export async function addResourcePath(input: ResourcePathInput, paths: ResourceConfigPaths) {
	const resourcePath = normalizeRequiredText(input.path, "path");
	const scope = normalizeScope(input.scope);
	const settingsManager = createSettingsManager(paths);
	const settings = getScopedSettings(settingsManager, scope);
	const current = getResourceArray(settings, input.type);
	if (!current.includes(resourcePath)) {
		setResourceArray(settingsManager, input.type, scope, [...current, resourcePath]);
	}
	return { type: input.type, path: resourcePath, scope };
}

export async function removeResourcePath(input: ResourcePathInput, paths: ResourceConfigPaths) {
	const resourcePath = normalizeRequiredText(input.path, "path");
	const scope = normalizeScope(input.scope);
	const settingsManager = createSettingsManager(paths);
	const settings = getScopedSettings(settingsManager, scope);
	const current = getResourceArray(settings, input.type);
	const next = current.filter((entry) => entry !== resourcePath);
	setResourceArray(settingsManager, input.type, scope, next);
	return { type: input.type, path: resourcePath, scope, removed: next.length !== current.length };
}

export async function setResourceEnabled(input: ResourceEnableInput, paths: ResourceConfigPaths) {
	const resourcePath = normalizeRequiredText(input.path, "path");
	const scope = normalizeScope(input.scope);
	const settingsManager = createSettingsManager(paths);
	const settings = getScopedSettings(settingsManager, scope);
	const current = getResourceArray(settings, input.type);
	const next = current.filter(
		(entry) => entry !== resourcePath && entry !== `+${resourcePath}` && entry !== `-${resourcePath}`,
	);
	next.push(`${input.enabled ? "+" : "-"}${resourcePath}`);
	setResourceArray(settingsManager, input.type, scope, next);
	return { type: input.type, path: resourcePath, scope, enabled: input.enabled };
}

export async function installPackage(input: PackageInput, paths: ResourceConfigPaths) {
	const source = normalizeRequiredText(input.source, "source");
	const scope = normalizeScope(input.scope);
	const settingsManager = createSettingsManager(paths);
	const packageManager = createPackageManager(paths, settingsManager);
	await packageManager.installAndPersist(source, { local: scope === "project" });
	return { source, scope };
}

export async function removePackage(input: PackageInput, paths: ResourceConfigPaths) {
	const source = normalizeRequiredText(input.source, "source");
	const scope = normalizeScope(input.scope);
	const settingsManager = createSettingsManager(paths);
	const packageManager = createPackageManager(paths, settingsManager);
	const removed = await packageManager.removeAndPersist(source, { local: scope === "project" });
	return { source, scope, removed };
}
