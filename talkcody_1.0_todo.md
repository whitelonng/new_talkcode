# TalkCody 1.0 TODO (Architecture Implementation)

This document maps `/Users/kks/mygit/talkcody/specs/architecture.md` to concrete milestones and implementation steps, aligned with the current codebase.

## Legend
- ✅ Done
- 🔄 In Progress
- ⚠️ Partial
- ⏳ Pending

## Milestone 1: Agent Core Infrastructure (Plan -> Act -> Observe -> Reflect -> Update Context)
Status: ✅ / ⚠️

Scope: Agent loop runtime, tool dispatch, session/task types.

Key areas (existing):
- Rust core: `src-tauri/src/core/agent_loop.rs`, `src-tauri/src/core/tools.rs`, `src-tauri/src/core/types.rs`
- TS services: `src/services/agents/llm-service.ts`, `src/services/agents/tool-executor.ts`, `src/services/agents/stream-processor.ts`

Steps:
1. Verify agent loop handles tool calls, streaming, and max-iteration limits (Rust + TS).
2. Ensure tool request/response types are consistent between Rust and TS.
3. Harden error handling for failed tool calls and streaming disconnects.

Acceptance:
- Agent can execute a simple multi-step task (read file -> search -> summarize).
- Tool calls stream correctly and errors are surfaced to UI.

---

## Milestone 2: Tools System (Execution Environment + Registry)
Status: 🔄

Scope: built-in tools, custom tools, tool registry, tool playground, MCP.

Key areas (existing):
- Built-in tools: `src/lib/tools/`
- Tool registry: `src/services/agents/tool-registry.ts`, `src-tauri/src/core/tool_definitions.rs`
- Custom tool pipeline: `src/services/tools/custom-tool-bun-runner.ts`, `src/services/tools/custom-tool-compiler.ts`
- Tool playground: `src/pages/tool-playground-page.tsx`
- MCP integration: `src/lib/mcp/`

Steps:
1. Complete custom tool runtime execution sandbox and permission checks.
2. Finalize custom tool compilation pipeline (TS -> bundle).
3. Finish tool playground UX for testing and inspection.
4. Validate MCP server discovery and tool invocation.

Acceptance:
- Users can create, compile, and run custom tools.
- Tool playground executes tools with visible inputs/outputs.
- MCP tools are discoverable and callable.

---

## Milestone 3: Skills System (Domain Modules)
Status: 🔄

Scope: skill definitions, validation, agent-skill integration, marketplace sync.

Key areas (existing):
- Skill service: `src/services/skills/skill-service.ts`
- Skill parser: `src/services/skills/skill-md-parser.ts`
- Agent-skill integration: `src/services/skills/agent-skill-service.ts`
- Skill UI: `src/pages/skills-page.tsx`, `src/components/skills/`

Steps:
1. Complete skill forking (local customization) and conflict resolution.
2. Implement remote skill sync from marketplace (download/update/remove).
3. Ensure skill permissions and tool access policies are enforced.

Acceptance:
- Skills can be enabled per agent and executed during tasks.
- Forked skills can be edited and reloaded without app restart.
- Remote skill updates sync reliably.

---

## Milestone 4: Context & Memory (Short-Term + Long-Term)
Status: 🔄 / ⏳

Scope: context compaction, memory persistence, retrieval.

Key areas (existing):
- Context compactor: `src/services/context/context-compactor.ts`
- Context filter/rewriter: `src/services/context/context-filter.ts`, `src/services/context/context-rewriter.ts`
- Rust compaction service: `src-tauri/src/llm/ai_services/context_compaction_service.rs`

Steps:
1. Define short-term memory buffers and update flows (session-scoped).
2. Implement long-term memory storage with semantic retrieval.
3. Add memory search and relevance scoring to agent loop.
4. Add memory visibility/controls in UI (opt-in, clear, export).

