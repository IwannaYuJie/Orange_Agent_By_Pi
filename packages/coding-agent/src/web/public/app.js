const chatLog = document.getElementById("chatLog");
const connectionLabel = document.getElementById("connectionLabel");
const observerWarning = document.getElementById("observerWarning");
const cwdLabel = document.getElementById("cwdLabel");
const sessionName = document.getElementById("sessionName");
const sessionFile = document.getElementById("sessionFile");
const sessionNameInput = document.getElementById("sessionNameInput");
const sessionStats = document.getElementById("sessionStats");
const modelSearchInput = document.getElementById("modelSearchInput");
const modelSelect = document.getElementById("modelSelect");
const thinkingSelect = document.getElementById("thinkingSelect");
const contextMetric = document.getElementById("contextMetric");
const messageMetric = document.getElementById("messageMetric");
const queueMetric = document.getElementById("queueMetric");
const eventList = document.getElementById("eventList");
const promptInput = document.getElementById("promptInput");
const attachmentInput = document.getElementById("attachmentInput");
const attachmentPreview = document.getElementById("attachmentPreview");
const bashInput = document.getElementById("bashInput");
const bashAbortBtn = document.getElementById("bashAbortBtn");
const bashOutput = document.getElementById("bashOutput");
const executeModeBtn = document.getElementById("executeModeBtn");
const planModeBtn = document.getElementById("planModeBtn");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalOptions = document.getElementById("modalOptions");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");
const authModalBackdrop = document.getElementById("authModalBackdrop");
const authProviderSelect = document.getElementById("authProviderSelect");
const authMethodSelect = document.getElementById("authMethodSelect");
const authApiKeyInput = document.getElementById("authApiKeyInput");
const apiKeyField = document.getElementById("apiKeyField");
const oauthPanel = document.getElementById("oauthPanel");
const oauthLink = document.getElementById("oauthLink");
const oauthStatus = document.getElementById("oauthStatus");
const oauthPromptGroup = document.getElementById("oauthPromptGroup");
const oauthPromptInput = document.getElementById("oauthPromptInput");
const modelModalBackdrop = document.getElementById("modelModalBackdrop");
const customProviderInput = document.getElementById("customProviderInput");
const customModelInput = document.getElementById("customModelInput");
const customNameInput = document.getElementById("customNameInput");
const customApiSelect = document.getElementById("customApiSelect");
const customBaseUrlInput = document.getElementById("customBaseUrlInput");
const customApiKeyInput = document.getElementById("customApiKeyInput");
const customContextInput = document.getElementById("customContextInput");
const customMaxTokensInput = document.getElementById("customMaxTokensInput");
const customImageInput = document.getElementById("customImageInput");
const customReasoningInput = document.getElementById("customReasoningInput");
const customLocalCompatInput = document.getElementById("customLocalCompatInput");
const customModelStatus = document.getElementById("customModelStatus");
const resourcesModalBackdrop = document.getElementById("resourcesModalBackdrop");
const resourcesStatus = document.getElementById("resourcesStatus");
const resourceDiagnostics = document.getElementById("resourceDiagnostics");
const resourcePreviewPane = document.getElementById("resourcePreviewPane");
const resourcePreviewTitle = document.getElementById("resourcePreviewTitle");
const resourcePreviewPath = document.getElementById("resourcePreviewPath");
const resourcePreviewContent = document.getElementById("resourcePreviewContent");
const skillsList = document.getElementById("skillsList");
const extensionsList = document.getElementById("extensionsList");
const packagesList = document.getElementById("packagesList");
const skillNameInput = document.getElementById("skillNameInput");
const skillDescriptionInput = document.getElementById("skillDescriptionInput");
const skillInstructionsInput = document.getElementById("skillInstructionsInput");
const resourceScopeSelect = document.getElementById("resourceScopeSelect");
const resourceTypeSelect = document.getElementById("resourceTypeSelect");
const resourcePathInput = document.getElementById("resourcePathInput");
const packageSourceInput = document.getElementById("packageSourceInput");
const cwdChangeBtn = document.getElementById("cwdChangeBtn");
const cwdModalBackdrop = document.getElementById("cwdModalBackdrop");
const cwdPathLabel = document.getElementById("cwdPathLabel");
const cwdList = document.getElementById("cwdList");
const cwdRecentList = document.getElementById("cwdRecentList");
const cwdHomeBtn = document.getElementById("cwdHomeBtn");
const cwdCurrentBtn = document.getElementById("cwdCurrentBtn");
const cwdParentBtn = document.getElementById("cwdParentBtn");
const cwdCancelBtn = document.getElementById("cwdCancelBtn");
const cwdSelectBtn = document.getElementById("cwdSelectBtn");
const cwdStatus = document.getElementById("cwdStatus");
const sessionsModalBackdrop = document.getElementById("sessionsModalBackdrop");
const sessionCwdSelect = document.getElementById("sessionCwdSelect");
const sessionSearchInput = document.getElementById("sessionSearchInput");
const sessionsStatus = document.getElementById("sessionsStatus");
const sessionsList = document.getElementById("sessionsList");
const slashCommandMenu = document.getElementById("slashCommandMenu");

// 新增 Phase 2 界面元素的 DOM 绑定
const appShell = document.getElementById("appShell");
const leftPanel = document.getElementById("leftPanel");
const rightPanel = document.getElementById("rightPanel");
const toggleLeftBtn = document.getElementById("toggleLeftBtn");
const toggleRightBtn = document.getElementById("toggleRightBtn");
const scrollBottomBadge = document.getElementById("scrollBottomBadge");
const terminalHistory = document.getElementById("terminalHistory");
const clearTerminalBtn = document.getElementById("clearTerminalBtn");
const imageAttachmentMimeTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const maxTextAttachmentBytes = 1024 * 1024;
const maxBinaryAttachmentBytes = 6 * 1024 * 1024;
const recentCwdStorageKey = "pi-web:recent-cwds";
const bashHistoryStorageKey = "pi-web:bash-history";

const state = {
	socket: undefined,
	models: [],
	commands: [],
	authProviders: [],
	resources: undefined,
	sessions: [],
	sessionBrowserMode: "sessions",
	currentModel: undefined,
	currentAssistant: undefined,
	currentAssistantContent: undefined,
	pendingAssistantContent: undefined,
	pendingAssistantStickToBottom: false,
	assistantRenderFrame: undefined,
	pendingToolBodies: new Map(),
	toolRenderFrame: undefined,
	tools: new Map(),
	attachments: [],
	planMode: false,
	isStreaming: false,
	isBashRunning: false,
	lastThinkingOffSyncModelValue: undefined,
	currentAgentStartedAt: undefined,
	lastAgentElapsedMs: undefined,
	currentOAuthJob: undefined,
	eventsLog: [],
	eventsRenderFrame: undefined,
	activeEventFilter: "all",
	currentCwd: "",
	sessionsCwd: "",
	cwdPicker: undefined,
	reconnectDelayMs: 1200,
	reconnectTimer: undefined,
	unreadStreamEvents: 0,
	bashHistory: [],
	bashHistoryIndex: -1,
};

// 带有分类过滤的日志事件追加器
function addEvent(text, category = "system") {
	state.eventsLog.push({
		time: new Date().toLocaleTimeString(),
		text,
		category // 'system' | 'agent' | 'tool' | 'error'
	});
	if (state.eventsLog.length > 500) {
		state.eventsLog.splice(0, state.eventsLog.length - 500);
	}
	scheduleEventsRender();
}

function scheduleEventsRender() {
	if (state.eventsRenderFrame) {
		return;
	}
	state.eventsRenderFrame = requestAnimationFrame(() => {
		state.eventsRenderFrame = undefined;
		renderEventsList();
	});
}

function renderEventsList() {
	eventList.innerHTML = "";
	const filtered = state.eventsLog.filter(evt => {
		if (state.activeEventFilter === "all") return true;
		return evt.category === state.activeEventFilter;
	});

	// 只展示最新的 8 条以适配界面空间，逆序排列显示最新事件在最上方
	const display = filtered.slice(-8).reverse();
	for (const evt of display) {
		const item = document.createElement("div");
		item.className = "event-item";

		if (evt.category === "error") {
			item.style.borderColor = "rgba(239, 68, 68, 0.2)";
			item.style.color = "#fca5a5";
		} else if (evt.category === "tool") {
			item.style.borderColor = "rgba(0, 242, 254, 0.2)";
			item.style.color = "var(--accent)";
		} else if (evt.category === "agent") {
			item.style.borderColor = "rgba(16, 185, 129, 0.2)";
			item.style.color = "#34d399";
		}

		item.textContent = `${evt.time} ${evt.text}`;
		eventList.appendChild(item);
	}
}

// 绑定系统事件流过滤标签的切换
document.querySelectorAll(".filter-tab").forEach(tab => {
	tab.addEventListener("click", () => {
		document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
		tab.classList.add("active");
		state.activeEventFilter = tab.dataset.filter;
		renderEventsList();
	});
});

async function api(path, options = {}) {
	const response = await fetch(path, {
		headers: { "content-type": "application/json" },
		...options,
	});
	const payload = await response.json().catch(() => ({}));
	if (!response.ok || payload.success === false) {
		throw new Error(payload.error || `请求失败: ${response.status}`);
	}
	return payload.data === undefined ? payload : payload.data;
}

function clearEmptyState() {
	const empty = chatLog.querySelector(".empty-state");
	if (empty) {
		empty.remove();
	}
}

// Markdown to HTML 解析器
function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function wrapAnsiText(text, classes) {
	const html = escapeHtml(text);
	return classes.length ? `<span class="${classes.join(" ")}">${html}</span>` : html;
}

function updateAnsiClasses(classes, codes) {
	const withoutFg = () => classes.filter((item) => !item.startsWith("ansi-fg-"));
	for (const code of codes.length ? codes : [0]) {
		if (code === 0) {
			classes = [];
		} else if (code === 1 && !classes.includes("ansi-bold")) {
			classes = [...classes, "ansi-bold"];
		} else if (code === 22) {
			classes = classes.filter((item) => item !== "ansi-bold");
		} else if (code === 39) {
			classes = withoutFg();
		} else {
			const colorMap = {
				30: "ansi-fg-black",
				31: "ansi-fg-red",
				32: "ansi-fg-green",
				33: "ansi-fg-yellow",
				34: "ansi-fg-blue",
				35: "ansi-fg-magenta",
				36: "ansi-fg-cyan",
				37: "ansi-fg-white",
				90: "ansi-fg-gray",
			};
			if (colorMap[code]) {
				classes = [...withoutFg(), colorMap[code]];
			}
		}
	}
	return classes;
}

