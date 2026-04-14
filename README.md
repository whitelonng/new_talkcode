<div align="center">

<h1 style="border-bottom: none;">TalkCody</h1>

**免费开源的 AI 编码助手**

[![GitHub release](https://img.shields.io/github/v/release/whitelonng/Talkcody)](https://github.com/whitelonng/Talkcody/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[![TalkCody](https://cdn.talkcody.com/images/talkcody-architecture.jpg)](https://talkcody.com)


</div>
### 微信交流群

<img src="./docs/images/群二维码.png" alt="TalkCody 微信交流群二维码" width="360" />

### 联系方式

<img src="./docs/images/联系方式.png" alt="TalkCody 联系方式" width="360" />

## 项目简介

TalkCody 是一个真正贴近开发者工作方式的 **AI Coding Agent**：**并行、可控、私密、本地优先**。

和只能依赖云端、受限于单一模型、甚至需要上传代码的 AI 工具不同，TalkCody 提供：

- **真正自由**：可接入 OpenAI、Anthropic、Google 以及本地模型，无厂商锁定
- **更高速度**：独特的四级并行机制，可同时处理多个任务
- **更强隐私**：数据与代码优先保留在本地
- **更低成本**：支持多种免费使用方式，也可复用你现有的 ChatGPT Plus / GitHub Copilot 等订阅

**为重视速度、成本、控制权与隐私的开发者而生。**

## 为什么选择 TalkCody

### 🚀 极速开发
- **[四级并行](https://www.talkcody.com/blog/four-level-parallelism)**：项目、任务、Agent、工具四层并行执行，更快完成复杂开发工作

### 💰 灵活低成本
- **[9 种免费使用方式](https://www.talkcody.com/docs/guides/free-use)**
- **复用现有订阅**：支持结合 [ChatGPT Plus/Pro](https://www.talkcody.com/docs/features/openai-plus-plan) 与 [GitHub Copilot](https://www.talkcody.com/docs/features/github-copilot)
- **任意模型任意提供商**：可随时切换 OpenAI、Anthropic、Google 或本地模型

### 🔒 隐私优先
- **100% 本地存储**：会话、数据、代码尽可能保留在本机
- **支持离线**：结合 Ollama 或 LM Studio 可离线工作
- **完全可审计**：开源代码可自行检查

### 🛠️ 专业能力
- **多模态输入**：支持文本、语音、图片、文件
- **MCP Server 支持**：可扩展更多工具与服务
- **Agents & Skills Marketplace**：可下载和共享社区工作流
- **高度可定制**：提示词、Agent、Tools、MCP Server 都可配置
- **内置终端**：无需来回切换上下文
- **原生性能**：基于 Rust + Tauri 构建

## 安装

支持以下平台：

- **Windows**（x64）
- **Linux**（x86_64 AppImage）

## 环境要求

如果你需要本地开发或从源码启动，建议先准备以下环境：

- **Node.js**：建议 20+
- **Bun**：建议使用最新稳定版
- **Rust**：Tauri 桌面端开发必需
- **Tauri 依赖**：不同系统需要对应原生依赖
  - Windows：Visual Studio C++ Build Tools / WebView2
  - macOS：Xcode Command Line Tools
  - Linux：gtk/webkit2gtk 等系统依赖

你也可以参考官方开发文档：

📖 **[开发环境搭建文档](https://www.talkcody.com/docs/open-source/development-setup)**

## 下载依赖

在项目根目录执行：

```bash
bun install
```

如果你还需要单独启动 API 或文档站，这些子项目依赖也会通过 workspace 一并安装。

## 启动方法

### 1. 启动前端开发环境

```bash
bun run dev
```

默认启动 Vite 前端开发服务。

### 2. 启动桌面端（Tauri）

```bash
bun run dev:tauri
```

该命令会启动 Tauri 桌面应用，适合本地完整调试。

### 3. 启动 API 服务

```bash
bun run dev:api
```

该命令会进入 `apps/api` 并启动 Bun + Hono API 服务。

### 4. 启动文档站

```bash
cd docs
bun run dev
```

### 5. 构建项目

```bash
bun run build
```

### 6. 类型检查

```bash
bun run type-check
```

### 7. 运行测试

```bash
bun run test
```

## 架构

TalkCody 采用 React 19 + TypeScript 前端，以及 Tauri 2 + Rust 后端的双层架构。

📖 **[架构说明](https://talkcody.com/docs/open-source/architecture)**

## 路线图

查看 **[ROADMAP](https://talkcody.com/docs/open-source/roadmap)** 了解后续开发方向。

## 更新日志

查看 **[CHANGELOG](https://talkcody.com/docs/changelog)** 了解版本历史与发布说明。

## 贡献

欢迎提交 Issue 和 PR，详情请见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 社区

- **仓库**：[GitHub Repository](https://github.com/whitelonng/Talkcody)
- **问题反馈**：[GitHub Issues](https://github.com/whitelonng/Talkcody/issues)
- **交流讨论**：[GitHub Discussions](https://github.com/whitelonng/Talkcody/discussions)



## 许可证

本项目基于 MIT License 开源，详见 [LICENSE](LICENSE)。

原始上游项目： [talkcody/talkcody](https://github.com/talkcody/talkcody)

当前仓库基于上游项目继续维护，并保留 MIT 协议要求的归属说明。

## 致谢

- [Tauri](https://github.com/tauri-apps/tauri)
- [Bun](https://github.com/oven-sh/bun)
- [Monaco Editor](https://github.com/microsoft/monaco-editor)
- [libSQL](https://github.com/tursodatabase/libsql)
- [Shadcn UI](https://github.com/shadcn-ui/ui)
- [Fumadocs](https://github.com/fuma-nama/fumadocs)
- [opencode-openai-codex-auth](https://github.com/numman-ali/opencode-openai-codex-auth)
- [baoyu-skills](https://github.com/JimLiu/baoyu-skills)
- [AionUi](https://github.com/iOfficeAI/AionUi) — 在外部 CLI Agent 接入、多 Agent 统一管理与协议化接入思路上提供了重要参考，感谢项目作者与社区的开源分享。
(https://linux.do/)LINUX DO 本项目也在 LINUX DO 社区 持续分享与交流。
