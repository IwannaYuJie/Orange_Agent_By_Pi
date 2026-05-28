import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROTECTED_PATH_PARTS = [".env", ".git/", "node_modules/"];
const DANGEROUS_BASH_PATTERNS = [
	/\brm\s+(-[^\s]*[rf][^\s]*|-[^\s]*[fr][^\s]*)\b/,
	/\bsudo\b/,
	/\bchmod\s+(-R\s+)?777\b/,
	/\bchown\s+(-R\s+)?/,
	/\bdd\s+if=/,
	/\bmkfs\b/,
	/\bdiskutil\s+(erase|partition|unmount|apfs)\b/,
];

function inputString(input: unknown, key: string): string | undefined {
	if (typeof input !== "object" || input === null || !(key in input)) {
		return undefined;
	}
	const value = (input as Record<string, unknown>)[key];
	return typeof value === "string" ? value : undefined;
}

function isProtectedPath(path: string): boolean {
	return PROTECTED_PATH_PARTS.some((part) => path.includes(part));
}

function isDangerousCommand(command: string): boolean {
	return DANGEROUS_BASH_PATTERNS.some((pattern) => pattern.test(command));
}

export default function webPermissionGate(pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "bash") {
			const command = inputString(event.input, "command");
			if (!command || !isDangerousCommand(command)) {
				return undefined;
			}
			if (!ctx.hasUI) {
				return { block: true, reason: "Dangerous bash command blocked because no UI is attached." };
			}
			const confirmed = await ctx.ui.confirm("Confirm bash command", command);
			return confirmed ? undefined : { block: true, reason: "Dangerous bash command blocked by user." };
		}

		if (event.toolName !== "write" && event.toolName !== "edit") {
			return undefined;
		}

		const path = inputString(event.input, "path");
		if (!path || !isProtectedPath(path)) {
			return undefined;
		}
		if (!ctx.hasUI) {
			return { block: true, reason: `Protected path blocked: ${path}` };
		}
		const confirmed = await ctx.ui.confirm("Confirm protected path write", path);
		return confirmed ? undefined : { block: true, reason: `Protected path blocked by user: ${path}` };
	});
}
