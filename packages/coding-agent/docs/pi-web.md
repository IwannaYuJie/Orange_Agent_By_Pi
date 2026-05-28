# Pi Web

Pi Web is a local browser UI for a personal Pi fork. It keeps the terminal `pi` CLI intact and starts a localhost Web app backed by Pi RPC mode.

## Start

Build the package first:

```bash
npm install --ignore-scripts
npm run build
```

Then start the local Web UI:

```bash
pi-web
```

From a development checkout after build:

```bash
npm run web
```

The server binds to `127.0.0.1:42173` by default. It does not expose a public network listener.

Useful options:

```bash
pi-web --open
pi-web --port 43173
pi-web --cwd /path/to/project
pi-web -- --provider anthropic --model claude-sonnet-4-20250514
```

Arguments after `--` are forwarded to the internal `pi --mode rpc` process.

## Desktop Launcher

This local checkout also has a macOS desktop launcher at:

```text
/Users/penghaoxiang/Desktop/启动 Pi Web 橘猫.command
```

Double-clicking it starts Pi Web for `/Users/penghaoxiang/Documents/pi agent/pi` and opens `http://127.0.0.1:42173`.

Launcher behavior:

- If Pi Web is already responding on port `42173`, it stops the existing server first, then starts a fresh one and opens the page.
- If `node_modules` is missing, it runs `npm install --ignore-scripts` before startup.
- In this development checkout, it runs the source entrypoint with `node --import tsx`; if the source entrypoint is unavailable, it falls back to `packages/coding-agent/dist/web/cli.js`.
- The launcher writes `~/Library/LaunchAgents/me.penghaoxiang.pi-web.orange-cat.plist`, starts Pi Web through `launchctl`, waits until `GET /api/state` responds, opens the browser, then exits. This keeps Pi Web alive after the launcher terminal closes.
- When launched by macOS Terminal, the launcher also schedules the launcher tab to close after a clean startup.
- If startup fails or the port is occupied by a non-Pi process, the launcher keeps the terminal window open and prints the relevant status/log output for diagnosis.
- Logs are appended to `~/Library/Logs/PiWeb/pi-web.log`.
- Set `PI_WEB_PORT=<port>` before launching from Terminal to use a different local port.
- Set `PI_WEB_STARTUP_TRIES=<count>` to change how many readiness checks the launcher performs before timing out.

## Architecture

Pi Web is intentionally a light fork layer:

- `pi-web` starts a local HTTP server and a Pi RPC child process.
- REST endpoints proxy one-shot commands such as state, models, prompt, abort, model switch, compaction, export, and bash execution.
- `WS /api/events` streams Pi RPC events to the browser.
- The browser UI renders messages, tool calls, state, model controls, and permission prompts.
- The bottom terminal and system event drawer starts collapsed by default and can be opened from the top bar.
- The sidebar shows the active working directory and opens a local directory picker when switching it. Selecting a new directory restarts only the Pi RPC child process.
- Multiple browser windows still share one RPC child process. The first connected socket is labelled `owner`; later sockets are labelled `observer` so the UI makes the single-session behavior explicit until Pi Web grows per-tab bridges.
- Observer windows show a persistent top-bar warning badge. They can still operate the shared session, so the badge is informational rather than a permissions boundary.
- The original terminal `pi` entrypoint remains unchanged.

The Web layer should not reimplement Pi's agent loop, provider registry, session persistence, or tool execution. When a feature already exists in RPC mode, the Web layer should proxy it.

## Browser UI Layout

Pi Web's browser UI is tuned to fit a typical laptop screen (≥768px tall) without a sidebar scrollbar. The layout is split into three regions: a compact left sidebar, the chat pane (topbar + scrolling log + composer), and a collapsible bottom drawer for the terminal and system event stream.

### Sidebar

The sidebar is intentionally short. It only carries session controls and the working-directory footer; the mascot illustration lives in the chat empty state instead, so it does not occupy sidebar vertical space.