function ansiToHtml(value) {
	const text = String(value ?? "");
	const regex = /\x1b\[([0-9;]*)m/g;
	let classes = [];
	let html = "";
	let lastIndex = 0;
	for (const match of text.matchAll(regex)) {
		html += wrapAnsiText(text.slice(lastIndex, match.index), classes);
		const codes = match[1].split(";").filter(Boolean).map((code) => Number(code));
		classes = updateAnsiClasses(classes, codes);
		lastIndex = match.index + match[0].length;
	}
	html += wrapAnsiText(text.slice(lastIndex), classes);
	return html;
}

function formatSize(bytes) {
	if (!Number.isFinite(bytes)) {
		return "0 B";
	}
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function editorFilePath(path) {
	if (!path) return "";
	if (path.startsWith("/")) return path;
	return `${state.currentCwd.replace(/\/$/, "")}/${path}`.replace(/\/+/g, "/");
}

function editorUri(scheme, path, line) {
	const absolute = editorFilePath(path);
	if (!absolute) return "";
	const suffix = line ? `:${line}` : "";
	return `${scheme}://file/${absolute}${suffix}`;
}

function parseCodeFenceInfo(info) {
	const parts = String(info || "").trim().split(/\s+/).filter(Boolean);
	const lang = parts[0] && !parts[0].includes("/") ? parts[0] : "";
	const path = parts.find((part) => part.includes("/") || part.includes(".")) || "";
	return { lang, path };
}

function highlightCode(code, lang) {
	let html = escapeHtml(code);
	if (/^(js|jsx|ts|tsx|javascript|typescript|json|css|html|bash|shell|sh)$/.test(lang || "")) {
		html = html
			.replace(/(&quot;[^&]*?&quot;|'[^']*?'|`[^`]*?`)/g, '<span class="tok-string">$1</span>')
			.replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|await|async|try|catch|throw|new|type|interface|extends)\b/g, '<span class="tok-keyword">$1</span>')
			.replace(/(\/\/.*?$|#.*?$)/gm, '<span class="tok-comment">$1</span>');
	}
	return html;
}

function numberedCodeHtml(code, lang = "", startLine = 1) {
	const lines = String(code ?? "").split("\n");
	return lines
		.map((line, index) => {
			const lineNo = startLine + index;
			return `<span class="code-line"><span class="code-line-no">${lineNo}</span><span class="code-line-text">${highlightCode(line, lang)}</span></span>`;
		})
		.join("");
}

function renderCodeBlock(info, code) {
	const { lang, path } = parseCodeFenceInfo(info);
	const openLinks = path
		? `<a class="open-code-link" href="${escapeHtml(editorUri("vscode", path))}">VS Code</a><a class="open-code-link" href="${escapeHtml(editorUri("cursor", path))}">Cursor</a>`
		: "";
	return `<div class="code-block-wrapper">
		<div class="code-block-header">
			<span class="code-block-lang">${escapeHtml(lang || "code")}${path ? ` · ${escapeHtml(path)}` : ""}</span>
			<div class="code-block-actions">
				${openLinks}
				<button class="copy-code-btn" type="button" data-code="${escapeHtml(code)}">复制</button>
			</div>
		</div>
		<pre><code class="${lang ? `language-${escapeHtml(lang)}` : ""}">${numberedCodeHtml(code, lang)}</code></pre>
	</div>`;
}

function formatInlineMarkdown(text) {
	const inlineCodes = [];
	let html = escapeHtml(text).replace(/`([^`\n]+)`/g, (_match, code) => {
		const key = `@@INLINE_${inlineCodes.length}@@`;
		inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
		return key;
	});
	html = html
		.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
	for (let i = 0; i < inlineCodes.length; i++) {
		html = html.replace(`@@INLINE_${i}@@`, inlineCodes[i]);
	}
	return html;
}

function isTableSeparator(line) {
	return /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(line);
}

function tableCells(line) {
	return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderTable(lines) {
	const headers = tableCells(lines[0]);
	const rows = lines.slice(2).map(tableCells);
	return `<table><thead><tr>${headers.map((cell) => `<th>${formatInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows
		.map((row) => `<tr>${row.map((cell) => `<td>${formatInlineMarkdown(cell)}</td>`).join("")}</tr>`)
		.join("")}</tbody></table>`;
}

function renderList(lines) {
	const ordered = /^\s*\d+\.\s+/.test(lines[0]);
	const tag = ordered ? "ol" : "ul";
	const items = lines.map((line) => {
		const match = line.match(/^\s*(?:[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?(.+)$/);
		const checked = match?.[1] ? /x/i.test(match[1]) : undefined;
		const checkbox = checked === undefined ? "" : `<input type="checkbox" disabled ${checked ? "checked" : ""} /> `;
		return `<li>${checkbox}${formatInlineMarkdown(match?.[2] || line.trim())}</li>`;
	});
	return `<${tag}>${items.join("")}</${tag}>`;
}

function formatMarkdown(text) {
	if (!text) return "";
	const codeBlocks = [];
	const withoutCode = String(text).replace(/```([^\n]*)\n([\s\S]*?)```/g, (_match, info, code) => {
		const key = `@@CODE_${codeBlocks.length}@@`;
		codeBlocks.push(renderCodeBlock(info, code.replace(/\n$/, "")));
		return key;
	});
	const lines = withoutCode.split(/\r?\n/);
	const blocks = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim()) continue;
		if (/^@@CODE_\d+@@$/.test(line.trim())) {
			blocks.push(line.trim());
			continue;
		}
		const heading = line.match(/^(#{1,6})\s+(.+)$/);
		if (heading) {
			const level = heading[1].length;
			blocks.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
			continue;
		}
		if (/^\s*---+\s*$/.test(line)) {
			blocks.push("<hr />");
			continue;
		}
		if (/^\s*>/.test(line)) {
			const quote = [];
			while (i < lines.length && /^\s*>/.test(lines[i])) {
				quote.push(lines[i].replace(/^\s*>\s?/, ""));
				i++;
			}
			i--;
			blocks.push(`<blockquote>${formatMarkdown(quote.join("\n"))}</blockquote>`);
			continue;
		}
		if (i + 1 < lines.length && line.includes("|") && isTableSeparator(lines[i + 1])) {
			const tableLines = [line, lines[i + 1]];
			i += 2;
			while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
				tableLines.push(lines[i]);
				i++;
			}
			i--;
			blocks.push(renderTable(tableLines));
			continue;
		}
		if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
			const listLines = [line];
			while (i + 1 < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i + 1])) {
				i++;
				listLines.push(lines[i]);
			}
			blocks.push(renderList(listLines));
			continue;
		}
		const paragraph = [line];
		while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#{1,6})\s+/.test(lines[i + 1]) && !/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i + 1]) && !/^@@CODE_\d+@@$/.test(lines[i + 1].trim())) {
			i++;
			paragraph.push(lines[i]);
		}
		blocks.push(`<p>${formatInlineMarkdown(paragraph.join("\n"))}</p>`);
	}
	let html = blocks.join("\n");
	for (let i = 0; i < codeBlocks.length; i++) {
		html = html.replace(`@@CODE_${i}@@`, codeBlocks[i]);
	}
	return html;
}

// 渲染 ContentBlock 到气泡消息框中
function parseThinkingSignature(signature) {
	if (!signature || !signature.startsWith("{")) {
		return undefined;
	}
	try {
		return JSON.parse(signature);
	} catch {
		return undefined;
	}
}

function textFromThinkingParts(parts) {
	if (!Array.isArray(parts)) {
		return "";
	}
	return parts
		.map((part) => {
			if (!part || typeof part !== "object") {
				return "";
			}
			return typeof part.text === "string" ? part.text : "";
		})
		.filter(Boolean)
		.join("\n\n");
}

function thinkingDisplayText(block) {
	if (block.thinking && block.thinking.trim()) {
		return block.thinking;
	}
	const signature = parseThinkingSignature(block.thinkingSignature);
	const summary = textFromThinkingParts(signature?.summary);
	if (summary) {
		return summary;
	}
	return textFromThinkingParts(signature?.content);
}

function thinkingPlaceholderText(block) {
	if (block.redacted) {
		return "明文思考已隐藏。";
	}
	const signature = parseThinkingSignature(block.thinkingSignature);
	if (signature?.encrypted_content) {
		return "加密思考已保存。";
	}
	return "暂无可展示摘要。";
}

function thinkingPrivacyInfo(block) {
	if (block.redacted) {
		return {
			icon: "隐藏",
			title: "模型返回了思考块，但明文内容被安全策略隐藏。",
		};
	}
	const signature = parseThinkingSignature(block.thinkingSignature);
	if (signature?.encrypted_content) {
		return {
			icon: "加密",
			title: "模型返回了加密思考内容，已保存用于后续上下文续接，但这次没有可展示的明文摘要。",
		};
	}
	return undefined;
}

function formatDuration(ms) {
	if (!Number.isFinite(ms) || ms <= 0) {
		return "0s";
	}
	if (ms < 1000) {
		return `${ms}ms`;
	}
	const seconds = Math.round(ms / 100) / 10;
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const rest = Math.round(seconds % 60);
	return `${minutes}m ${rest}s`;
}

function currentThinkingElapsedMs() {
	if (state.currentAgentStartedAt) {
		return Date.now() - state.currentAgentStartedAt;
	}
	return state.lastAgentElapsedMs;
}

function thinkingMetaText(tokenEstimate) {
	const pieces = [tokenEstimate ? `${tokenEstimate} token 估算` : "摘要不可见"];
	const elapsedMs = currentThinkingElapsedMs();
	if (elapsedMs !== undefined) {
		pieces.push(`${state.isStreaming ? "已用" : "总用"} ${formatDuration(elapsedMs)}`);
	}
	return pieces.join(" · ");
}

function renderMessageContent(container, content, role) {
	container.innerHTML = "";
	if (!content) return;

	const blocks = Array.isArray(content) ? content : [{ type: "text", text: content }];
	for (const block of blocks) {
		if (block.type === "text") {
			const textDiv = document.createElement("div");
			textDiv.className = "text-block";
			textDiv.innerHTML = formatMarkdown(block.text || "");
			container.appendChild(textDiv);
		} else if (block.type === "thinking") {
			const thinkingText = thinkingDisplayText(block);
			const shouldRender = Boolean(thinkingText || block.thinkingSignature || block.redacted);
			if (shouldRender) {
				const thinkingBlock = document.createElement("details");
				thinkingBlock.className = "thinking-block";
				if (!thinkingText) {
					thinkingBlock.classList.add("thinking-block-empty");
				}

				const summary = document.createElement("summary");
				summary.className = "thinking-header";
				const tokenEstimate = thinkingText ? Math.max(1, Math.ceil(thinkingText.length / 4)) : 0;
				const privacy = thinkingPrivacyInfo(block);
				const privacyBadge = privacy
					? `<span class="thinking-privacy" title="${escapeHtml(privacy.title)}">${escapeHtml(privacy.icon)}</span>`
					: "";
				summary.innerHTML = `<span class="thinking-icon">🧠</span> <span>思考过程</span>${privacyBadge}<span class="thinking-meta">${thinkingMetaText(tokenEstimate)}</span><span class="thinking-state-label">已收起</span>`;
				const stateLabel = summary.querySelector(".thinking-state-label");
				thinkingBlock.addEventListener("toggle", () => {
					if (stateLabel) {
						stateLabel.textContent = thinkingBlock.open ? "已展开" : "已收起";
					}
				});

				const body = document.createElement("div");
				body.className = "thinking-content";
				body.textContent = thinkingText || thinkingPlaceholderText(block);

				thinkingBlock.append(summary, body);
				container.appendChild(thinkingBlock);
			}
		} else if (block.type === "image") {
			const imgBlock = document.createElement("div");
			imgBlock.className = "image-block";
			const img = document.createElement("img");
			img.src = `data:${block.mimeType};base64,${block.data}`;
			img.alt = "附加图片";
			imgBlock.appendChild(img);
			container.appendChild(imgBlock);
		} else if (block.type === "toolCall") {
			const toolCallDiv = document.createElement("div");
			toolCallDiv.className = "tool-call-block";
			toolCallDiv.innerHTML = `<span class="tool-call-icon">🛠️</span> 调用: <code>${block.name}</code>`;
			container.appendChild(toolCallDiv);
		}
	}
}

function messagePlainText(content) {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return "";
	}
	return content
		.map((block) => {
			if (!block || typeof block !== "object") return "";
			if (block.type === "text") return block.text || "";
			if (block.type === "thinking") return thinkingDisplayText(block) || "";
			return "";
		})
		.filter(Boolean)
		.join("\n\n");
}

function addMessage(role, content, options = {}) {
	clearEmptyState();
	const row = document.createElement("article");
	row.className = `message ${role}${options.thinking ? " thinking" : ""}`;

	const speaker = document.createElement("div");
	speaker.className = "speaker";

	let avatarHTML = "";
	if (role === "user") {
		avatarHTML = `<div class="avatar user-avatar">我</div>`;
	} else {
		avatarHTML = `<div class="avatar assistant-avatar">π</div>`;
	}
	speaker.innerHTML = avatarHTML + `<span class="speaker-label">${options.label || role}</span>`;

	const bubble = document.createElement("div");
	bubble.className = "bubble";
	renderMessageContent(bubble, content, role);

	// 追加悬浮快捷消息操作菜单（一键复制气泡纯文本内容）
	const toolbar = document.createElement("div");
	toolbar.className = "message-toolbar";

	const copyBtn = document.createElement("button");
	copyBtn.className = "msg-action-btn";
	copyBtn.title = "复制全文";
	copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
	copyBtn.addEventListener("click", () => {
		// 复制除去 toolbar 文本的内容
		const textToCopy = Array.from(bubble.querySelectorAll(".text-block, .thinking-content"))
			.map(el => el.innerText)
			.join("\n\n") || bubble.innerText;
		navigator.clipboard.writeText(textToCopy);

		const originalSVG = copyBtn.innerHTML;
		copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
		setTimeout(() => {
			copyBtn.innerHTML = originalSVG;
		}, 1500);
	});

	toolbar.appendChild(copyBtn);
	if (role === "user") {
		const editBtn = document.createElement("button");
		editBtn.className = "msg-action-btn";
		editBtn.title = "编辑后重发";
		editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
		editBtn.addEventListener("click", () => {
			promptInput.value = messagePlainText(content);
			promptInput.focus();
			promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
		});
		const resendBtn = document.createElement("button");
		resendBtn.className = "msg-action-btn";
		resendBtn.title = "重发这条消息";
		resendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
		resendBtn.addEventListener("click", () => {
			promptInput.value = messagePlainText(content);
			sendPrompt().catch((error) => addEvent(error.message, "error"));
		});
		toolbar.append(editBtn, resendBtn);
	}
	bubble.appendChild(toolbar);

	row.append(speaker, bubble);
	chatLog.append(row);
	chatLog.scrollTop = chatLog.scrollHeight;
	return { row, bubble };
}

function renderMessages(messages) {
	chatLog.innerHTML = "";
	state.currentAssistant = undefined;
	state.tools.clear();
	if (!messages.length) {
		const empty = document.createElement("div");
		empty.className = "empty-state";
		empty.innerHTML = `
			<img class="empty-illustration" src="/assets/mikan-empty-state.png" alt="正在待命的橘猫助手" width="228" height="152" />
			<div class="empty-title">随时可以开始</div>
			<p>向 Pi 提问，让它分析文件、编写代码、运行本地命令，或者为您规划本地代码库的大型重构。</p>
		`;
		chatLog.append(empty);
		return;
	}
	for (const message of messages) {
		if (message.role === "user") {
			addMessage("user", message.content, { label: "你" });
		} else if (message.role === "assistant") {
			addMessage("assistant", message.content, { label: "Pi" });
		} else if (message.role === "toolResult") {
			renderToolCard(message.toolName || "tool", message.toolCallId || crypto.randomUUID(), {}, {
				content: message.content || [],
				isError: message.isError,
			});
		}
	}
}

function lineRangeFromArgs(args) {
	const offset = Number.isFinite(args?.offset) ? args.offset : 1;
	if (!Number.isFinite(args?.limit)) {
		return offset ? `${offset}+` : "";
	}
	return `${offset}-${offset + args.limit - 1}`;
}

function renderDiffHtml(diff) {
	return String(diff || "")
		.split("\n")
		.map((line) => {
			const cls = line.startsWith("+") ? "diff-add" : line.startsWith("-") ? "diff-remove" : line.startsWith("@@") ? "diff-hunk" : "";
			return `<span class="${cls}">${escapeHtml(line)}</span>`;
		})
		.join("\n");
}

