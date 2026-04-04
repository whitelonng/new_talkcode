# Project Development Guide for AI Agents

## Project Overview

TalkCody 1.0 adopts a unified AI Agent architecture that supports both **Local** and **Service** deployment modes. All UI clients (Desktop, Mobile, Web, CLI, IM bots) function as thin interaction layers, communicating with the backend Agent service through a unified interface.

## Architecture Diagram

```
+----------------------------------------------------------------------------------+
|                                 UI / CLIENT LAYER                                |
+----------------------------------------------------------------------------------+
|  +----------+  +----------+  +----------+  +----------+  +----------+  +--------+ |
|  | Desktop  |  | Mobile   |  |   Web    |  |   CLI    |  |  IM Bots |  |  Other | |
|  | (mac/lnx)|  | iOS/Andr |  | Browser  |  |  TTY     |  | Feishu/  |  |  SDKs  | |
|  | Windows  |  |          |  |          |  |          |  | TG/Slack |  |        | |
|  +----------+  +----------+  +----------+  +----------+  +----------+  +--------+ |
+----------------------------------------------------------------------------------+
        |                                    |
        |                                    |
   +----+----+                          +----+----+
   |  LOCAL  |                          | SERVICE |
   |  MODE   |                          |  MODE   |
   | (Device)|                          | (Cloud) |
   +----+----+                          +----+----+
        |                                    |
        +----------------+-------------------+
                         |
                         v
+----------------------------------------------------------------------------------+
|                                  AGENT GATEWAY                                   |
|  +------------------+  +------------------+  +------------------+  +-----------+ |
|  | Auth & Tenancy   |  | Routing & Policy |  | Rate Limit & QoS |  | API Mgmt | |
|  +------------------+  +------------------+  +------------------+  +-----------+ |
|  +------------------+  +------------------+  +------------------+              |
|  | Session Manager  |  | Context Broker   |  | Tool Registry    |              |
|  +------------------+  +------------------+  +------------------+              |
+----------------------------------------------------------------------------------+
                                       |
                                       v
+----------------------------------------------------------------------------------+
|                              AI AGENT FRAMEWORK (Rust)                           |
|                                                                                  |
|   +--------------------+     +--------------------+     +--------------------+   |
|   |       TOOLS        |     |       SKILLS       |     |      MEMORY        |   |
|   | (exec, file, db)   |     | (domain modules)   |     | (short/long term)   |   |
|   +--------------------+     +--------------------+     +--------------------+   |
|                                                                                  |
|   +--------------------+     +--------------------+     +--------------------+   |
|   |      CONTEXT       |     |   OBSERVABILITY    |     |        LLM         |   |
|   | (state & buffers)  |     | (logs/metrics)     |     | (local/service)    |   |
|   +--------------------+     +--------------------+     +--------------------+   |
|                                                                                  |
|                         +------------------------------+                         |
|                         |          AGENT LOOP          |                         |
|                         |  Plan -> Act -> Observe ->   |                         |
|                         |  Reflect -> Update Context   |                         |
|                         +------------------------------+                         |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

Important Notes:

The entire project is cur$$rently undergoing a refactoring process. New code for both the AI ​​agent (AGENT GATEWAY) and AI agent (FRAMEWORK) needs to be implemented in Rust.

## Technology Stack

### Frontend

- Framework: React 19
- Language: TypeScript
- Styling: Tailwind CSS + Shadcn UI
- Testing: Vitest
- State Management: Zustand

### Backend

- Framework: Tauri 2
- Language: Rust

### Database

- Type: SQLite

## Project Structure

```
talkcody/
│
├── src/                    # Main source code directory
│   ├── components/         # React UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions and shared logic
│   ├── pages/              # Page components
│   ├── styles/             # Global styles and CSS
│   └── types/              # TypeScript type definitions
|   ├── services/           # AI, database and other services
|   ├── utils/
│
├── src-tauri/              # Rust backend code
│   ├── src/                # Rust source files
│   ├── Cargo.toml
│   └── tauri.conf.json
|   package.json
|   tsconfig.json
|   vite.config.ts
```

### Backend API Service

apps/api/ - API Service

Test Command:
```
cd apps/api
bun run test
```

### locales Directory

- src/locales/en.ts - English locale file
- src/locales/zh.ts - Chinese locale file
- src/locales/types.ts - Locale type definitions
- src/hooks/use-locale.ts - Custom hook for locale management

### Important Notes

- The docs directory is the user documentation website and does not need to be modified during development.

## Development Guidelines

1. Frontend Development Rules:
   - Solve functions on the frontend using TypeScript when possible
   - Using Functional Components with Hooks (Classless Components)
   - Use Shadcn UI components (no need to provide source code)
   - Use English for comments and text

2. Naming Conventions:
   - File names: kebab-case (e.g., `user-profile.ts`)
   - Use Sonner component for toast notifications

3. Bug fixing:
   - must write a test case to cover the bug
   - Fix the bug and ensure all tests pass

4. Validation and Linting:
   - Use `bun run lint` to check code quality before committing changes.
   - Use `bun run tsc` to ensure type safety.
   - Use `bun run test` to run all tests and ensure functionality.

### bun run lint Fixes

- Cannot modify the rules in biome.json; only fix code to pass lint checks.
- When fixing code, try to keep the original logic unchanged and avoid introducing new issues.
- Perform fixes in parallel as much as possible to reduce fixing time.
- Do not use biome's unsafe fixes; you should manually fix the code.

## Useful Bash Commands

### Project Setup

```bash
# Run Tauri app
bun run tauri dev

# Build Tauri app
bun run tauri build
```

### Development Workflow

```bash

bun run tsc

# Lint code
bun run lint

# Run tests
bun run test

# Run single test file
bun run test:file src/path/to/your/test-file.test.tsx

# build
bun run build
```

Note: You couldn't use `bun test` command. must use `bun run test` instead.

### Log Directory

TalkCody runtime log path:

```
~/Library/Logs/com.talkcody/talkcody.log
```

The log in macOS dev env:

```
~/Library/Logs/com.com.talkcody.dev/TalkCody\ Dev.log
```

### App data directory

TalkCody app data path:

```
~/Library/Application Support/com.talkcody
```

## AI Code Generation Tips

### Files import in TS code

you should use '@tauri-apps/api/path'. like this:

```typescript
import { join, normalize, isAbsolute, appDataDir, dirname} from '@tauri-apps/api/path';
```


When generating code, consider:

- Follow React functional component patterns
- Use Tailwind CSS for styling
- Implement responsive design
- UI must support dark mode
- Use accurate type definitions and do not use `any` types
- Keep components modular and reusable
- Use zustand for state management in ts
- Try to avoid using dynamic imports in ts
- User-visible messages and text need to support both English and Chinese.
- Platform-related functions must be able to work simultaneously on macOS, Windows, and Linux platforms.
- when handle the file path, should consider the windows path separator `\` and the unix path separator `/`.
- when serde the rust command, your serialization format should be compatible with TS.
  - example:
  ```
 #[derive(Debug, Clone, Serialize, Deserialize)]
 pub struct ContextCompactionResult {
     #[serde(rename = "compressedSummary")]
     pub compressed_summary: String,
 }
```
- when need fetch in ts, use `simpleFetch` from `@/lib/tauri-fetch`, not `fetch`.
- When adding test cases, you should minimize mocking as much as possible.