- The brand row carries two telemetry pills (message count `✉` and pending queue `⏳`) inline, so no separate telemetry section is needed.
- The `当前会话` and `系统控制` groups are collapsible. Each has a chevron toggle in its header; the collapsed/expanded state for each group is persisted in `localStorage` under the key `pi-web:sidebar-collapsed` so it survives reloads.
- The current session header carries a small badge that shows the auto-compaction mode (`自动` / `手动`) — the badge is the same DOM node `#contextMetric` previously rendered as a metric card.
- The current session card also shows lightweight token and cost totals from `GET /api/session/stats`.
- Session actions include `历史` for browsing saved sessions and `分支` for choosing an earlier user message to fork from.
- Low-frequency actions (`压缩历史上下文`, `资源与扩展包管理`, `手动刷新系统`) are nested inside a second-level `<details>` block labelled `更多操作` inside the `系统控制` group, so the default sidebar surface only shows the high-frequency `认证授权` and `添加模型` buttons.
- The footer pins the working-directory label with a `切换` shortcut to the directory picker.

### Top bar

- The top bar carries the connection status pill, the model + thinking-effort selectors, the execute/plan mode toggle, and the two drawer/sidebar toggle buttons. There is no separate workspace title — the brand inside the sidebar is the single source of identity.
- The model selector has a small search field, groups options by provider name, sorts providers alphabetically, sorts each provider's models by context window descending, and shows model metadata such as context window, image support, and thinking support in each option label.
- The thinking selector disables non-`off` levels when the selected model does not advertise reasoning support. When this forces the UI back to `off`, Pi Web also sends `POST /api/thinking` so the RPC session state matches the browser state.
- The mode toggle uses an icon plus a one-word label (`执行` / `计划`) instead of a sentence, with a tooltip explaining each mode.

### Empty state and quick-prompt chips

The chat empty state is sized to leave most of the viewport for the composer instead of the welcome card. It shows the orange-cat illustration, a short welcome line, and a 2×2 grid of quick-prompt chips:

- `📁 分析项目结构`
- `📖 5 分钟上手`
- `🔍 找重构目标`
- `🛡 依赖审计`

Clicking a chip fills the prompt textarea with the chip's stored `data-prompt`, focuses the textarea, and immediately calls `sendPrompt()`. The chips are wired through `app.js` via `document.querySelectorAll(".quick-prompt")`; adding more chips is a matter of editing `index.html` only.

### Composer

The composer is a centred floating panel above the chat log. The attachment button is icon-only (with a `title` tooltip) so the textarea has more breathing room. Attachment chips share the orange theme used elsewhere in the UI.

Keyboard shortcuts:

- `Enter` or `Cmd/Ctrl+Enter`: send the prompt.
- `Shift+Enter`: insert a newline.
- `Cmd/Ctrl+K`: focus the model search box.
- `Cmd/Ctrl+P`: open the saved-session browser.
- `Esc`: close the active modal or slash-command menu.
- `/` in the composer opens slash-command autocomplete backed by `GET /api/commands`.

## Message Rendering

Pi Web renders saved conversation history from `GET /api/messages` and live conversation changes from `WS /api/events`.

The browser should treat RPC `message_start`, `message_update`, and `message_end` events as the source of truth for live chat bubbles. Do not optimistically append submitted user prompts in the browser before `POST /api/prompt` completes, because the RPC bridge emits the same user message through `message_start` and duplicate user bubbles will appear while the agent is running.

Assistant `thinking` blocks render as collapsed details rows above the visible answer and include a rough token estimate plus elapsed-time metadata while the agent is running. After `agent_end`, the row is re-rendered with total elapsed time. If a provider only returns encrypted reasoning continuity data and no plain-text summary, Pi Web still shows the collapsed thinking row with a short placeholder and a tooltip badge instead of dropping the block from the transcript.