function renderGrepSummary(text) {
	const groups = new Map();
	for (const line of String(text || "").split("\n")) {
		const match = line.match(/^([^:\n]+):(\d+):(.*)$/);
		if (!match) continue;
		const list = groups.get(match[1]) || [];
		list.push({ line: match[2], text: match[3] });
		groups.set(match[1], list);
	}
	if (groups.size === 0) {
		return `<pre class="tool-output-pre">${escapeHtml(text)}</pre>`;
	}
	const sections = [];
	for (const [file, hits] of groups.entries()) {
		sections.push(`<details class="grep-file-group" open><summary>${escapeHtml(file)} · ${hits.length} 命中</summary>${hits
			.map((hit) => `<div class="grep-hit"><span>${escapeHtml(hit.line)}</span><code>${escapeHtml(hit.text)}</code></div>`)
			.join("")}</details>`);
	}
	return `<div class="tool-summary-line">共 ${Array.from(groups.values()).reduce((sum, hits) => sum + hits.length, 0)} 处命中，分布在 ${groups.size} 个文件。</div>${sections.join("")}`;
}

function renderToolBody(name, args, result) {
	const text = toolResultText(result);
	if (!result) {
		return `<pre class="tool-output-pre">${escapeHtml(JSON.stringify(args || {}, null, 2))}</pre>`;
	}
	if (name === "read") {
		const path = args?.path || args?.file_path || "";
		const startLine = Number.isFinite(args?.offset) ? args.offset : 1;
		return `<div class="tool-summary-line"><strong>${escapeHtml(path || "read")}</strong>${lineRangeFromArgs(args) ? ` · lines ${escapeHtml(lineRangeFromArgs(args))}` : ""}</div><pre class="tool-output-pre code-with-lines">${numberedCodeHtml(text, "", startLine)}</pre>`;
	}
	if (name === "edit") {
		const path = args?.path || "";
		const diff = result.details?.patch || result.details?.diff || text;
		const line = result.details?.firstChangedLine;
		const links = path
			? `<a href="${escapeHtml(editorUri("vscode", path, line))}">VS Code</a><a href="${escapeHtml(editorUri("cursor", path, line))}">Cursor</a>`
			: "";
		return `<div class="tool-summary-line"><strong>${escapeHtml(path || "edit")}</strong><span class="tool-open-links">${links}</span></div><pre class="tool-output-pre diff-pre">${renderDiffHtml(diff)}</pre>`;
	}
	if (name === "bash") {
		const command = args?.command || "";
		const fullOutput = result.details?.fullOutputPath ? `<div class="tool-summary-line">完整输出: <code>${escapeHtml(result.details.fullOutputPath)}</code></div>` : "";
		return `<div class="tool-summary-line"><strong>$</strong> <code>${escapeHtml(command)}</code></div><pre class="tool-output-pre bash-pre">${escapeHtml(text)}</pre>${fullOutput}`;
	}
	if (name === "grep") {
		return renderGrepSummary(text);
	}
	return `<pre class="tool-output-pre">${escapeHtml(text || JSON.stringify(args || {}, null, 2))}</pre>`;
}

function renderToolCard(name, id, args, result) {
	clearEmptyState();
	let card = state.tools.get(id);
	if (!card) {
		card = document.createElement("section");
		card.className = "tool-card collapsed";
		const head = document.createElement("button");
		head.className = "tool-head";
		head.type = "button";
		head.innerHTML = `
			<span class="tool-title">🛠️ ${name}</span>
			<div class="tool-badge-status">
				<span class="tool-status-dot tool-status-running"></span>
				<span class="tool-status-text">运行中</span>
			</div>
		`;
		const body = document.createElement("div");
		body.className = "tool-body";
		head.addEventListener("click", () => card.classList.toggle("collapsed"));
		card.append(head, body);
		state.tools.set(id, card);
		chatLog.append(card);
	}

	const status = result ? (result.isError ? "error" : "done") : "running";
	const statusTextZH = status === "running" ? "运行中" : (status === "done" ? "已完成" : "错误");
	const badge = card.querySelector(".tool-badge-status");
	if (badge) {
		badge.querySelector(".tool-status-dot").className = `tool-status-dot tool-status-${status}`;
		badge.querySelector(".tool-status-text").textContent = statusTextZH;
	}

	card.querySelector(".tool-title").textContent = `🛠️ ${name}`;
	scheduleToolBodyRender(id, card, renderToolBody(name, args, result));
	chatLog.scrollTop = chatLog.scrollHeight;
	return card;
}

function scheduleToolBodyRender(id, card, html) {
	if (card._lastToolBodyHtml === html || state.pendingToolBodies.get(id)?.html === html) {
		return;
	}
	state.pendingToolBodies.set(id, { card, html });
	if (state.toolRenderFrame) {
		return;
	}
	state.toolRenderFrame = requestAnimationFrame(() => {
		state.toolRenderFrame = undefined;
		for (const [toolId, pending] of state.pendingToolBodies.entries()) {
			state.pendingToolBodies.delete(toolId);
			if (pending.card._lastToolBodyHtml === pending.html) {
				continue;
			}
			pending.card._lastToolBodyHtml = pending.html;
			pending.card.querySelector(".tool-body").innerHTML = pending.html;
		}
		chatLog.scrollTop = chatLog.scrollHeight;
	});
}

function toolResultText(result) {
	if (!result || !Array.isArray(result.content)) {
		return "";
	}
	const text = result.content
		.map((block) => {
			if (block.type === "text") return block.text || "";
			if (block.type === "image") return `[图片:${block.mimeType || "未知"}]`;
			return JSON.stringify(block);
		})
		.join("\n");
	const details = result.details ? `\n\n${JSON.stringify(result.details, null, 2)}` : "";
	return `${text}${details}`.trim();
}

function toggleStreamingState(isStreaming) {
	state.isStreaming = isStreaming;
	const stopBtn = document.getElementById("stopBtn");
	if (isStreaming) {
		stopBtn.classList.remove("hidden");
		connectionLabel.textContent = "运行中";
		connectionLabel.className = "status-pill state-working";
	} else {
		stopBtn.classList.add("hidden");
		connectionLabel.textContent = "就绪";
		connectionLabel.className = "status-pill state-ready";
		// 结束流式输出时自动隐藏悬浮滚底提示
		state.unreadStreamEvents = 0;
		scrollBottomBadge.querySelector("span").textContent = "↓ 智能体正在输入...";
		scrollBottomBadge.classList.add("hidden");
	}
}

// 修改双击重命名会话名交互逻辑
sessionName.addEventListener("dblclick", startRenameSession);

function startRenameSession() {
	if (sessionName.querySelector("input")) return;

	const currentText = sessionName.querySelector("span")?.textContent || sessionName.textContent.trim();
	sessionName.innerHTML = "";

	const input = document.createElement("input");
	input.className = "session-name-input";
	input.value = currentText;
	sessionName.appendChild(input);
	input.focus();
	input.select();

	const finishRename = async () => {
		const newName = input.value.trim();
		if (newName && newName !== currentText) {
			try {
				await api("/api/session/name", { method: "POST", body: JSON.stringify({ name: newName }) });
				addEvent(`会话已重命名为: ${newName}`, "system");
				refreshState().catch((error) => addEvent(error.message, "error"));
			} catch (error) {
				addEvent(`会话重命名失败: ${error.message}`, "error");
			}
		}

		sessionName.innerHTML = `
			<span>${newName || currentText}</span>
			<svg class="inline-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
		`;
	};

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			input.blur();
		} else if (e.key === "Escape") {
			input.value = currentText;
			input.blur();
		}
	});
	input.addEventListener("blur", finishRename);
}

function updateStateView(data) {
	toggleStreamingState(Boolean(data.isStreaming));
	state.currentModel = data.model;

	// 如果非重命名编辑状态，则用后台回传的新名称更新
	if (!sessionName.querySelector("input")) {
		const displayName = data.sessionName || "当前会话";
		sessionName.innerHTML = `
			<span>${displayName}</span>
			<svg class="inline-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
		`;
	}

	sessionFile.textContent = data.sessionFile || data.sessionId || "暂无会话文件";
	sessionFile.title = data.sessionFile || data.sessionId || "暂无会话文件";

	messageMetric.textContent = String(data.messageCount ?? 0);
	queueMetric.textContent = String(data.pendingMessageCount ?? 0);
	state.currentCwd = data.cwd || "";
	cwdLabel.textContent = state.currentCwd || "未设置工作目录";
	cwdLabel.title = state.currentCwd || "未设置工作目录";
	if (data.model) {
		modelSelect.value = `${data.model.provider}/${data.model.id}`;
	}
	if (data.thinkingLevel) {
		thinkingSelect.value = data.thinkingLevel;
	}
	contextMetric.textContent = data.autoCompactionEnabled ? "自动" : "手动";
	updateThinkingAvailability();
}

async function refreshState() {
	const [rpcState, messages, stats] = await Promise.all([api("/api/state"), api("/api/messages"), api("/api/session/stats").catch(() => undefined)]);
	updateStateView(rpcState);
	if (stats) {
		renderSessionStats(stats);
	}
	renderMessages(messages.messages || []);
}

function renderSessionStats(stats) {
	if (!sessionStats) return;
	const total = stats.tokens?.total ?? 0;
	const input = stats.tokens?.input ?? 0;
	const output = stats.tokens?.output ?? 0;
	const cost = Number(stats.cost ?? 0);
	sessionStats.innerHTML = `
		<span class="stat-chip stat-tokens" title="本会话累计 tokens 总数"><strong>${total.toLocaleString()}</strong> tokens</span>
		<span class="stat-chip stat-in" title="输入 tokens">↓ ${input.toLocaleString()}</span>
		<span class="stat-chip stat-out" title="输出 tokens">↑ ${output.toLocaleString()}</span>
		<span class="stat-chip stat-cost" title="估算成本">$${cost.toFixed(4)}</span>
	`;
	sessionStats.title = `cache read ${stats.tokens?.cacheRead ?? 0}, cache write ${stats.tokens?.cacheWrite ?? 0}`;
}

async function refreshModels() {
	const data = await api("/api/models");
	state.models = data.models || [];
	renderModelOptions();
}

function formatContextWindow(value) {
	if (!value) return "";
	if (value >= 1000000) return `${Math.round(value / 1000000)}M ctx`;
	if (value >= 1000) return `${Math.round(value / 1000)}K ctx`;
	return `${value} ctx`;
}

function modelMetaText(model) {
	const pieces = [formatContextWindow(model.contextWindow)];
	if (model.input?.includes("image")) pieces.push("image");
	if (model.reasoning) pieces.push("thinking");
	return pieces.filter(Boolean).join(" · ");
}

function renderModelOptions() {
	const previous = modelSelect.value;
	const query = modelSearchInput?.value.trim().toLowerCase() || "";
	modelSelect.innerHTML = "";
	const byProvider = new Map();
	for (const model of state.models) {
		const haystack = `${model.provider} ${model.id} ${model.name || ""}`.toLowerCase();
		if (query && !haystack.includes(query)) {
			continue;
		}
		const group = byProvider.get(model.provider) || [];
		group.push(model);
		byProvider.set(model.provider, group);
	}
	const sortedProviders = Array.from(byProvider.keys()).sort((a, b) => a.localeCompare(b));
	for (const provider of sortedProviders) {
		const models = byProvider.get(provider).sort((a, b) => {
			const contextDelta = (b.contextWindow || 0) - (a.contextWindow || 0);
			if (contextDelta !== 0) return contextDelta;
			return (a.name || a.id).localeCompare(b.name || b.id);
		});
		const group = document.createElement("optgroup");
		group.label = provider;
		for (const model of models) {
			const option = document.createElement("option");
			option.value = `${model.provider}/${model.id}`;
			const meta = modelMetaText(model);
			option.textContent = `${model.name || model.id}${meta ? ` · ${meta}` : ""}`;
			group.append(option);
		}
		modelSelect.append(group);
	}
	if (previous && Array.from(modelSelect.options).some((option) => option.value === previous)) {
		modelSelect.value = previous;
	} else if (state.currentModel) {
		const currentValue = `${state.currentModel.provider}/${state.currentModel.id}`;
		if (Array.from(modelSelect.options).some((option) => option.value === currentValue)) {
			modelSelect.value = currentValue;
		}
	}
	updateThinkingAvailability();
}

function syncThinkingOffForUnsupportedModel(modelValue) {
	if (!modelValue || state.lastThinkingOffSyncModelValue === modelValue) {
		return;
	}
	state.lastThinkingOffSyncModelValue = modelValue;
	api("/api/thinking", { method: "POST", body: JSON.stringify({ level: "off" }) }).catch((error) => {
		state.lastThinkingOffSyncModelValue = undefined;
		addEvent(`同步关闭 thinking 失败: ${error.message}`, "error");
	});
}

function updateThinkingAvailability() {
	const currentValue = modelSelect.value || (state.currentModel ? `${state.currentModel.provider}/${state.currentModel.id}` : "");
	const current = state.models.find((model) => `${model.provider}/${model.id}` === currentValue) || state.currentModel;
	const supportsThinking = Boolean(current?.reasoning);
	for (const option of thinkingSelect.options) {
		option.disabled = option.value !== "off" && !supportsThinking;
	}
	if (!supportsThinking && thinkingSelect.value !== "off") {
		thinkingSelect.value = "off";
		syncThinkingOffForUnsupportedModel(currentValue);
	}
	thinkingSelect.title = supportsThinking ? "该模型支持 thinking" : "该模型不支持 thinking，已禁用深度思考";
}

async function refreshCommands() {
	const data = await api("/api/commands");
	state.commands = data.commands || [];
}

