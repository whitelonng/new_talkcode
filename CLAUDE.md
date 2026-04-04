# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TalkCody is a free, open-source AI Coding Agent desktop application. It uses a two-tier architecture: React 19 + TypeScript frontend (Vite) and Tauri 2 + Rust backend. The project is currently undergoing active refactoring to move AGENT GATEWAY and AI AGENT FRAMEWORK logic into Rust.

## Commands

### Development

```bash
bun run dev              # Start Vite dev server (web only)
bun run tauri dev        # Run desktop app with hot reload
bun run dev:api          # Start API server (apps/api)
```

### Build

```bash
bun run build            # TypeScript + Vite build
bun run tauri build      # Build Tauri desktop app
bun run build:api        # Build API service
```

### Lint & Type Check

```bash
bun run lint             # Biome linter (do not modify biome.json rules)
bun run lint:fix         # Auto-fix linting issues (safe fixes only)
bun run tsc              # TypeScript type check
bun run format:check     # Check formatting
bun run format           # Auto-format
```

### Testing

```bash
bun run test                               # Run all Vitest unit tests
bun run test:file src/path/to/test.test.tsx  # Run a single test file
bun run test:e2e                           # Run Playwright E2E tests
bun run test:coverage                      # Coverage report
cd apps/api && bun run test               # API service tests
cd src-tauri && cargo test --workspace    # Rust tests
```

> Note: Use `bun run test`, not `bun test`.

### Database (API service)

```bash
cd apps/api && bun run db:migrate   # Run migrations
cd apps/api && bun run db:seed      # Seed database
cd apps/api && bun run db:studio    # Open Drizzle Studio
```

## Architecture

### System Layers

```
UI / CLIENT LAYER  →  AGENT GATEWAY (TS + Rust)  →  AI AGENT FRAMEWORK (Rust Core)
```

All UI clients (desktop, web, CLI, IM bots) are thin interaction layers. The agent loop follows: **Plan → Act → Observe → Reflect → Update Context**.

### Frontend (`src/`)

- **`src/pages/`** — Page-level components (agents, skills, projects, marketplace, settings, tool playground, logs, LLM tracing)
- **`src/components/`** — Reusable UI components built with Radix UI + Shadcn UI
- **`src/services/`** — Business logic: AI/LLM integrations, agent execution, database, file ops, MCP server integration
- **`src/stores/`** — Zustand stores (auth, settings, repository, agents)
- **`src/hooks/`** — Custom React hooks
- **`src/lib/`** — Shared utilities; use `simpleFetch` from `@/lib/tauri-fetch` instead of native `fetch`
- **`src/locales/en.ts` / `src/locales/zh.ts`** — i18n strings; all user-visible text must support both English and Chinese

### Backend (`src-tauri/`)

Rust workspace with three members:

- **`core/`** — Shared library: agent loop, built-in tools (bash, file edit, read, search, web fetch), database (libSQL/SQLite), LLM integrations, Feishu/Telegram gateways, tree-sitter code parsing
- **`desktop/`** — Tauri desktop app: window management, file dialogs, process execution, auto-update
- **`server/`** — Axum HTTP server binary

### API Service (`apps/api/`)

Hono web framework + Drizzle ORM + JWT auth. Provides marketplace endpoints and OAuth (GitHub). Deployed to Fly.io (`fly.toml`).

### Shared Package (`packages/shared/`)

Common TypeScript types shared across frontend and API (agent definitions, marketplace types, model configs). Import via `@talkcody/shared`.

## Development Conventions

### TypeScript / Frontend

- Functional components with hooks only — no class components
- Use Shadcn UI components; use Sonner for toast notifications
- File names: kebab-case (e.g., `user-profile.ts`)
- No `any` types; accurate type definitions required
- Avoid dynamic imports
- Use `@tauri-apps/api/path` for path utilities (e.g., `join`, `appDataDir`)
- State management: Zustand only
- UI must support dark mode
- Handle both Windows (`\`) and Unix (`/`) path separators

### Rust / Serde

When serializing Rust structs for TypeScript consumption, use camelCase field names via `#[serde(rename = "...")]`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyResult {
    #[serde(rename = "someField")]
    pub some_field: String,
}
```

### Linting

- Do not modify `biome.json`
- Only use safe (non-unsafe) Biome fixes; fix code manually when needed
- Pre-commit hook runs lint checks (see `.husky/` and `pre-commit.sh`)

### Testing

- Minimize mocking in tests
- Bug fixes must include a test case covering the bug

## Logs and App Data (macOS)

```
# Runtime logs
~/Library/Logs/com.talkcody/talkcody.log
~/Library/Logs/com.com.talkcody.dev/TalkCody Dev.log  # dev mode

# App data
~/Library/Application Support/com.talkcody
```

## Important Notes

- The `docs/` directory is the user documentation website — do not modify it during development
- The project is mid-refactor: new AGENT GATEWAY and FRAMEWORK code should be implemented in Rust