Markdown rendering supports headings, links, inline code, fenced code blocks, ordered and unordered lists, checkbox list items, blockquotes, horizontal rules, and tables. Fenced code blocks render with line numbers, lightweight syntax coloring, copy buttons, and VS Code / Cursor links when the fence info includes a path.

High-frequency tool cards have specialized renderers:

- `read`: file path, line range, and numbered content.
- `edit`: target path plus unified/diff-style output with add/remove coloring and editor links.
- `bash`: command and separated output area.
- `grep`: match counts grouped by file.

User message bubbles expose copy, edit-and-resend, and immediate resend actions. The sidebar `分支` action uses RPC `get_fork_messages` and `fork` to create a new branch from an earlier user message.

Assistant streaming updates are coalesced to animation frames before re-rendering Markdown, so long token streams do not rebuild the chat DOM for every individual token.

Tool-result updates are also coalesced to animation frames and skip DOM writes when the rendered body has not changed. Grep hit lines are escaped as raw code snippets instead of being parsed as Markdown.

## Local Bash Panel

The local bash panel keeps command history in `localStorage` and supports `Cmd/Ctrl+ArrowUp` / `Cmd/Ctrl+ArrowDown` recall. Long command output stays scrollable inside the terminal drawer, common ANSI foreground colors are rendered, and the `SIGINT` button calls `POST /api/bash/abort` for the current command.

The chat tool card renderer remains the source of truth for agent-driven bash calls. The local panel is for user-triggered one-off commands.

## Prompt Attachments

The composer supports selecting multiple local attachments before sending a prompt:

- PNG, JPEG, GIF, and WebP files are sent as RPC image attachments.
- Text files up to 1 MB are embedded into the prompt with the same `<file name="...">...</file>` shape used by CLI `@file` context.
- PDF files up to 6 MB are accepted and embedded as base64 prompt file attachments with `mimeType="application/pdf"` and `encoding="base64"` metadata. Pi Web does not text-extract the PDF in the browser; the payload is preserved for model/tool handling.
- Other binary files and unsupported image formats are rejected in the browser instead of sending unreadable content to the agent.
- Pasted clipboard images are attached directly from the composer.
- Dropped folders are walked recursively in the browser. Common heavy/generated directories such as `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, and `.turbo` are skipped.
- Attachment chips show image thumbnails, PDF size/type metadata, or text-file metadata including size and line count.

`POST /api/prompt` accepts `files` alongside `message`, `images`, and `streamingBehavior`. A prompt can be attachment-only when at least one `file` or `image` is present.

## Export and Sharing

The sidebar `导出` action offers three paths:

- Full HTML export via RPC `export_html`, preserving the upstream shareable session artifact.
- Full Markdown export via `POST /api/export/markdown`, generated from `GET /api/messages` and downloaded by the browser.
- Selected Markdown export when the user has selected text inside the chat log. This sends `selectedText` to `POST /api/export/markdown` and downloads only that selected range.

`POST /api/export/markdown` also accepts an optional `outputPath`. When provided, the server writes the generated Markdown to that path relative to the current cwd, while still returning the Markdown payload to the browser.

`outputPath` is constrained to a relative path inside the active cwd. Absolute paths and `..` traversal are rejected. Selection exports include basic source metadata such as session id and cwd when RPC state is available.

## Visual Assets

Pi Web stores bundled browser artwork under `packages/coding-agent/src/web/public/assets/`.

- `mikan-mascot.png` is the orange-cat coding assistant mascot. It is currently only rendered as a fallback inside `.mikan-container` (which is hidden by default in the compact sidebar layout). Toggle it back by adding the `show` modifier on `.mikan-container` if a future layout wants it in the sidebar again.
- `mikan-empty-state.png` is the empty conversation illustration shown above the welcome message and quick-prompt chips. This is the only spot the mascot appears on by default.

Both images are transparent PNG assets used by the static browser UI. Keep replacements local to this folder so the Web UI does not depend on generated-image cache paths or remote images.

## Models and Auth

Pi Web exposes two separate model setup flows:

- **Provider auth:** the `Auth` button stores built-in provider credentials in `~/.pi/agent/auth.json`. Use this for providers such as OpenAI API (`openai`), Anthropic (`anthropic`), Google (`google`), OpenRouter (`openrouter`), or ChatGPT Plus/Pro Codex subscription (`openai-codex`) through OAuth.
- **Custom models:** the `Add model` button writes OpenAI-compatible, Anthropic-compatible, or Google-compatible custom entries to `~/.pi/agent/models.json`. Use this for Ollama, LM Studio, vLLM, SGLang, private gateways, and local proxies.

Credential safety:

- `~/.pi/agent/auth.json` is a user-local file outside this repository and must never be copied into the checkout.
- The repository `.gitignore` excludes `.env*`, `auth.json`, private-key files, and common generated directories so local OpenAI/Codex credentials do not become part of normal source commits.
- Before publishing this fork to a remote repository, scan the checkout for real key patterns such as `sk-...`, `sk-proj-...`, GitHub tokens, cloud access keys, and private-key blocks.

Saving provider auth and custom models does not require restarting Pi Web. The RPC bridge refreshes auth and model config when `/api/models` or `/api/model` is called.

For local OpenAI-compatible servers, use:

```text
Provider id: ollama
Model id: qwen2.5-coder:7b
API: openai-completions
Base URL: http://localhost:11434/v1
API key: ollama
Local compat: enabled
```

For ChatGPT Plus/Pro Codex subscription auth, choose provider `openai-codex`, method `OAuth login`, then open the login link shown in the Web UI.

## Skills and Plugins

Pi Web includes a `Resources` panel (`资源与扩展包管理` button on the sidebar's `更多操作` group) for the parts Pi already treats as extensibility resources. The panel is laid out as a tabbed dialog rather than a multi-column dump:

- A summary row at the top shows four colored count pills that double as tab triggers: `⚡ 技能`, `🧩 扩展`, `📦 扩展包`, `📂 路径配置`. The pill for the active tab fills with the tab's accent color (skills = blue, extensions = green, packages = purple, paths = orange).
- Switching tabs only re-renders visibility; the underlying `#skillsList`, `#extensionsList`, `#packagesList` containers keep their existing IDs so `app.js` can keep populating them through `renderResourceList()` and `renderPackages()`.
- Each resource item is one card with a single-line truncated title, single-line truncated path (full path in `title` tooltip), a two-line clamped description, and a row of color-coded chips:
  - `chip-on` (green) / `chip-off` (red) for the enabled flag
  - `chip-scope` (orange) for `全局` / `项目`
  - `chip-source` (gray) for `手动配置` and other sources
  - `chip-origin` (purple) for the package/path origin label
- The tab-switching logic and the count badges are set up in `app.js` via `activateResourceTab(tab)` and the `#skillCountBadge` / `#extensionCountBadge` / `#packageCountBadge` elements inside the count pills.

Each tab contains its corresponding action form so the user does not have to scroll past the list to find the right input:

- **Skills tab:** lists every loaded skill, plus a `新建自定义技能` `<details>` block (open by default) carrying the create-skill form. A subtle hint at the top reminds the user that this form creates a *local* skill by hand, and links to the Packages tab if they actually want to install a published skill bundle through `npm:` / `git:` / a local path.
- **Extensions tab:** lists every discovered extension file. Extensions are discovered automatically from configured paths, so this tab contains no input form. A hint card links to the Paths tab as the place to add new search directories.
- **Packages tab:** lists installed Pi packages with a per-row `移除` button, and an `安装新扩展包` `<details>` block (open by default) with the source input. Three quick-fill chips (`npm:`, `git:github.com/`, `本地路径`) populate the input with the respective prefix and focus the textbox so the user can finish typing.
- **Paths tab:** carries the `资源类型` / `本地目录绝对路径` form for adding or removing user-scope or project-scope paths for `extensions`, `skills`, `prompts`, and `themes`.