function connectEvents() {
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	const socket = new WebSocket(`${protocol}//${location.host}/api/events`);
	state.socket = socket;
	socket.addEventListener("open", () => {
		state.reconnectDelayMs = 1200;
		connectionLabel.textContent = "已连接";
		connectionLabel.className = "status-pill state-ready";
		addEvent("WebSocket 事件服务器连接已建立", "system");
	});
	socket.addEventListener("close", () => {
		connectionLabel.textContent = "连接断开";
		connectionLabel.className = "status-pill state-disconnected";
		const delay = state.reconnectDelayMs;
		if (delay <= 1200) {
			addEvent("WebSocket 链路已断开，正在自动重连...", "system");
		}
		window.clearTimeout(state.reconnectTimer);
		state.reconnectTimer = window.setTimeout(connectEvents, delay);
		state.reconnectDelayMs = Math.min(delay * 2, 30000);
	});
	socket.addEventListener("message", (event) => {
		const envelope = JSON.parse(event.data);
		handleEnvelope(envelope);
	});
}

function handleEnvelope(envelope) {
	if (envelope.type === "web_status") {
		if (envelope.role === "observer") {
			observerWarning.classList.remove("hidden");
			addEvent("当前浏览器窗口是观察者：此 Web 服务仍共享同一个 RPC 会话。", "system");
		} else if (envelope.role === "owner") {
			observerWarning.classList.add("hidden");
			addEvent("当前浏览器窗口是会话 owner。", "system");
		}
		return;
	}
	if (envelope.type === "auth_oauth_update") {
		handleOAuthUpdate(envelope);
		return;
	}
	if (envelope.type === "bridge_status") {
		const statusText = envelope.status === "ready" ? "就绪" : (envelope.status === "working" ? "运行中" : envelope.status);
		connectionLabel.textContent = statusText;
		connectionLabel.className = "status-pill state-" + envelope.status;
		addEvent(`RPC 连接服务状态转换为: ${statusText}`, "system");
		return;
	}
	if (envelope.type === "bridge_error") {
		addEvent(envelope.error, "error");
		return;
	}
	if (envelope.type === "bridge_stderr") {
		addEvent(envelope.text.trim(), "error");
		return;
	}
	if (envelope.type === "rpc_message") {
		handleRpcMessage(envelope.message);
	}
}

function handleRpcMessage(message) {
	if (message.type === "extension_ui_request") {
		handleExtensionRequest(message);
		return;
	}
	if (message.type === "agent_start") {
		state.currentAgentStartedAt = Date.now();
		state.lastAgentElapsedMs = undefined;
		toggleStreamingState(true);
		addEvent(`AI 任务已启动，模型: ${state.currentModel?.id || '未知'}`, "agent");
		return;
	}
	if (message.type === "agent_end") {
		if (state.currentAgentStartedAt) {
			state.lastAgentElapsedMs = Date.now() - state.currentAgentStartedAt;
			state.currentAgentStartedAt = undefined;
		}
		toggleStreamingState(false);
		flushAssistantRender();
		if (state.currentAssistant && state.currentAssistantContent) {
			renderMessageContent(state.currentAssistant.bubble, state.currentAssistantContent, "assistant");
		}
		addEvent(`AI 任务已顺利结束`, "agent");
		refreshState().catch((error) => addEvent(error.message, "error"));
		return;
	}
	if (message.type === "queue_update") {
		queueMetric.textContent = String((message.steering?.length || 0) + (message.followUp?.length || 0));
		return;
	}
	if (message.type === "message_start") {
		handleMessageStart(message.message);
		return;
	}
	if (message.type === "message_update") {
		handleMessageUpdate(message.message);
		return;
	}
	if (message.type === "message_end") {
		handleMessageUpdate(message.message, { immediate: true });
		return;
	}
	if (message.type === "tool_execution_start") {
		renderToolCard(message.toolName, message.toolCallId, message.args);
		addEvent(`[工具运行] 启动调用: ${message.toolName}`, "tool");
		return;
	}
	if (message.type === "tool_execution_update") {
		renderToolCard(message.toolName, message.toolCallId, message.args, message.partialResult);
		return;
	}
	if (message.type === "tool_execution_end") {
		renderToolCard(message.toolName, message.toolCallId, message.args, {
			...(message.result || {}),
			isError: message.isError,
		});
		addEvent(`[工具运行] 调用结束: ${message.toolName} (${message.isError ? '错误' : '成功'})`, "tool");
	}
}

function handleMessageStart(message) {
	if (message.role === "user") {
		addMessage("user", message.content, { label: "你" });
	} else if (message.role === "assistant") {
		state.currentAssistantContent = message.content;
		state.currentAssistant = addMessage("assistant", message.content, { label: "Pi" });
	}
}

function flushAssistantRender() {
	if (state.assistantRenderFrame) {
		cancelAnimationFrame(state.assistantRenderFrame);
		state.assistantRenderFrame = undefined;
	}
	if (!state.currentAssistant || state.pendingAssistantContent === undefined) {
		return;
	}
	renderMessageContent(state.currentAssistant.bubble, state.pendingAssistantContent, "assistant");
	state.currentAssistantContent = state.pendingAssistantContent;
	state.pendingAssistantContent = undefined;

	if (state.pendingAssistantStickToBottom) {
		state.unreadStreamEvents = 0;
		chatLog.scrollTop = chatLog.scrollHeight;
	} else if (state.isStreaming) {
		state.unreadStreamEvents += 1;
		scrollBottomBadge.querySelector("span").textContent = `↓ 新消息 ${state.unreadStreamEvents} 条`;
		scrollBottomBadge.classList.remove("hidden");
	}
	state.pendingAssistantStickToBottom = false;
}

function scheduleAssistantRender(content, wasNearBottom, immediate = false) {
	state.pendingAssistantContent = content;
	state.pendingAssistantStickToBottom = state.pendingAssistantStickToBottom || wasNearBottom;
	if (immediate) {
		flushAssistantRender();
		return;
	}
	if (state.assistantRenderFrame) {
		return;
	}
	state.assistantRenderFrame = requestAnimationFrame(() => {
		state.assistantRenderFrame = undefined;
		flushAssistantRender();
	});
}

function handleMessageUpdate(message, options = {}) {
	if (!message || message.role !== "assistant") {
		return;
	}

	// 判断用户是否在翻看历史消息（距离底部大于 150px）
	const threshold = 150;
	const wasNearBottom = chatLog.scrollHeight - chatLog.clientHeight - chatLog.scrollTop < threshold;

	state.currentAssistantContent = message.content;
	if (!state.currentAssistant) {
		state.currentAssistant = addMessage("assistant", message.content, { label: "Pi" });
	} else {
		scheduleAssistantRender(message.content, wasNearBottom, Boolean(options.immediate));
		return;
	}

	// 如果用户原先就处于页面底部，则跟随向下滚动，否则显示悬浮指示气泡
	if (wasNearBottom) {
		state.unreadStreamEvents = 0;
		chatLog.scrollTop = chatLog.scrollHeight;
	} else if (state.isStreaming) {
		state.unreadStreamEvents += 1;
		scrollBottomBadge.querySelector("span").textContent = `↓ 新消息 ${state.unreadStreamEvents} 条`;
		scrollBottomBadge.classList.remove("hidden");
	}
}

// 绑定对话框滚动事件监听以实时更新悬浮滚底指示器
chatLog.addEventListener("scroll", () => {
	const threshold = 150;
	const isNearBottom = chatLog.scrollHeight - chatLog.clientHeight - chatLog.scrollTop < threshold;
	if (isNearBottom || !state.isStreaming) {
		state.unreadStreamEvents = 0;
		scrollBottomBadge.classList.add("hidden");
	}
});

// 点击浮动按钮平滑返回底部
scrollBottomBadge.addEventListener("click", () => {
	chatLog.scrollTo({
		top: chatLog.scrollHeight,
		behavior: "smooth"
	});
	state.unreadStreamEvents = 0;
	scrollBottomBadge.classList.add("hidden");
});

// 绑定一键双侧边栏收缩折叠按钮
toggleLeftBtn.addEventListener("click", () => {
	leftPanel.classList.toggle("collapsed");
	leftPanel.classList.toggle("show-responsive");
	toggleLeftBtn.classList.toggle("active");
});

// 侧边栏分组的可折叠交互 + 记忆到 localStorage
(function initSectionToggles() {
	const STORAGE_KEY = "pi-web:sidebar-collapsed";
	let collapsedSet = new Set();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) collapsedSet = new Set(JSON.parse(raw));
	} catch (_e) { /* ignore broken storage */ }

	function persist() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsedSet]));
		} catch (_e) { /* ignore quota / private-mode errors */ }
	}

	document.querySelectorAll(".section-toggle").forEach((btn) => {
		const key = btn.dataset.target;
		const section = btn.closest(".panel-section");
		if (!section) return;

		// 应用初始状态
		if (collapsedSet.has(key)) {
			section.classList.add("collapsed");
			btn.setAttribute("aria-expanded", "false");
		} else {
			btn.setAttribute("aria-expanded", "true");
		}

		btn.addEventListener("click", () => {
			const isCollapsed = section.classList.toggle("collapsed");
			btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
			if (isCollapsed) collapsedSet.add(key);
			else collapsedSet.delete(key);
			persist();
		});
	});
})();

toggleRightBtn.addEventListener("click", () => {
	rightPanel.classList.toggle("collapsed");
	rightPanel.classList.toggle("show-responsive");
	toggleRightBtn.classList.toggle("active");
});

function handleExtensionRequest(request) {
	if (request.method === "notify") {
		addEvent(`[智能体通知]: ${request.message || '无消息内容'}`, "agent");
		return;
	}
	if (request.method === "setStatus") {
		addEvent(`[状态更新]: ${request.statusText || '无状态描述'}`, "system");
		return;
	}
	if (request.method === "confirm") {
		showConfirm(request.id, request.title, request.message);
		return;
	}
	if (request.method === "select") {
		showSelect(request.id, request.title, request.options || []);
	}
}

function sendExtensionResponse(payload) {
	if (state.socket && state.socket.readyState === WebSocket.OPEN) {
		state.socket.send(JSON.stringify({ type: "extension_ui_response", ...payload }));
	}
}

function showConfirm(id, title, message) {
	modalTitle.textContent = title || "安全确认";
	modalMessage.textContent = message || "";
	modalOptions.innerHTML = "";
	modalBackdrop.classList.remove("hidden");
	modalConfirm.textContent = "允许执行";
	modalCancel.textContent = "拒绝";
	modalCancel.onclick = () => {
		modalBackdrop.classList.add("hidden");
		sendExtensionResponse({ id, cancelled: true });
	};
	modalConfirm.onclick = () => {
		modalBackdrop.classList.add("hidden");
		sendExtensionResponse({ id, confirmed: true });
	};
}

function showSelect(id, title, options) {
	modalTitle.textContent = title || "请选择";
	modalMessage.textContent = "";
	modalOptions.innerHTML = "";
	let selected = options[0] || "";
	for (const option of options) {
		const button = document.createElement("button");
		button.className = "btn btn-secondary";
		button.textContent = option;
		button.onclick = () => {
			selected = option;
			for (const child of modalOptions.children) child.classList.remove("active");
			button.classList.add("active");
		};
		modalOptions.append(button);
	}
	modalBackdrop.classList.remove("hidden");
	modalCancel.textContent = "取消";
	modalConfirm.textContent = "确定";
	modalCancel.onclick = () => {
		modalBackdrop.classList.add("hidden");
		sendExtensionResponse({ id, cancelled: true });
	};
	modalConfirm.onclick = () => {
		modalBackdrop.classList.add("hidden");
		sendExtensionResponse({ id, value: selected });
	};
}

function selectedChatText() {
	const selection = window.getSelection();
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
		return "";
	}
	const range = selection.getRangeAt(0);
	try {
		if (!range.intersectsNode(chatLog)) {
			return "";
		}
	} catch {
		return "";
	}
	return selection.toString().trim();
}

function exportFilename(extension, selected = false) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `pi-${selected ? "selection" : "session"}-${timestamp}.${extension}`;
}

