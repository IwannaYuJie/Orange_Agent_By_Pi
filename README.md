# Orange Agent By Pi

Orange Agent By Pi 是一个个人向 AI 编程助手项目，基于开源的 [Pi agent harness](https://github.com/earendil-works/pi) 二次开发。它保留了 Pi 原本的终端 CLI、Agent 运行时、多模型接入层和 TUI 能力，并在此基础上加入了更适合日常使用的本地浏览器工作台。

这个仓库不是官方 Pi 项目，而是个人维护的 fork。可以理解为：**Orange Agent，powered by Pi**。

## 功能概览

- **本地 Web 工作台：** `pi-web` 会在 `127.0.0.1:42173` 启动浏览器界面，底层通过 Pi RPC 模式驱动。
- **保留原始终端 CLI：** 上游 `pi` 命令仍然可用，终端工作流不受影响。
- **多模型 / 多供应商支持：** 继承 Pi 的 OpenAI、Anthropic、Google/Gemini、OpenRouter、Bedrock、Mistral、Groq、Cerebras、xAI、本地 OpenAI-compatible 服务和自定义 provider 支持。
- **认证和模型配置界面：** 可以在 Web UI 中配置 provider API key、OAuth 登录和自定义模型，不需要手动改 JSON。
- **聊天和工具调用渲染：** 浏览器内支持 assistant 消息、thinking 块、Markdown、代码块，以及 `read`、`edit`、`bash`、`grep` 等高频工具卡片。
- **会话管理：** 支持历史会话浏览、切换、命名、从旧消息分支继续，以及 token / cost 统计。
- **提示词附件：** 支持图片、文本文件、PDF、剪贴板截图和拖拽文件夹；常见生成目录会自动跳过。
- **资源管理面板：** 可以管理 skills、extensions、packages 和资源路径，并让当前 RPC 会话即时重载。
- **本地 Bash 面板：** 可以在浏览器里跑一次性本地命令，支持历史记录、终止命令和基础 ANSI 颜色。
- **导出能力：** 支持完整会话或选中文本导出 Markdown，同时保留上游 HTML 导出。
- **安全防护：** 对危险 shell 命令和 `.env`、`.git/`、`node_modules/` 等受保护路径写入做 Web 确认。

## 快速开始

环境要求：

- Node.js `>=22.19.0`
- npm

安装依赖，且不执行依赖生命周期脚本：

```bash
npm install --ignore-scripts
```

构建项目：

```bash
npm run build
```

启动本地浏览器界面：

```bash
npm run web
```

macOS 也可以直接双击仓库内的一键启动脚本：

```text
scripts/macos/start-orange-agent-web.command
```

这个脚本会自动定位当前仓库、必要时执行 `npm install --ignore-scripts`，然后通过 LaunchAgent 在后台启动 Orange Agent Web 并打开浏览器。

如果已经安装或打包 CLI，也可以直接运行：

```bash
pi-web
```

常用启动参数：

```bash
pi-web --open
pi-web --port 43173
pi-web --cwd /path/to/project
pi-web -- --provider anthropic --model claude-sonnet-4-20250514
```

`--` 后面的参数会转发给内部的 `pi --mode rpc` 进程。

## 终端 CLI

原始 Pi 终端助手仍然保留：

```bash
./pi-test.sh
```

构建或安装后也可以使用：

```bash
pi
```

Web 层只是一个轻量 fork 层：它代理 Pi RPC 能力，不重写上游 agent loop、provider registry、会话持久化和工具执行逻辑。

## 项目结构

| 路径 | 说明 |
| ---- | ---- |
| `scripts/macos/start-orange-agent-web.command` | macOS 一键启动脚本，可双击启动本地 Web 工作台 |
| `packages/coding-agent/src/web/` | Orange Agent Web 服务端、RPC 桥、WebSocket 桥、资源管理器和浏览器静态资源 |
| `packages/coding-agent/docs/pi-web.md` | Web UI、API、认证、会话和资源管理的详细文档 |
| `packages/coding-agent` | Pi coding-agent CLI，以及新增的 `pi-web` 入口 |
| `packages/agent` | Agent 运行时、状态管理和工具调用循环 |
| `packages/ai` | 继承自 Pi 的统一模型 / provider API |
| `packages/tui` | 继承自 Pi 的终端 UI 渲染库 |

## 安全说明

- Provider 认证信息保存在用户本机 Pi 配置目录，通常是 `~/.pi/agent/auth.json`。
- 这个认证文件在仓库外部，不能复制进 checkout。
- `.gitignore` 已排除 `.env*`、`auth.json`、私钥文件、构建产物和依赖目录。
- 发布前应扫描真实密钥模式，例如 `sk-...`、`sk-proj-...`、GitHub token、云访问密钥和私钥块。
- Web UI 默认只绑定 `127.0.0.1`，定位是本机自用工具。

## 开发命令

常用命令：

```bash
npm install --ignore-scripts
npm run check
npm --prefix packages/coding-agent run test -- test/web-server.test.ts
npm run build
```

补充说明：

- `npm run check` 会执行格式 / lint 检查、依赖固定检查、TypeScript 检查、shrinkwrap 检查和浏览器 smoke 检查。
- 依赖和 lockfile 变更需要谨慎审查，本仓库继承了 Pi 的供应链加固规则。
- 本地 Web UI 的功能细节以 `packages/coding-agent/docs/pi-web.md` 为准。

## 上游来源

本项目基于 [earendil-works/pi](https://github.com/earendil-works/pi)，也就是 Pi Agent Harness Mono Repo。

主要继承组件：

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-tui`

原始 Pi 项目使用 MIT License。本 fork 保留原始许可证声明，并在其基础上加入个人 Web 工作台相关改动。

## 许可证

MIT。详见 [LICENSE](LICENSE)。