Acceptance:
- Context compaction triggers correctly and preserves task intent.
- Long conversations maintain coherence without performance degradation.
- Memory retrieval improves answer quality without leakage.

---

## Milestone 5: LLM Integration (Local + Service)
Status: ✅ / ⏳

Scope: multi-provider support, streaming, local model support.

Key areas (existing):
- Providers: `src-tauri/src/llm/providers/`
- LLM client: `src/services/llm/llm-client.ts`
- Stream handling: `src/services/llm/llm-event-stream.ts`

Steps:
1. Finalize local provider adapters (Ollama, LM Studio, llama.cpp).
2. Validate rate-limits and retries across providers.
3. Add provider diagnostics in UI (latency, errors, rate limits).

Acceptance:
- At least one local model provider works end-to-end.
- Streaming works with reconnection and partial output handling.

---

## Milestone 6: Observability (Logs, Tracing, Metrics)
Status: ⚠️

Scope: logging, tracing UI, usage metrics.

Key areas (existing):
- Logging: `src/lib/logger.ts`, `src-tauri/src/lib.rs`
- Tracing: `src-tauri/src/llm/tracing/`, `src/services/database/trace-service.ts`
- UI: `src/pages/llm-tracing-page.tsx`, `src/pages/usage-dashboard-page.tsx`

Steps:
1. Complete API usage and token-cost metrics integration.
2. Track tool execution timing and agent iteration counts.
3. Improve trace filtering and export from UI.

Acceptance:
- Usage dashboard shows accurate cost/usage per provider.
- Traces are searchable and correlate to sessions/tasks.

---

## Milestone 7: Agent Gateway (Auth, Routing, Session, Policy)
Status: 🔄 / ⏳

Scope: unified entrypoint, auth, rate limit/QoS, policy, session.

Key areas (existing):
- Server routes: `src-tauri/src/server/routes/`
- Session: `src-tauri/src/core/session.rs`
- Auth service: `src/services/auth-service.ts`

Steps:
1. Finish authentication flows and secure API key handling.
2. Add policy engine for access control and tool restrictions.
3. Implement rate limit/QoS rules at gateway layer.
4. Document versioned API routes and compatibility matrix.

Acceptance:
- Sessions persist across restarts.
- Requests enforce policy and rate limits.
- Auth failures are handled consistently.

---

## Milestone 8: Deployment Modes (Local + Service)
Status: 🔄 / ⏳

Scope: local mode parity, cloud gateway, sync.

Key areas (existing):
- Local desktop (Tauri): `src-tauri/`

Steps:
1. Stabilize offline local-mode behavior (no provider errors).
2. Define cloud gateway deployment (Docker/K8s manifests).
3. Implement settings and data sync across devices.
4. Ensure local/service mode uses identical API contract.

Acceptance:
- Local mode works without internet.
- Service mode supports multi-user workloads.
- Mode switching does not break session history.

---

## Milestone 9: Client Layer Expansion
Status: 🔄 / ⏳

Scope: desktop parity, web, mobile, CLI, IM bots.

Key areas (existing):
- Desktop: `src/` + `src-tauri/`
- IM bots: `src-tauri/src/telegram_gateway.rs`, `src-tauri/src/feishu_gateway.rs`

Steps:
1. Define web client target (React web) and auth flow.
2. Build CLI client with streaming and tool approval.
3. Add mobile client plan (React Native) and shared core API.
4. Validate bot integrations against the unified gateway.

Acceptance:
- Each client can connect to the same gateway API.
- Core feature parity across clients (chat, tools, tasks).

---

## Implementation Order (Suggested)
1. Tools System
2. Context & Memory
3. Agent Gateway
4. Observability
5. Deployment Modes
6. Client Expansion

## Verification Checklist (Cross-Cutting)
- `bun run test`
- `bun run lint`
- `bun run tsc`
- Manual smoke: create task, call tool, stream output, resume session