function downloadTextFile(filename, text, mimeType) {
	const blob = new Blob([text], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chooseExportAction(selectionText) {
	return new Promise((resolve) => {
		const close = (action) => {
			modalBackdrop.classList.add("hidden");
			resolve(action);
		};
		modalTitle.textContent = "导出会话";
		modalMessage.textContent = selectionText
			? "检测到聊天区选中文本，可以只导出选区，也可以导出完整会话。"
			: "选择导出格式。HTML 会写入本地文件，Markdown 会直接下载。";
		modalOptions.innerHTML = "";
		const fullMarkdown = document.createElement("button");
		fullMarkdown.type = "button";
		fullMarkdown.className = "btn btn-secondary";
		fullMarkdown.textContent = "下载完整 Markdown";
		fullMarkdown.onclick = () => close("markdown");
		modalOptions.append(fullMarkdown);
		const selectedMarkdown = document.createElement("button");
		selectedMarkdown.type = "button";
		selectedMarkdown.className = "btn btn-secondary";
		selectedMarkdown.textContent = "下载选区 Markdown";
		selectedMarkdown.disabled = !selectionText;
		selectedMarkdown.title = selectionText ? "导出当前选中的聊天文本" : "先在聊天区选中一段内容";
		selectedMarkdown.onclick = () => close("selection-markdown");
		modalOptions.append(selectedMarkdown);
		modalBackdrop.classList.remove("hidden");
		modalCancel.textContent = "取消";
		modalConfirm.textContent = "导出 HTML";
		modalCancel.onclick = () => close(undefined);
		modalConfirm.onclick = () => close("html");
	});
}

function confirmPromptOverwrite(message) {
	return new Promise((resolve) => {
		const close = (confirmed) => {
			modalBackdrop.classList.add("hidden");
			resolve(confirmed);
		};
		modalTitle.textContent = "替换当前输入";
		modalMessage.textContent = message;
		modalOptions.innerHTML = "";
		modalBackdrop.classList.remove("hidden");
		modalCancel.textContent = "保留当前输入";
		modalConfirm.textContent = "替换";
		modalCancel.onclick = () => close(false);
		modalConfirm.onclick = () => close(true);
	});
}

async function exportMarkdownSession(selected = false) {
	const selectedText = selected ? selectedChatText() : "";
	const data = await api("/api/export/markdown", {
		method: "POST",
		body: JSON.stringify(selectedText ? { selectedText } : {}),
	});
	downloadTextFile(
		exportFilename("md", selected),
		data.markdown || "",
		"text/markdown;charset=utf-8",
	);
	addEvent(`Markdown 已下载：${formatSize(data.bytes || 0)}`, "system");
}

function setAuthStatus(text) {
	oauthStatus.textContent = text || "";
	if (text) {
		addEvent(text, "system");
	}
}

function selectedAuthProvider() {
	return state.authProviders.find((provider) => provider.id === authProviderSelect.value);
}

function updateAuthMethodView() {
	const provider = selectedAuthProvider();
	const supportsOAuth = Boolean(provider?.supportsOAuth);
	for (const option of authMethodSelect.options) {
		if (option.value === "oauth") {
			option.disabled = !supportsOAuth;
		}
	}
	if (!supportsOAuth && authMethodSelect.value === "oauth") {
		authMethodSelect.value = "api_key";
	}
	if (supportsOAuth && provider?.id === "openai-codex") {
		authMethodSelect.value = "oauth";
	}
	const oauthMode = authMethodSelect.value === "oauth";
	apiKeyField.classList.toggle("hidden", oauthMode);
	oauthPanel.classList.toggle("hidden", !oauthMode);
	document.getElementById("authSave").textContent = oauthMode ? "开始授权登录" : "保存密钥";
}

async function refreshAuthProviders() {
	const data = await api("/api/auth");
	state.authProviders = data.providers || [];
	const previous = authProviderSelect.value || "openai-codex";
	authProviderSelect.innerHTML = "";
	for (const provider of state.authProviders) {
		const option = document.createElement("option");
		option.value = provider.id;
		const source = provider.available
			? provider.credentialType === "oauth"
				? "oauth"
				: provider.source || "已配置"
			: "未配置";
		option.textContent = `${provider.name} (${provider.id}, ${source === "oauth" ? "OAuth" : source})`;
		authProviderSelect.append(option);
	}
	if (state.authProviders.some((provider) => provider.id === previous)) {
		authProviderSelect.value = previous;
	}
	updateAuthMethodView();
	return data;
}

async function openAuthModal() {
	authApiKeyInput.value = "";
	oauthLink.classList.add("hidden");
	oauthPromptGroup.classList.add("hidden");
	setAuthStatus("");
	await refreshAuthProviders();
	authModalBackdrop.classList.remove("hidden");
}

async function saveApiKeyAuth() {
	const provider = authProviderSelect.value;
	const apiKey = authApiKeyInput.value.trim();
	if (!provider || !apiKey) {
		setAuthStatus("服务商和 API 密钥是必填项。");
		return;
	}
	await api("/api/auth/key", {
		method: "POST",
		body: JSON.stringify({ provider, apiKey }),
	});
	authApiKeyInput.value = "";
	setAuthStatus("已成功保存 API 密钥。");
	await Promise.all([refreshAuthProviders(), refreshModels(), refreshState()]);
}

async function startOAuthLogin() {
	const provider = authProviderSelect.value;
	const data = await api("/api/auth/oauth/start", {
		method: "POST",
		body: JSON.stringify({ provider }),
	});
	state.currentOAuthJob = data.jobId;
	oauthLink.classList.add("hidden");
	oauthPromptGroup.classList.add("hidden");
	setAuthStatus(`已启动 ${data.providerName} 授权登录。`);
}

function handleOAuthUpdate(update) {
	if (state.currentOAuthJob && update.jobId !== state.currentOAuthJob) {
		return;
	}
	authModalBackdrop.classList.remove("hidden");
	state.currentOAuthJob = update.jobId;
	if (update.phase === "auth") {
		oauthLink.href = update.url;
		oauthLink.textContent = "打开浏览器登录";
		oauthLink.classList.remove("hidden");
		setAuthStatus(update.instructions || "请点击链接并在打开的浏览器页面中完成认证。");
		return;
	}
	if (update.phase === "device") {
		oauthLink.href = update.verificationUri;
		oauthLink.textContent = `在浏览器中登录并输入代码: ${update.userCode}`;
		oauthLink.classList.remove("hidden");
		setAuthStatus(`请输入验证代码: ${update.userCode}。`);
		return;
	}
	if (update.phase === "prompt" || update.phase === "manual") {
		oauthPromptInput.placeholder = update.placeholder || "授权代码或重定向 URL";
		oauthPromptGroup.classList.remove("hidden");
		setAuthStatus(update.message || "请粘贴从浏览器中复制的授权代码或重定向链接。");
		return;
	}
	if (update.phase === "select") {
		oauthPromptInput.placeholder = (update.options || []).map((option) => option.label).join(" / ");
		oauthPromptGroup.classList.remove("hidden");
		setAuthStatus(update.message || "请输入选项对应的 ID。");
		return;
	}
	if (update.phase === "progress") {
		setAuthStatus(update.message || "正在处理中...");
		return;
	}
	if (update.phase === "complete") {
		state.currentOAuthJob = undefined;
		oauthPromptGroup.classList.add("hidden");
		setAuthStatus("授权登录已成功完成！");
		Promise.all([refreshAuthProviders(), refreshModels(), refreshState()]).catch((error) => addEvent(error.message, "error"));
		return;
	}
	if (update.phase === "cancelled") {
		state.currentOAuthJob = undefined;
		oauthPromptGroup.classList.add("hidden");
		setAuthStatus("登录已取消。");
		return;
	}
	if (update.phase === "error") {
		state.currentOAuthJob = undefined;
		oauthPromptGroup.classList.add("hidden");
		setAuthStatus(update.error || "登录失败。");
	}
}

async function submitOAuthInput() {
	const value = oauthPromptInput.value.trim();
	if (!state.currentOAuthJob || !value) return;
	await api("/api/auth/oauth/input", {
		method: "POST",
		body: JSON.stringify({ jobId: state.currentOAuthJob, value }),
	});
	oauthPromptInput.value = "";
	oauthPromptGroup.classList.add("hidden");
	setAuthStatus("已成功提交验证。");
}

async function logoutAuthProvider() {
	const provider = authProviderSelect.value;
	if (!provider) return;
	if (state.currentOAuthJob) {
		await api("/api/auth/oauth/cancel", {
			method: "POST",
			body: JSON.stringify({ jobId: state.currentOAuthJob }),
		}).catch((error) => addEvent(error.message, "error"));
		state.currentOAuthJob = undefined;
	}
	await api("/api/auth/logout", {
		method: "POST",
		body: JSON.stringify({ provider }),
	});
	setAuthStatus("已成功清除配置并登出。");
	await Promise.all([refreshAuthProviders(), refreshModels(), refreshState()]);
}

function openModelModal() {
	const current = state.currentModel;
	customProviderInput.value = current?.provider === "openai-codex" ? "ollama" : current?.provider || "ollama";
	customModelInput.value = "";
	customNameInput.value = "";
	customApiSelect.value = "openai-completions";
	customBaseUrlInput.value = customProviderInput.value === "ollama" ? "http://localhost:11434/v1" : "";
	customApiKeyInput.value = customProviderInput.value === "ollama" ? "ollama" : "";
	customContextInput.value = "128000";
	customMaxTokensInput.value = "16384";
	customImageInput.checked = false;
	customReasoningInput.checked = false;
	customLocalCompatInput.checked = true;
	customModelStatus.textContent = "";
	modelModalBackdrop.classList.remove("hidden");
}

async function saveCustomModel() {
	const payload = {
		provider: customProviderInput.value.trim(),
		modelId: customModelInput.value.trim(),
		name: customNameInput.value.trim() || undefined,
		api: customApiSelect.value,
		baseUrl: customBaseUrlInput.value.trim() || undefined,
		apiKey: customApiKeyInput.value.trim() || undefined,
		contextWindow: Number(customContextInput.value),
		maxTokens: Number(customMaxTokensInput.value),
		imageInput: customImageInput.checked,
		reasoning: customReasoningInput.checked,
		localCompat: customLocalCompatInput.checked,
	};
	if (!payload.provider || !payload.modelId) {
		customModelStatus.textContent = "服务商 ID 和模型 ID 是必填项。";
		return;
	}
	const saved = await api("/api/custom-models", {
		method: "POST",
		body: JSON.stringify(payload),
	});
	await refreshModels();
	modelSelect.value = `${saved.provider}/${saved.modelId}`;
	await api("/api/model", {
		method: "POST",
		body: JSON.stringify({ provider: saved.provider, modelId: saved.modelId }),
	});
	await refreshState();
	customModelStatus.textContent = "已成功保存并启用该模型。";
	modelModalBackdrop.classList.add("hidden");
}

function setResourcesStatus(text) {
	resourcesStatus.textContent = text || "";
	if (text) {
		addEvent(text, "system");
	}
}

function resourceLabel(item) {
	return item.name || item.path.split("/").filter(Boolean).at(-1) || item.path;
}

function resourceTypeForContainer(container) {
	if (container === skillsList) return "skills";
	if (container === extensionsList) return "extensions";
	return "prompts";
}

function resourceScopeForItem(item) {
	return item.scope === "project" ? "project" : "user";
}

function renderResourceList(container, items, emptyText) {
	container.innerHTML = "";
	if (!items.length) {
		const empty = document.createElement("div");
		empty.className = "resource-item resource-empty";
		empty.textContent = emptyText;
		container.append(empty);
		return;
	}
	const scopeZH = (s) => (s === "user" ? "全局" : s === "project" ? "项目" : s);
	const sourceZH = (s) => (s === "configured" ? "手动配置" : s);

	for (const item of items) {
		const row = document.createElement("div");
		row.className = "resource-item";

		const head = document.createElement("div");
		head.className = "resource-item-head";
		const title = document.createElement("strong");
		title.textContent = resourceLabel(item);
		title.title = resourceLabel(item);
		const actions = document.createElement("div");
		actions.className = "resource-row-actions";
		const preview = document.createElement("button");
		preview.className = "resource-mini-btn";
		preview.type = "button";
		preview.dataset.path = item.path;
		preview.textContent = "预览";
		const toggle = document.createElement("button");
		toggle.className = "resource-mini-btn";
		toggle.type = "button";
		toggle.dataset.path = item.path;
		toggle.dataset.type = resourceTypeForContainer(container);
		toggle.dataset.scope = resourceScopeForItem(item);
		toggle.dataset.enabled = String(!item.enabled);
		toggle.textContent = item.enabled ? "停用" : "启用";
		actions.append(preview, toggle);
		head.append(title, actions);

		const path = document.createElement("code");
		path.textContent = item.path;
		path.title = item.path;

		const description = document.createElement("div");
		description.className = "muted small";
		description.textContent = item.description || "";
		description.title = item.description || "";

		const meta = document.createElement("div");
		meta.className = "resource-meta";
		const chips = [
			{ text: item.enabled ? "已启用" : "已禁用", cls: item.enabled ? "chip-on" : "chip-off" },
			item.scope ? { text: scopeZH(item.scope), cls: "chip-scope" } : null,
			item.source ? { text: sourceZH(item.source), cls: "chip-source" } : null,
			item.origin ? { text: item.origin, cls: "chip-origin" } : null,
		].filter(Boolean);
		for (const { text, cls } of chips) {
			const chip = document.createElement("span");
			chip.className = `chip ${cls}`;
			chip.textContent = text;
			meta.append(chip);
		}
		row.append(head, path, description, meta);
		container.append(row);
	}
}

function renderResourceDiagnostics(diagnostics) {
	if (!resourceDiagnostics) return;
	resourceDiagnostics.innerHTML = "";
	if (!diagnostics?.length) {
		resourceDiagnostics.classList.add("hidden");
		return;
	}
	resourceDiagnostics.classList.remove("hidden");
	for (const diagnostic of diagnostics) {
		const item = document.createElement("div");
		item.className = `resource-diagnostic ${diagnostic.type || "warning"}`;
		item.textContent = `${diagnostic.type || "warning"}: ${diagnostic.message || ""}${diagnostic.path ? ` (${diagnostic.path})` : ""}`;
		resourceDiagnostics.append(item);
	}
}

async function previewResource(path) {
	if (!path) return;
	resourcePreviewPane.classList.remove("hidden");
	resourcePreviewTitle.textContent = "正在读取资源...";
	resourcePreviewPath.textContent = path;
	resourcePreviewPath.title = path;
	resourcePreviewContent.textContent = "";
	const data = await api("/api/resources/read", { method: "POST", body: JSON.stringify({ path }) });
	resourcePreviewTitle.textContent = resourceLabel({ path: data.path });
	resourcePreviewPath.textContent = data.path;
	resourcePreviewPath.title = data.path;
	resourcePreviewContent.textContent = data.content;
}

async function toggleResource(path, type, scope, enabled) {
	await api("/api/resources/enabled", {
		method: "POST",
		body: JSON.stringify({ path, type, scope, enabled }),
	});
	await refreshResources();
	setResourcesStatus(enabled ? "资源已启用。" : "资源已停用。");
}

function renderPackages(packages) {
	packagesList.innerHTML = "";
	if (!packages.length) {
		const empty = document.createElement("div");
		empty.className = "resource-item resource-empty";
		empty.textContent = "未安装任何扩展包。";
		packagesList.append(empty);
		return;
	}
	const scopeZH = (s) => (s === "user" ? "全局" : s === "project" ? "项目" : s);

	for (const pkg of packages) {
		const row = document.createElement("div");
		row.className = "resource-item";

		const head = document.createElement("div");
		head.className = "resource-item-head";
		const title = document.createElement("strong");
		title.textContent = pkg.source;
		title.title = pkg.source;
		const remove = document.createElement("button");
		remove.className = "btn btn-secondary btn-sm btn-danger-hover";
		remove.type = "button";
		remove.dataset.source = pkg.source;
		remove.dataset.scope = pkg.scope;
		remove.textContent = "移除";
		head.append(title, remove);

		const path = document.createElement("code");
		path.textContent = pkg.installedPath || "未安装";
		path.title = pkg.installedPath || "未安装";

		const meta = document.createElement("div");
		meta.className = "resource-meta";
		const chips = [
			{ text: scopeZH(pkg.scope), cls: "chip-scope" },
			{ text: pkg.filtered ? "资源过滤" : "全部资源", cls: pkg.filtered ? "chip-info" : "chip-source" },
		];
		for (const { text, cls } of chips) {
			const chip = document.createElement("span");
			chip.className = `chip ${cls}`;
			chip.textContent = text;
			meta.append(chip);
		}
		row.append(head, path, meta);
		packagesList.append(row);
	}
}

async function refreshResources() {
	const data = await api("/api/resources");
	state.resources = data;
	renderResourceList(skillsList, data.resources.skills || [], "未找到任何自定义技能。");
	renderResourceList(extensionsList, data.resources.extensions || [], "未找到任何自定义扩展。");
	renderResourceDiagnostics(data.diagnostics || []);
	renderPackages(data.packages || []);
	const skillCount = data.resources.skills?.length || 0;
	const extensionCount = data.resources.extensions?.length || 0;
	const packageCount = data.packages?.length || 0;
	const skillBadge = document.getElementById("skillCountBadge");
	const extBadge = document.getElementById("extensionCountBadge");
	const pkgBadge = document.getElementById("packageCountBadge");
	if (skillBadge) skillBadge.textContent = String(skillCount);
	if (extBadge) extBadge.textContent = String(extensionCount);
	if (pkgBadge) pkgBadge.textContent = String(packageCount);
	setResourcesStatus(`已加载 ${skillCount + extensionCount + packageCount} 项资源`);
	return data;
}

// 资源管理器 tab 切换
function activateResourceTab(targetTab) {
	const tabs = document.querySelectorAll(".rc-pill[data-tab]");
	const panels = document.querySelectorAll(".resource-panel[data-panel]");
	for (const tab of tabs) {
		const isActive = tab.dataset.tab === targetTab;
		tab.classList.toggle("active", isActive);
		tab.setAttribute("aria-selected", isActive ? "true" : "false");
	}
	for (const panel of panels) {
		const isActive = panel.dataset.panel === targetTab;
		if (isActive) {
			panel.removeAttribute("hidden");
			panel.classList.add("active");
		} else {
			panel.setAttribute("hidden", "");
			panel.classList.remove("active");
		}
	}
}

document.querySelectorAll(".rc-pill[data-tab]").forEach((pill) => {
	pill.addEventListener("click", () => activateResourceTab(pill.dataset.tab));
});

// 提示文字里的"前往路径配置"链接
document.querySelectorAll("[data-jump-tab]").forEach((link) => {
	link.addEventListener("click", () => activateResourceTab(link.dataset.jumpTab));
});

// 安装扩展包"快速试用"chip：填充输入框前缀并聚焦
document.querySelectorAll(".install-example-chip[data-fill]").forEach((chip) => {
	chip.addEventListener("click", () => {
		const input = document.getElementById("packageSourceInput");
		if (!input) return;
		input.value = chip.dataset.fill || "";
		input.focus();
		// 把光标放到末尾，方便继续输入
		const len = input.value.length;
		input.setSelectionRange(len, len);
	});
});

async function openResourcesModal() {
	resourcesModalBackdrop.classList.remove("hidden");
	setResourcesStatus("正在加载系统资源...");
	await refreshResources();
}

async function reloadResources() {
	setResourcesStatus("正在重载系统资源...");
	await api("/api/resources/reload", { method: "POST", body: "{}" });
	await Promise.all([refreshResources(), refreshCommands(), refreshState()]);
	setResourcesStatus("系统资源重载完毕。");
}

async function refreshResourcesAfterMutation(doneText) {
	await Promise.all([refreshResources(), refreshCommands(), refreshState()]);
	setResourcesStatus(doneText);
}

function setCwdStatus(text) {
	cwdStatus.textContent = text || "";
}

function getRecentCwds() {
	try {
		const parsed = JSON.parse(localStorage.getItem(recentCwdStorageKey) || "[]");
		return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
	} catch {
		return [];
	}
}

function rememberCwd(cwd) {
	if (!cwd) return;
	const next = [cwd, ...getRecentCwds().filter((item) => item !== cwd)].slice(0, 10);
	localStorage.setItem(recentCwdStorageKey, JSON.stringify(next));
}

function renderRecentCwds() {
	cwdRecentList.innerHTML = "";
	const recent = getRecentCwds();
	if (!recent.length) return;
	const label = document.createElement("span");
	label.className = "cwd-recent-label";
	label.textContent = "最近：";
	cwdRecentList.append(label);
	for (const cwd of recent) {
		const button = document.createElement("button");
		button.className = "cwd-recent-chip";
		button.type = "button";
		button.textContent = cwd.split("/").filter(Boolean).at(-1) || cwd;
		button.title = cwd;
		button.addEventListener("click", () => loadCwdDirectory(cwd).catch((error) => setCwdStatus(error.message)));
		cwdRecentList.append(button);
	}
}

function renderCwdPicker(data) {
	state.cwdPicker = data;
	renderRecentCwds();
	cwdPathLabel.textContent = data.path;
	cwdPathLabel.title = data.path;
	cwdParentBtn.disabled = !data.parent;
	cwdList.innerHTML = "";
	if (!data.entries.length) {
		const empty = document.createElement("div");
		empty.className = "cwd-empty";
		empty.textContent = "这个目录下面没有可进入的文件夹。";
		cwdList.append(empty);
		return;
	}
	for (const entry of data.entries) {
		const button = document.createElement("button");
		button.className = "cwd-entry";
		button.type = "button";
		button.innerHTML = `
			<svg class="cwd-entry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
			<span>${entry.name}</span>
		`;
		button.addEventListener("click", () => {
			loadCwdDirectory(entry.path).catch((error) => setCwdStatus(error.message));
		});
		cwdList.append(button);
	}
}

async function loadCwdDirectory(path) {
	setCwdStatus("正在加载目录...");
	const query = path ? `?path=${encodeURIComponent(path)}` : "";
	const data = await api(`/api/cwd${query}`);
	renderCwdPicker(data);
	setCwdStatus("");
}

async function openWorkingDirectoryPicker() {
	if (state.isStreaming) {
		addEvent("请等待当前任务结束后再切换工作目录。", "error");
		return;
	}
	cwdModalBackdrop.classList.remove("hidden");
	await loadCwdDirectory(state.currentCwd);
}

async function selectWorkingDirectory() {
	const nextCwd = state.cwdPicker?.path;
	if (!nextCwd || nextCwd === state.currentCwd) {
		cwdModalBackdrop.classList.add("hidden");
		return;
	}

	cwdSelectBtn.disabled = true;
	setCwdStatus(`正在切换到 ${nextCwd}...`);
	try {
		const data = await api("/api/cwd", {
			method: "POST",
			body: JSON.stringify({ cwd: nextCwd }),
		});
		state.currentCwd = data.cwd || nextCwd;
		rememberCwd(state.currentCwd);
		cwdModalBackdrop.classList.add("hidden");
		addEvent(`工作目录已切换为: ${state.currentCwd}`, "system");
		await Promise.all([refreshModels(), refreshState()]);
		if (!resourcesModalBackdrop.classList.contains("hidden")) {
			await refreshResources();
		}
	} finally {
		cwdSelectBtn.disabled = false;
	}
}

function setSessionsStatus(text) {
	sessionsStatus.textContent = text || "";
}

function sessionTitle(item) {
	return item.name || item.firstMessage || item.id;
}

function renderSessions() {
	sessionsList.innerHTML = "";
	const query = sessionSearchInput.value.trim().toLowerCase();
	const sessions = state.sessions.filter((item) => {
		const haystack =
			`${item.name || ""} ${item.firstMessage || ""} ${item.id || ""} ${item.cwd || ""} ${item.lastModel?.provider || ""} ${item.lastModel?.modelId || ""}`.toLowerCase();
		return !query || haystack.includes(query);
	});
	if (!sessions.length) {
		const empty = document.createElement("div");
		empty.className = "session-list-empty";
		empty.textContent = "没有找到可恢复的历史会话。";
		sessionsList.append(empty);
		return;
	}
	for (const item of sessions) {
		const row = document.createElement("button");
		row.className = "session-list-item";
		row.type = "button";
		row.dataset.path = item.path;
		const modified = item.modified ? new Date(item.modified).toLocaleString() : "未知时间";
		const model = item.lastModel ? `${item.lastModel.provider}/${item.lastModel.modelId}` : "未记录模型";
		row.innerHTML = `
			<strong>${escapeHtml(sessionTitle(item))}</strong>
			<span>${escapeHtml(item.firstMessage || "")}</span>
			<small>${escapeHtml(modified)} · ${item.messageCount || 0} messages · ${escapeHtml(model)}</small>
		`;
		sessionsList.append(row);
	}
}

function populateSessionCwdSelect() {
	const previous = sessionCwdSelect.value;
	const cwds = [state.currentCwd, ...getRecentCwds()].filter(Boolean);
	const uniqueCwds = [...new Set(cwds)];
	sessionCwdSelect.innerHTML = '<option value="">当前工作目录</option>';
	for (const cwd of uniqueCwds) {
		const option = document.createElement("option");
		option.value = cwd;
		option.textContent = cwd === state.currentCwd ? `当前: ${cwd}` : cwd;
		option.title = cwd;
		sessionCwdSelect.append(option);
	}
	if (previous && uniqueCwds.includes(previous)) {
		sessionCwdSelect.value = previous;
	}
	state.sessionsCwd = sessionCwdSelect.value;
}

async function refreshSessionsList() {
	setSessionsStatus("正在读取历史会话...");
	const selectedCwd = sessionCwdSelect.value;
	const query = selectedCwd ? `?cwd=${encodeURIComponent(selectedCwd)}` : "";
	const data = await api(`/api/sessions/list${query}`);
	state.sessions = data.sessions || [];
	state.sessionsCwd = data.cwd || selectedCwd || state.currentCwd;
	renderSessions();
	setSessionsStatus(`已找到 ${state.sessions.length} 个历史会话。目录: ${state.sessionsCwd || "当前"}`);
}

async function openSessionsModal() {
	state.sessionBrowserMode = "sessions";
	sessionCwdSelect.disabled = false;
	populateSessionCwdSelect();
	sessionsModalBackdrop.classList.remove("hidden");
	await refreshSessionsList();
	sessionSearchInput.focus();
}

async function switchToSession(sessionPath) {
	if (!sessionPath) return;
	await api("/api/session/switch", { method: "POST", body: JSON.stringify({ sessionPath }) });
	sessionsModalBackdrop.classList.add("hidden");
	await Promise.all([refreshState(), refreshSessionsList().catch(() => undefined)]);
	addEvent("历史会话已恢复。", "system");
}

async function openForkPicker() {
	state.sessionBrowserMode = "fork";
	sessionCwdSelect.disabled = true;
	sessionsModalBackdrop.classList.remove("hidden");
	setSessionsStatus("正在读取可分支的用户消息...");
	const data = await api("/api/session/fork-messages");
	const messages = data.messages || [];
	state.sessions = [];
	sessionsList.innerHTML = "";
	if (!messages.length) {
		setSessionsStatus("当前会话还没有可分支的用户消息。");
		renderSessions();
		return;
	}
	setSessionsStatus(`可从 ${messages.length} 条用户消息创建分支。`);
	for (const message of messages) {
		const row = document.createElement("button");
		row.className = "session-list-item fork-list-item";
		row.type = "button";
		row.dataset.entryId = message.entryId;
		row.innerHTML = `
			<strong>从这条消息分支</strong>
			<span>${escapeHtml(message.text || "")}</span>
			<small>${escapeHtml(message.entryId)}</small>
		`;
		sessionsList.append(row);
	}
}

async function forkFromMessage(entryId) {
	const data = await api("/api/session/fork", { method: "POST", body: JSON.stringify({ entryId }) });
	sessionsModalBackdrop.classList.add("hidden");
	if (data.text) {
		const existingPrompt = promptInput.value.trim();
		if (existingPrompt && existingPrompt !== data.text.trim()) {
			const overwrite = await confirmPromptOverwrite("当前输入框里还有未发送内容。继续会用分支消息替换它。");
			if (!overwrite) {
				promptInput.focus();
				await refreshState();
				addEvent("已创建会话分支，保留了当前输入。", "system");
				return;
			}
		}
		promptInput.value = data.text;
		promptInput.focus();
	}
	await refreshState();
	addEvent("已创建会话分支，可修改输入后继续。", "system");
}

async function createSkillFromForm() {
	const payload = {
		name: skillNameInput.value.trim(),
		description: skillDescriptionInput.value.trim(),
		instructions: skillInstructionsInput.value.trim() || undefined,
		scope: resourceScopeSelect.value,
	};
	if (!payload.name || !payload.description) {
		setResourcesStatus("技能名称和技能简介是必填项。");
		return;
	}
	const saved = await api("/api/resources/skill", {
		method: "POST",
		body: JSON.stringify(payload),
	});
	skillNameInput.value = "";
	skillDescriptionInput.value = "";
	skillInstructionsInput.value = "";
	await refreshResourcesAfterMutation(`已成功创建技能 ${saved.name}。`);
}

async function changeResourcePath(action) {
	const payload = {
		type: resourceTypeSelect.value,
		path: resourcePathInput.value.trim(),
		scope: resourceScopeSelect.value,
	};
	if (!payload.path) {
		setResourcesStatus("路径是必填项。");
		return;
	}
	const endpoint = action === "remove" ? "/api/resources/path/remove" : "/api/resources/path";
	await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
	resourcePathInput.value = "";
	await refreshResourcesAfterMutation(action === "remove" ? "已成功移除路径设置。" : "已成功添加路径设置。");
}

async function installPackageFromForm() {
	const source = packageSourceInput.value.trim();
	if (!source) {
		setResourcesStatus("扩展包来源是必填项。");
		return;
	}
	if (!window.confirm("警告：Pi 扩展包具有执行本地代码的权限，可能会对您的系统进行敏感修改。是否确定安装此扩展包？")) {
		return;
	}
	setResourcesStatus(`正在安装扩展包 ${source}...`);
	await api("/api/resources/package/install", {
		method: "POST",
		body: JSON.stringify({ source, scope: resourceScopeSelect.value }),
	});
	packageSourceInput.value = "";
	await refreshResourcesAfterMutation("扩展包安装完毕。");
}

async function removePackageFromList(source, scope) {
	if (!source || !window.confirm(`是否确定移除扩展包 ${source}？`)) {
		return;
	}
	setResourcesStatus(`正在移除扩展包 ${source}...`);
	await api("/api/resources/package/remove", {
		method: "POST",
		body: JSON.stringify({ source, scope }),
	});
	await refreshResourcesAfterMutation("扩展包已移除。");
}

async function fileToDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error || new Error("读取附件失败"));
		reader.readAsDataURL(file);
	});
}

