# Cloud Backend Refactor (Rust Core) - Design Spec

## 1. Purpose and Scope
This document defines the refactor design that moves TalkCody's core agent runtime into a Rust backend that can run on a single host (desktop or cloud) and serve all clients (desktop, web, iOS, CLI, IM). The goal is architecture, contracts, and migration plan only. No implementation is included.

## 2. Non-Goals (Now)
- No changes to `apps/api` (remains separate and unchanged).
- No API key lifecycle endpoints (rotation/revocation) yet.
- No CORS allowlist management yet.
- No multi-tenant capabilities.
- No UI redesign.

## 3. Assumptions and Constraints
- Single-tenant: one user, one backend instance.
- Workspace model: backend host clones GitHub repositories to local storage and operates on those copies.
- Tools execute only on the backend host (desktop or cloud), not on clients.
- Streaming behavior and user experience should match current desktop behavior.
- Use any available port; no fixed port requirement.
- English, ASCII documentation.

## 4. Target Architecture Overview
All clients talk to a single Rust backend over HTTP + SSE + WebSocket. The backend owns task lifecycle, message storage, agent loop, and tool execution. Clients are UI-only.

```
+-----------------------------+
|         UI Clients          |
| Desktop | Web | iOS | CLI   |
| Telegram | Feishu | Slack   |
| Discord | WhatsApp          |
+--------------+--------------+
               |
               | HTTPS + SSE + WS
               v
+-----------------------------+
|     Rust Core Backend       |
| (Cloud OR Desktop Host)     |
+------------+----------------+
             |
+------------+----------------+--------------------+
|                             |                    |
|         Core Runtime        |     Integrations   |
| Tasks / Agents / Tools      | IM Channels        |
|                             | (Telegram/Feishu)  |
+------------+----------------+--------------------+
             |
+------------+----------------+--------------------+
|                             |                    |
|          Platform           |      Storage       |
| FS/Git/Shell/LSP            | SQLite + Files     |
+-----------------------------+--------------------+
```

## 5. Module Boundaries (Rust)
- `core/`:
  - Task/session lifecycle, agent loop, tool dispatch, settings validation.
- `storage/`:
  - SQLite repositories (chat_history.db, agents.db, settings.db), migrations, attachment metadata.
- `platform/`:
  - Filesystem, git/worktree, shell, LSP operations (backend-host local).
- `server/`:
  - HTTP routes, SSE streams, WebSocket handlers, middleware.
- `streaming/`:
  - Event types, throttling rules, resume offsets.
- `security/`:
  - API key header validation (single-tenant).
- `integrations/`:
  - IM adapters (Telegram/Feishu now; Slack/Discord/WhatsApp future).

## 6. Workspace Model
- Backend host clones GitHub repositories to a local workspace directory.
- All tool execution (git, file IO, LSP) operates on backend-host local clones.
- The workspace location is a backend config setting (default per platform).
- If backend runs in cloud, workspace is stored on a persistent volume.

## 7. Tool Execution Model
- Tools run only on the backend host, not in client environments.
- Clients call the backend to trigger tool actions and receive tool results.
- Tool interfaces remain the same; only orchestration moves into Rust core runtime.

## 8. Data and Storage Strategy
- Preserve the 3-DB split:
  - `chat_history.db`
  - `agents.db`
  - `settings.db`
- SQLite in WAL mode; single instance only.
- Attachments stored on backend host filesystem.
- In cloud, use persistent volume for DBs + attachments.

## 9. API Contract (v1)
Transport:
- REST for lifecycle and configuration.
- SSE for streaming tokens and events.
- WebSocket for bidirectional control and remote channel edits.

Proposed endpoints:
- `POST /v1/sessions` (create task/session)
- `POST /v1/sessions/{id}/messages` (user message)
- `GET /v1/sessions/{id}/events` (SSE stream)
- `POST /v1/sessions/{id}/actions` (approve/reject/tool response)
- `GET /v1/tasks/{id}` / `PATCH /v1/tasks/{id}` (settings)
- `POST /v1/files` / `GET /v1/files/{id}` (attachments)
- `POST /v1/remote/{channel}/send` (IM outbound)

Contracts:
- JSON schema and OpenAPI to be defined during implementation.
- Shared TS types and SDK to live in `packages/shared`.

## 10. Streaming and Event Model
SSE events (example):
- `token`
- `message.final`
- `tool.call`
- `tool.result`
- `status`
- `error`

Rules:
- Stream throttling to match current desktop behavior (edit updates about 1s cadence).
- Resume tokens for reconnects.
- Per-channel message length limits enforced by backend.

## 11. Port Selection and Discovery
- Backend binds to any available port.
- Clients obtain backend URL through configuration or discovery (to be defined in implementation).
- No fixed default port requirement.

## 12. Security Model
- Single-tenant API key header required on all endpoints.
- API key lifecycle management is deferred to a future phase.
- CORS allowlist management is deferred to a future phase.

## 13. Client Adaptation
- Desktop: switch to backend API even when local (loopback).
- Web/iOS/CLI: connect to the same backend API using shared SDK.
- IM channels: move orchestration into backend integrations, not frontend services.

## 14. Migration Plan (Phased)
1) Extract core runtime + storage interfaces; keep desktop behavior intact.
2) Add HTTP/SSE/WS server mode for the same runtime.
3) Desktop connects to local server for parity validation.
4) Enable cloud deployment with SQLite on persistent volume.
5) Move IM orchestration into backend integrations.
6) Ship web/iOS/CLI clients against cloud endpoint.
7) Deprecate legacy frontend orchestration after parity.

## 15. Risks and Deferred Items
- Cloud tool safety: backend host runs git/shell; hardening required.
- Streaming latency and IM edit limits in cloud environments.
- SQLite single-instance limitations; must remain single-node.
- Deferred: API key lifecycle, CORS allowlist, multi-tenant.

## 16. Related Specs
- `specs/remote-chat-integration.md`
- `specs/http-request-architecture.md`
- `specs/core-concepts.md`
