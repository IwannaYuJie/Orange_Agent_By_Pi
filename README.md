# Orange Agent By Pi

Orange Agent By Pi is a personal AI coding-agent fork built from the open-source [Pi agent harness](https://github.com/earendil-works/pi). It keeps Pi's terminal CLI, agent runtime, model/provider layer, and TUI packages, then adds a local browser workspace for day-to-day personal use.

This repository is not the official Pi project. It is maintained as a personal fork and should be understood as "Orange Agent, powered by Pi".

## What It Includes

- **Local Web workspace:** `pi-web` starts a browser UI at `127.0.0.1:42173`, backed by Pi RPC mode.
- **Original terminal CLI:** the upstream `pi` command remains available for terminal workflows.
- **Multi-provider model support:** OpenAI, Anthropic, Google/Gemini, OpenRouter, Bedrock, Mistral, Groq, Cerebras, xAI, local OpenAI-compatible servers, and custom providers inherited from Pi.
- **Auth and model setup UI:** provider API keys/OAuth and custom model entries can be configured from the Web UI without manually editing JSON files.
- **Chat and tool rendering:** browser rendering for assistant messages, thinking blocks, Markdown, code blocks, and high-frequency tool cards such as `read`, `edit`, `bash`, and `grep`.
- **Session workflows:** saved-session browsing, session switching, session naming, forking from earlier user messages, and token/cost summaries.
- **Prompt attachments:** images, text files, PDFs, pasted screenshots, and recursively dropped folders with common generated directories skipped.
- **Resources panel:** manage skills, extensions, packages, and resource paths from the browser, then reload the active RPC session.
- **Local bash panel:** run one-off local commands from the browser with history recall, abort support, and ANSI foreground colors.
- **Export tools:** export full sessions or selected chat ranges to Markdown, and keep upstream HTML export support.
- **Safety guardrails:** Web permission prompts for dangerous shell commands and protected writes such as `.env`, `.git/`, and `node_modules/`.

## Quick Start

Requirements:

- Node.js `>=22.19.0`
- npm

Install dependencies without lifecycle scripts:

```bash
npm install --ignore-scripts
```

Build the workspace:

```bash
npm run build
```

Start the local browser UI:

```bash
npm run web
```

Or, after installing/packing the CLI package, run:

```bash
pi-web
```

Useful options:

```bash
pi-web --open
pi-web --port 43173
pi-web --cwd /path/to/project
pi-web -- --provider anthropic --model claude-sonnet-4-20250514
```

Arguments after `--` are forwarded to the internal `pi --mode rpc` process.

## Terminal CLI

The original Pi terminal agent is still available:

```bash
./pi-test.sh
```

After building or installing the package:

```bash
pi
```

The Web layer is intentionally a light fork layer. It proxies Pi RPC behavior instead of replacing the upstream agent loop, provider registry, session persistence, or tool execution.

## Project Structure

| Path | Purpose |
| ---- | ------- |
| `packages/coding-agent/src/web/` | Orange Agent Web server, RPC bridge, WebSocket bridge, resource manager, and browser assets |
| `packages/coding-agent/docs/pi-web.md` | Detailed Web UI, API, auth, session, and resource-management documentation |
| `packages/coding-agent` | Pi coding-agent CLI plus the added `pi-web` entrypoint |
| `packages/agent` | Core agent runtime, state management, and tool-call loop |
| `packages/ai` | Unified model/provider API inherited from Pi |
| `packages/tui` | Terminal UI rendering library inherited from Pi |

## Security Notes

- Provider credentials are stored in the user-local Pi config directory, normally `~/.pi/agent/auth.json`.
- That auth file is outside this repository and should never be copied into the checkout.
- `.gitignore` excludes `.env*`, `auth.json`, private-key files, build output, and dependency directories.
- Before publishing changes, scan for real key patterns such as `sk-...`, `sk-proj-...`, GitHub tokens, cloud access keys, and private-key blocks.
- The Web UI binds to `127.0.0.1` by default and is designed for local use.

## Development

Common commands:

```bash
npm install --ignore-scripts
npm run check
npm --prefix packages/coding-agent run test -- test/web-server.test.ts
npm run build
```

Notes:

- `npm run check` runs formatting/lint checks, pinned-dependency checks, TypeScript checks, shrinkwrap checks, and browser smoke checks.
- Dependency and lockfile changes should be reviewed deliberately. This repo inherits Pi's supply-chain hardening rules.
- Use `packages/coding-agent/docs/pi-web.md` as the feature reference for the local Web UI.

## Upstream Attribution

This project is based on [earendil-works/pi](https://github.com/earendil-works/pi), the Pi Agent Harness Mono Repo.

Major inherited components:

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-tui`

The original Pi project is licensed under MIT. This fork keeps the original license notice and adds personal Web-oriented changes on top.

## License

MIT. See [LICENSE](LICENSE).