async function fileToImageContent(file) {
	const dataUrl = await fileToDataUrl(file);
	const marker = ";base64,";
	const index = dataUrl.indexOf(marker);
	return {
		type: "image",
		mimeType: dataUrl.slice(5, index),
		data: dataUrl.slice(index + marker.length),
		name: file.name,
	};
}

async function fileToBase64Content(file) {
	const dataUrl = await fileToDataUrl(file);
	const marker = ";base64,";
	const index = dataUrl.indexOf(marker);
	return index === -1 ? "" : dataUrl.slice(index + marker.length);
}

function isProbablyBinaryText(content) {
	if (content.includes("\0")) {
		return true;
	}
	const replacementCount = (content.match(/\uFFFD/g) || []).length;
	return replacementCount > 8 && replacementCount / Math.max(content.length, 1) > 0.02;
}

function isPdfAttachment(file) {
	return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}

async function fileToAttachment(file) {
	if (imageAttachmentMimeTypes.has(file.type)) {
		const image = await fileToImageContent(file);
		return {
			type: "image",
			name: file.name,
			mimeType: image.mimeType,
			size: file.size,
			previewUrl: URL.createObjectURL(file),
			image,
		};
	}
	if (isPdfAttachment(file)) {
		if (file.size > maxBinaryAttachmentBytes) {
			throw new Error(`PDF ${file.name} 超过 6 MB，请先拆分后再上传。`);
		}
		return {
			type: "file",
			name: file.name,
			mimeType: "application/pdf",
			size: file.size,
			encoding: "base64",
			content: await fileToBase64Content(file),
		};
	}
	if (file.type.startsWith("image/")) {
		throw new Error(`暂不支持 ${file.type} 图片，请使用 PNG、JPEG、GIF 或 WebP。`);
	}
	if (file.size > maxTextAttachmentBytes) {
		throw new Error(`文件 ${file.name} 超过 1 MB，请先拆分后再上传。`);
	}
	const content = await file.text();
	if (isProbablyBinaryText(content)) {
		throw new Error(`文件 ${file.name} 看起来不是文本文件，当前只支持文本文件和常见图片。`);
	}
	return {
		type: "file",
		name: file.name,
		mimeType: file.type || "text/plain",
		size: file.size,
		encoding: "text",
		lineCount: content ? content.split(/\r\n|\r|\n/).length : 0,
		content,
	};
}