Skills and extensions can be previewed through `POST /api/resources/read`. Skill loader diagnostics are displayed at the top of the Skills tab, and top-level skill/extension resources can be enabled or disabled from the row action buttons. Resource mutation endpoints call RPC `reload_resources` after saving settings, so the active session picks up changes without an extra manual reload.

Security boundary:

- Creating a skill writes `SKILL.md` under `~/.pi/agent/skills/<name>/` for global scope or `.pi/skills/<name>/` for project scope.
- Installing Pi packages may execute package manager, git, or package code with local permissions. The Web UI asks before package install, but only install sources you trust.
- Resource changes call the RPC `reload_resources` command so the current session reloads settings, extensions, skills, prompts, and themes without restarting Pi Web.

## Sessions

`GET /api/sessions/list` lists saved JSONL sessions for the active working directory. The response is sorted by most recent activity and includes the session path, id, name, cwd, created/modified timestamps, message count, first user message, and last recorded model.

The Web UI uses this endpoint for the `历史` modal so a user can close the laptop and resume the same project later. The modal includes a cwd selector populated from the active cwd and recent cwd list, allowing saved sessions from another recent project to be browsed without switching the live agent cwd first. `POST /api/session/switch` still delegates the actual resume operation to RPC mode.

The `分支` action calls `GET /api/session/fork-messages` and `POST /api/session/fork`, then puts the selected user message back into the composer for edit-before-resend workflows. If the composer already contains unsent text, Pi Web asks before replacing it.

## Local API

- `GET /api/auth`
- `POST /api/auth/key`
- `POST /api/auth/logout`
- `POST /api/auth/oauth/start`
- `POST /api/auth/oauth/input`
- `POST /api/auth/oauth/cancel`
- `GET /api/custom-models`
- `POST /api/custom-models`
- `GET /api/resources`
- `POST /api/resources/skill`
- `POST /api/resources/read`
- `POST /api/resources/path`
- `POST /api/resources/path/remove`
- `POST /api/resources/enabled`
- `POST /api/resources/package/install`
- `POST /api/resources/package/remove`
- `POST /api/resources/reload`
- `GET /api/cwd`
- `GET /api/state`
- `GET /api/models`
- `GET /api/messages`
- `GET /api/commands`
- `GET /api/sessions/list`
- `GET /api/session/fork-messages`
- `GET /api/session/stats`
- `POST /api/cwd`
- `POST /api/prompt` with optional `files` and `images`
- `POST /api/abort`
- `POST /api/session/new`
- `POST /api/session/switch`
- `POST /api/session/fork`
- `POST /api/session/clone`
- `POST /api/session/name`
- `POST /api/model`
- `POST /api/thinking`
- `POST /api/compact`
- `POST /api/auto-compaction`
- `POST /api/bash`
- `POST /api/bash/abort`
- `POST /api/export`
- `POST /api/export/markdown`
- `WS /api/events`

## Permission Prompting

Pi Web loads a small bundled extension into the RPC process. It asks the Web UI to confirm dangerous bash commands and writes to protected paths such as `.env`, `.git/`, and `node_modules/`.

If no browser is attached, confirmation requests are cancelled instead of hanging forever.

## Fork Boundary

Allowed in this personal fork layer:

- Browser UI layout and styling.
- Browser artwork under `src/web/public/assets/`.
- Local HTTP/WebSocket bridge.
- Web-specific commands and defaults.
- Small safety extensions loaded by `pi-web`.

Avoid unless there is no extension, SDK, or RPC path:

- Rewriting the agent loop.
- Changing provider payload behavior.
- Changing built-in tool semantics.
- Removing existing terminal CLI behavior.