function shouldIgnoreDroppedPath(path) {
	return /(^|\/)(\.git|node_modules|dist|build|coverage|\.next|\.turbo)(\/|$)/.test(path);
}

function readEntryFile(entry) {
	return new Promise((resolve, reject) => {
		entry.file(resolve, reject);
	});
}

function readDirectoryEntries(reader) {
	return new Promise((resolve, reject) => {
		reader.readEntries(resolve, reject);
	});
}

async function filesFromEntry(entry, prefix = "", remaining = { count: 0 }) {
	const fullPath = `${prefix}${entry.name}`;
	if (shouldIgnoreDroppedPath(fullPath)) {
		return [];
	}
	if (remaining.count > 120) {
		return [];
	}
	if (entry.isFile) {
		remaining.count++;
		const file = await readEntryFile(entry);
		return [new File([file], fullPath, { type: file.type, lastModified: file.lastModified })];
	}
	if (!entry.isDirectory) {
		return [];
	}
	const reader = entry.createReader();
	const files = [];
	while (true) {
		const entries = await readDirectoryEntries(reader);
		if (!entries.length) break;
		for (const child of entries) {
			files.push(...(await filesFromEntry(child, `${fullPath}/`, remaining)));
		}
	}
	return files;
}

async function filesFromDataTransfer(dataTransfer) {
	const items = Array.from(dataTransfer.items || []);
	const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
	if (entries.length > 0) {
		const files = [];
		const remaining = { count: 0 };
		for (const entry of entries) {
			files.push(...(await filesFromEntry(entry, "", remaining)));
		}
		return files;
	}
	return Array.from(dataTransfer.files || []);
}

async function addAttachmentsFromFiles(files) {
	const attachments = await Promise.all(files.map(fileToAttachment));
	state.attachments = [...state.attachments, ...attachments];
	refreshAttachmentPreview();
}

function attachmentIcon(attachment) {
	if (attachment.type === "image") {
		return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
	}
	if (attachment.mimeType === "application/pdf") {
		return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3z"></path><path d="M14 13v3"></path><path d="M14 13h2"></path><path d="M14 14.5h1.5"></path></svg>';
	}
	return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
}

function attachmentMetaText(attachment) {
	if (attachment.type !== "file") {
		return `${attachment.mimeType || "image"} · ${formatSize(attachment.size || 0)}`;
	}
	if (attachment.encoding === "base64") {
		return `${attachment.mimeType || "binary"} · ${formatSize(attachment.size || 0)} · base64`;
	}
	return `${formatSize(attachment.size || 0)} · ${attachment.lineCount || 0} lines`;
}

function refreshAttachmentPreview() {
	attachmentPreview.innerHTML = "";
	for (const [index, attachment] of state.attachments.entries()) {
		const chip = document.createElement("span");
		chip.className = `attachment-chip ${attachment.type === "image" ? "image-chip" : "file-chip"}`;
		chip.innerHTML = attachmentIcon(attachment);
		const label = document.createElement("span");
		label.textContent = attachment.name || attachment.mimeType || "附件";
		chip.append(label);
		const meta = document.createElement("small");
		meta.textContent = attachmentMetaText(attachment);
		chip.append(meta);
		if (attachment.previewUrl) {
			const preview = document.createElement("img");
			preview.src = attachment.previewUrl;
			preview.alt = "";
			chip.prepend(preview);
		}
		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "attachment-remove";
		remove.dataset.index = String(index);
		remove.setAttribute("aria-label", `移除 ${label.textContent}`);
		remove.innerHTML =
			'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
		chip.append(remove);
		attachmentPreview.append(chip);
	}
}

function promptTextForMode(text) {
	if (!state.planMode) {
		return text;
	}
	const body = text || "请根据附件内容制定计划。";
	return `请首先为此请求制定一个简洁的执行计划，在获得我的明确确认之前，请勿编辑任何文件。\n\n${body}`;
}

function currentSlashQuery() {
	const value = promptInput.value;
	const cursor = promptInput.selectionStart ?? value.length;
	const before = value.slice(0, cursor);
	const match = before.match(/(?:^|\s)\/([a-z0-9:_-]*)$/i);
	return match ? match[1].toLowerCase() : undefined;
}

function hideSlashMenu() {
	slashCommandMenu.classList.add("hidden");
	slashCommandMenu.innerHTML = "";
}

function showSlashMenu() {
	const query = currentSlashQuery();
	if (query === undefined) {
		hideSlashMenu();
		return;
	}
	const matches = state.commands
		.filter((command) => command.name.toLowerCase().includes(query))
		.slice(0, 8);
	slashCommandMenu.innerHTML = "";
	if (!matches.length) {
		hideSlashMenu();
		return;
	}
	for (const command of matches) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "slash-command-item";
		button.dataset.name = command.name;
		button.innerHTML = `<strong>/${escapeHtml(command.name)}</strong><span>${escapeHtml(command.description || command.source || "")}</span>`;
		slashCommandMenu.append(button);
	}
	slashCommandMenu.classList.remove("hidden");
}

function insertSlashCommand(name) {
	const value = promptInput.value;
	const cursor = promptInput.selectionStart ?? value.length;
	const before = value.slice(0, cursor).replace(/(?:^|\s)\/[a-z0-9:_-]*$/i, (match) => {
		const prefix = match.startsWith("/") ? "" : match[0];
		return `${prefix}/${name} `;
	});
	promptInput.value = `${before}${value.slice(cursor)}`;
	promptInput.focus();
	promptInput.setSelectionRange(before.length, before.length);
	hideSlashMenu();
}

async function sendPrompt() {
	const text = promptInput.value.trim();
	if (!text && state.attachments.length === 0) {
		return;
	}
	const pendingAttachments = state.attachments;
	const images = pendingAttachments
		.filter((attachment) => attachment.type === "image")
		.map((attachment) => ({
			type: "image",
			mimeType: attachment.image.mimeType,
			data: attachment.image.data,
		}));
	const files = pendingAttachments
		.filter((attachment) => attachment.type === "file")
		.map((attachment) => ({
			name: attachment.name,
			mimeType: attachment.mimeType,
			encoding: attachment.encoding,
			content: attachment.content,
		}));
	promptInput.value = "";
	state.attachments = [];
	refreshAttachmentPreview();
	try {
		await api("/api/prompt", {
			method: "POST",
			body: JSON.stringify({
				message: promptTextForMode(text),
				images: images.length > 0 ? images : undefined,
				files: files.length > 0 ? files : undefined,
				streamingBehavior: state.isStreaming ? "followUp" : undefined,
			}),
		});
	} catch (error) {
		promptInput.value = text;
		state.attachments = pendingAttachments;
		refreshAttachmentPreview();
		throw error;
	}
}

document.getElementById("sendBtn").addEventListener("click", () => {
	sendPrompt().catch((error) => addEvent(error.message, "error"));
});

chatLog.addEventListener("click", (event) => {
	const copyButton = event.target.closest(".copy-code-btn");
	if (!copyButton) return;
	navigator.clipboard.writeText(copyButton.dataset.code || "");
	const previous = copyButton.textContent;
	copyButton.textContent = "已复制";
	setTimeout(() => {
		copyButton.textContent = previous || "复制";
	}, 1200);
});

// 快捷启动 chip：点击后填入输入框并立即发送
document.querySelectorAll(".quick-prompt").forEach((chip) => {
	chip.addEventListener("click", () => {
		const prompt = chip.getAttribute("data-prompt");
		if (!prompt) return;
		promptInput.value = prompt;
		promptInput.focus();
		sendPrompt().catch((error) => addEvent(error.message, "error"));
	});
});

promptInput.addEventListener("keydown", (event) => {
	if (event.isComposing) {
		return;
	}
	if (event.key === "Tab" && !slashCommandMenu.classList.contains("hidden")) {
		const first = slashCommandMenu.querySelector(".slash-command-item");
		if (first) {
			event.preventDefault();
			insertSlashCommand(first.dataset.name);
		}
		return;
	}
	if (event.key === "Escape" && !slashCommandMenu.classList.contains("hidden")) {
		event.preventDefault();
		hideSlashMenu();
		return;
	}
	if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
		event.preventDefault();
		event.stopPropagation();
		sendPrompt().catch((error) => addEvent(error.message, "error"));
		return;
	}
	if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
		event.preventDefault();
		sendPrompt().catch((error) => addEvent(error.message, "error"));
	}
});

promptInput.addEventListener("input", showSlashMenu);

slashCommandMenu.addEventListener("click", (event) => {
	const item = event.target.closest(".slash-command-item");
	if (!item) return;
	insertSlashCommand(item.dataset.name);
});

document.getElementById("stopBtn").addEventListener("click", () => {
	api("/api/abort", { method: "POST", body: "{}" }).catch((error) => addEvent(error.message, "error"));
});

document.getElementById("newSessionBtn").addEventListener("click", async () => {
	await api("/api/session/new", { method: "POST", body: "{}" });
	await refreshState();
});

document.getElementById("sessionsBtn").addEventListener("click", () => {
	openSessionsModal().catch((error) => setSessionsStatus(error.message));
});

document.getElementById("forkBtn").addEventListener("click", () => {
	openForkPicker().catch((error) => setSessionsStatus(error.message));
});

document.getElementById("sessionsCloseBtn").addEventListener("click", () => {
	sessionsModalBackdrop.classList.add("hidden");
});

document.getElementById("sessionsRefreshBtn").addEventListener("click", () => {
	refreshSessionsList().catch((error) => setSessionsStatus(error.message));
});

sessionCwdSelect.addEventListener("change", () => {
	refreshSessionsList().catch((error) => setSessionsStatus(error.message));
});

sessionSearchInput.addEventListener("input", renderSessions);

sessionsList.addEventListener("click", (event) => {
	const item = event.target.closest(".session-list-item");
	if (!item) return;
	if (item.classList.contains("fork-list-item")) {
		forkFromMessage(item.dataset.entryId).catch((error) => setSessionsStatus(error.message));
		return;
	}
	switchToSession(item.dataset.path).catch((error) => setSessionsStatus(error.message));
});

// 重构会话重命名事件绑定到内嵌双击
document.getElementById("renameBtn").addEventListener("click", async () => {
	const name = sessionNameInput.value.trim();
	if (!name) return;
	await api("/api/session/name", { method: "POST", body: JSON.stringify({ name }) });
	await refreshState();
});

document.getElementById("exportBtn").addEventListener("click", async () => {
	const action = await chooseExportAction(selectedChatText());
	if (action === "html") {
		const data = await api("/api/export", { method: "POST", body: "{}" });
		addEvent(`会话已成功导出至：${data.path}`, "system");
		return;
	}
	if (action === "markdown") {
		await exportMarkdownSession(false);
		return;
	}
	if (action === "selection-markdown") {
		await exportMarkdownSession(true);
	}
});

document.getElementById("compactBtn").addEventListener("click", async () => {
	await api("/api/compact", { method: "POST", body: "{}" });
	await refreshState();
});

document.getElementById("refreshBtn").addEventListener("click", () => {
	refreshState().catch((error) => addEvent(error.message, "error"));
});

cwdChangeBtn.addEventListener("click", () => {
	openWorkingDirectoryPicker().catch((error) => addEvent(error.message, "error"));
});

cwdCancelBtn.addEventListener("click", () => {
	cwdModalBackdrop.classList.add("hidden");
});

cwdHomeBtn.addEventListener("click", () => {
	loadCwdDirectory(state.cwdPicker?.home || "").catch((error) => setCwdStatus(error.message));
});

cwdCurrentBtn.addEventListener("click", () => {
	loadCwdDirectory(state.currentCwd).catch((error) => setCwdStatus(error.message));
});

cwdParentBtn.addEventListener("click", () => {
	if (!state.cwdPicker?.parent) {
		return;
	}
	loadCwdDirectory(state.cwdPicker.parent).catch((error) => setCwdStatus(error.message));
});

cwdSelectBtn.addEventListener("click", () => {
	selectWorkingDirectory().catch((error) => setCwdStatus(error.message));
});

document.getElementById("resourcesBtn").addEventListener("click", () => {
	openResourcesModal().catch((error) => setResourcesStatus(error.message));
});

document.getElementById("resourcesCloseBtn").addEventListener("click", () => {
	resourcesModalBackdrop.classList.add("hidden");
});

document.getElementById("resourcesReloadBtn").addEventListener("click", () => {
	reloadResources().catch((error) => setResourcesStatus(error.message));
});

document.getElementById("resourcePreviewCloseBtn").addEventListener("click", () => {
	resourcePreviewPane.classList.add("hidden");
});

for (const list of [skillsList, extensionsList]) {
	list.addEventListener("click", (event) => {
		const preview = event.target.closest(".resource-mini-btn[data-path]:not([data-enabled])");
		if (preview) {
			previewResource(preview.dataset.path).catch((error) => setResourcesStatus(error.message));
			return;
		}
		const toggle = event.target.closest(".resource-mini-btn[data-enabled]");
		if (!toggle) return;
		toggleResource(toggle.dataset.path, toggle.dataset.type, toggle.dataset.scope, toggle.dataset.enabled === "true").catch(
			(error) => setResourcesStatus(error.message),
		);
	});
}

document.getElementById("skillCreateBtn").addEventListener("click", () => {
	createSkillFromForm().catch((error) => setResourcesStatus(error.message));
});

document.getElementById("resourcePathAddBtn").addEventListener("click", () => {
	changeResourcePath("add").catch((error) => setResourcesStatus(error.message));
});

document.getElementById("resourcePathRemoveBtn").addEventListener("click", () => {
	changeResourcePath("remove").catch((error) => setResourcesStatus(error.message));
});

document.getElementById("packageInstallBtn").addEventListener("click", () => {
	installPackageFromForm().catch((error) => setResourcesStatus(error.message));
});

packagesList.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLButtonElement) || !target.dataset.source) {
		return;
	}
	removePackageFromList(target.dataset.source, target.dataset.scope).catch((error) =>
		setResourcesStatus(error.message),
	);
});

modelSelect.addEventListener("change", async () => {
	const [provider, ...idParts] = modelSelect.value.split("/");
	const modelId = idParts.join("/");
	await api("/api/model", { method: "POST", body: JSON.stringify({ provider, modelId }) });
	await refreshState();
});

modelSearchInput.addEventListener("input", renderModelOptions);

thinkingSelect.addEventListener("change", async () => {
	await api("/api/thinking", { method: "POST", body: JSON.stringify({ level: thinkingSelect.value }) });
	await refreshState();
});

document.getElementById("authBtn").addEventListener("click", () => {
	openAuthModal().catch((error) => addEvent(error.message, "error"));
});

authProviderSelect.addEventListener("change", updateAuthMethodView);
authMethodSelect.addEventListener("change", updateAuthMethodView);

document.getElementById("authSave").addEventListener("click", () => {
	const action = authMethodSelect.value === "oauth" ? startOAuthLogin : saveApiKeyAuth;
	action().catch((error) => setAuthStatus(error.message));
});

document.getElementById("authLogout").addEventListener("click", () => {
	logoutAuthProvider().catch((error) => setAuthStatus(error.message));
});

document.getElementById("authCancel").addEventListener("click", () => {
	authModalBackdrop.classList.add("hidden");
});

document.getElementById("oauthPromptSubmit").addEventListener("click", () => {
	submitOAuthInput().catch((error) => setAuthStatus(error.message));
});

oauthPromptInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();
		submitOAuthInput().catch((error) => setAuthStatus(error.message));
	}
});

document.getElementById("addModelBtn").addEventListener("click", openModelModal);

document.getElementById("modelCancel").addEventListener("click", () => {
	modelModalBackdrop.classList.add("hidden");
});

document.getElementById("modelSave").addEventListener("click", () => {
	saveCustomModel().catch((error) => {
		customModelStatus.textContent = error.message;
	});
});

executeModeBtn.addEventListener("click", () => {
	state.planMode = false;
	executeModeBtn.classList.add("active");
	planModeBtn.classList.remove("active");
});

planModeBtn.addEventListener("click", () => {
	state.planMode = true;
	planModeBtn.classList.add("active");
	executeModeBtn.classList.remove("active");
});

function closeTopModal() {
	const modals = [
		sessionsModalBackdrop,
		resourcesModalBackdrop,
		cwdModalBackdrop,
		modelModalBackdrop,
		authModalBackdrop,
		modalBackdrop,
	];
	for (const modal of modals) {
		if (modal && !modal.classList.contains("hidden")) {
			modal.classList.add("hidden");
			return true;
		}
	}
	return false;
}

document.addEventListener("keydown", (event) => {
	if (event.isComposing) return;
	const target = event.target;
	const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
	if (event.key === "Escape" && closeTopModal()) {
		event.preventDefault();
		return;
	}
	if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
		event.preventDefault();
		sendPrompt().catch((error) => addEvent(error.message, "error"));
		return;
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		modelSearchInput.focus();
		modelSearchInput.select();
		return;
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
		event.preventDefault();
		openSessionsModal().catch((error) => setSessionsStatus(error.message));
		return;
	}
	if (!isTyping && event.key === "/") {
		promptInput.focus();
	}
});

attachmentPreview.addEventListener("click", (event) => {
	const remove = event.target.closest(".attachment-remove");
	if (!remove) {
		return;
	}
	const index = Number(remove.dataset.index);
	if (!Number.isInteger(index)) {
		return;
	}
	state.attachments.splice(index, 1);
	refreshAttachmentPreview();
});

attachmentInput.addEventListener("change", async () => {
	const files = Array.from(attachmentInput.files || []);
	try {
		await addAttachmentsFromFiles(files);
	} catch (error) {
		addEvent(error.message, "error");
	} finally {
		attachmentInput.value = "";
	}
});

promptInput.addEventListener("paste", async (event) => {
	const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
	if (!files.length) return;
	event.preventDefault();
	try {
		await addAttachmentsFromFiles(files);
		addEvent(`已从剪贴板添加 ${files.length} 张图片。`, "system");
	} catch (error) {
		addEvent(error.message, "error");
	}
});

document.querySelector(".composer").addEventListener("dragover", (event) => {
	event.preventDefault();
	event.dataTransfer.dropEffect = "copy";
});

document.querySelector(".composer").addEventListener("drop", async (event) => {
	event.preventDefault();
	try {
		const files = await filesFromDataTransfer(event.dataTransfer);
		await addAttachmentsFromFiles(files);
		addEvent(`已添加 ${files.length} 个拖放附件。`, "system");
	} catch (error) {
		addEvent(error.message, "error");
	}
});

// 重写本地 Mock 终端运行逻辑：以追加方式记录控制台日志
clearTerminalBtn.addEventListener("click", () => {
	terminalHistory.innerHTML = '<div class="terminal-output-line text-muted">控制台历史已清空。</div>';
});

try {
	state.bashHistory = JSON.parse(localStorage.getItem(bashHistoryStorageKey) || "[]").filter((item) => typeof item === "string");
} catch {
	state.bashHistory = [];
}

function rememberBashCommand(command) {
	state.bashHistory = [command, ...state.bashHistory.filter((item) => item !== command)].slice(0, 80);
	state.bashHistoryIndex = -1;
	localStorage.setItem(bashHistoryStorageKey, JSON.stringify(state.bashHistory));
}

function setBashRunning(running) {
	state.isBashRunning = running;
	bashAbortBtn.disabled = !running;
	bashInput.disabled = running;
}

function renderTerminalOutput(line, text) {
	line.innerHTML = ansiToHtml(text);
}

async function abortBashCommand() {
	if (!state.isBashRunning) {
		return;
	}
	bashAbortBtn.disabled = true;
	await api("/api/bash/abort", { method: "POST", body: "{}" });
	addEvent("已发送 SIGINT 到当前 bash 命令。", "system");
}

// 支持回车直接在控制台执行命令
bashInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		runBashCommand().catch((error) => addEvent(error.message, "error"));
		return;
	}
	if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
		e.preventDefault();
		state.bashHistoryIndex = Math.min(state.bashHistoryIndex + 1, state.bashHistory.length - 1);
		bashInput.value = state.bashHistory[state.bashHistoryIndex] || "";
	}
	if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
		e.preventDefault();
		state.bashHistoryIndex = Math.max(state.bashHistoryIndex - 1, -1);
		bashInput.value = state.bashHistoryIndex === -1 ? "" : state.bashHistory[state.bashHistoryIndex] || "";
	}
});

// 兼容点击隐藏旧按钮执行
document.getElementById("bashBtn").addEventListener("click", () => {
	runBashCommand().catch((error) => addEvent(error.message, "error"));
});

bashAbortBtn.addEventListener("click", () => {
	abortBashCommand().catch((error) => addEvent(error.message, "error"));
});

async function runBashCommand() {
	const command = bashInput.value.trim();
	if (!command) return;
	if (state.isBashRunning) {
		addEvent("已有 bash 命令正在执行，请先中断或等待结束。", "system");
		return;
	}
	bashInput.value = "";
	rememberBashCommand(command);
	setBashRunning(true);

	// 追加运行的命令
	const cmdLine = document.createElement("div");
	cmdLine.className = "terminal-output-line terminal-cmd-entry";
	cmdLine.textContent = `$ ${command}`;
	terminalHistory.appendChild(cmdLine);

	// 追加等待提示
	const outputLine = document.createElement("div");
	outputLine.className = "terminal-output-line terminal-cmd-output text-muted";
	outputLine.textContent = "正在执行中...";
	terminalHistory.appendChild(outputLine);
	terminalHistory.scrollTop = terminalHistory.scrollHeight;

	try {
		const data = await api("/api/bash", { method: "POST", body: JSON.stringify({ command }) });
		const output = data.output || data.stdout || data.stderr || "命令执行完成，无输出。";
		const exit = Number.isFinite(data.exitCode) ? `\n\n(exit ${data.exitCode})` : "";
		let finalOutput = output;
		if (data.cancelled) {
			finalOutput += "\n\n(cancelled)";
		} else {
			finalOutput += exit;
		}
		renderTerminalOutput(outputLine, finalOutput);
		outputLine.classList.remove("text-muted");
	} catch (error) {
		outputLine.textContent = `执行失败: ${error.message}`;
		outputLine.style.color = "var(--danger)";
	} finally {
		setBashRunning(false);
	}
	terminalHistory.scrollTop = terminalHistory.scrollHeight;
}

connectEvents();
Promise.all([refreshAuthProviders(), refreshModels(), refreshCommands(), refreshState()]).catch((error) =>
	addEvent(error.message, "error"),
);
