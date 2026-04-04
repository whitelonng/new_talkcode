# Remote Chat Integration (Telegram + Feishu)

This document describes the current Telegram and Feishu remote chat integration in TalkCody, including architecture, core flows, and file responsibilities. It also outlines practical layering and extensibility improvements.

## High-Level Architecture

- **Rust gateways (Tauri backend)**: Connect to Telegram and Feishu APIs, receive inbound messages, download attachments, and emit frontend events. Provide Tauri commands for start/stop/config/status/send/edit.
- **Frontend channel adapters**: Bridge each Rust gateway into a unified, channel-agnostic message shape.
- **Remote chat service**: Owns session lifecycle, task creation, command routing, streaming output, approvals, and status checks.
- **Lifecycle service**: Starts/stops remote chat based on settings; applies keep-awake.
- **Media pipeline**: Transforms downloaded attachments into LLM-ready payloads (image base64, audio transcription).
- **Settings + UI**: Persist config in settings store (SQLite), surface forms and validation.

```
Telegram Bot API (polling)        Feishu Open Platform (WebSocket)
        |                                   |
        v                                   v
src-tauri/src/telegram_gateway.rs   src-tauri/src/feishu_gateway.rs
        |     (emit events)                |     (emit events)
        +------------+----------------------+ 
                     v
        src/services/remote/channels/*-channel-adapter.ts
                     v
            src/services/remote/remote-channel-manager.ts
                     v
            src/services/remote/remote-chat-service.ts
              |        |         |        |
              v        v         v        v
     ExecutionService  TaskService  EditReviewStore  RemoteMediaService
                     v
            Chat output -> channel adapter -> Rust gateway -> chat app
```

## Core Flow

### 1) Configuration + Startup
1. User configures Telegram/Feishu credentials in Settings.
2. Settings are stored via `settingsManager` (SQLite-backed store).
3. `RemoteServiceRunner` initializes lifecycle service.
4. `RemoteControlLifecycleService` checks enabled channels and applies keep-awake.
5. `remoteChatService.start()` starts all registered channel adapters.

### 2) Inbound Messages
1. **Telegram** gateway long-polls `getUpdates` (with offset) and filters group chats and allowlist.
2. **Feishu** gateway keeps a WebSocket connection; filters sender type (user) and chat type (p2p) and allowlist.
3. Gateways download attachments (photo/audio/file) to app data `attachments/` and emit inbound events.
4. Channel adapters normalize event payloads to `RemoteInboundMessage`.
5. `remoteChatService` deduplicates by `channelId + chatId + messageId`.

### 3) Commands + Task Execution
1. Slash commands are parsed: `/help`, `/new`, `/status`, `/stop`, `/approve`, `/reject`.
2. Unknown slash commands are forwarded to the command registry (desktop command system).
3. For normal messages, a task is created (or reused per chat), and the execution starts.
4. `TaskSettings.autoApprovePlan` is set to true for remote sessions.

### 4) Media + Attachments
1. `remoteMediaService` loads local attachment files from app data.
2. Images are converted to base64 for LLM ingestion.
3. Audio/voice is transcribed via `aiTranscriptionService` (20MB limit) and added as text notes.

### 5) Streaming Output + Finalization
1. While execution is running, streaming content updates are throttled (1s).
2. Updates edit a single message if supported; per-channel edit size limits apply.
3. On completion, the final output is split into chunks and sent as additional messages.
4. If Feishu edit fails, it falls back to sending a new message.

### 6) Approvals
1. Pending edit review triggers a remote approval prompt.
2. `/approve` and `/reject` map to `EditReviewStore` actions.

## File Map and Responsibilities

### Backend (Rust / Tauri)
- `src-tauri/src/telegram_gateway.rs`
  - Polls Telegram Bot API (`getUpdates`).
  - Filters group chats and allowlist.
  - Downloads attachments (photo, voice, audio, document) to app data `attachments/`.
  - Emits `telegram-inbound-message` events.
  - Persists config to `telegram-remote.json` and state (last update id) to `telegram-remote-state.json`.
  - Commands: `telegram_get_config`, `telegram_set_config`, `telegram_start`, `telegram_stop`, `telegram_get_status`, `telegram_is_running`, `telegram_send_message`, `telegram_edit_message`.

- `src-tauri/src/feishu_gateway.rs`
  - Connects via Feishu Open Platform WebSocket (open_lark).
  - Filters sender type (user) and chat type (p2p) and allowlist by open_id.
  - Downloads image/file/audio attachments to app data `attachments/`.
  - Emits `feishu-inbound-message` events.
  - Keeps in-memory config (no file persistence).
  - Commands: `feishu_get_config`, `feishu_set_config`, `feishu_start`, `feishu_stop`, `feishu_get_status`, `feishu_is_running`, `feishu_send_message`, `feishu_edit_message`.

- `src-tauri/src/lib.rs`
  - Registers gateway states and exposes all gateway commands in the Tauri invoke handler.

### Frontend Core Services
- `src/services/remote/remote-chat-service.ts`
  - Main orchestration: inbound handling, session lifecycle, task creation, command routing.
  - Streams output via edit, then chunked send on completion.
  - Requests gateway status for `/status`.
  - Uses locale strings for remote UI messages.

- `src/services/remote/remote-channel-manager.ts`
  - Registers adapters, starts/stops all channels, and dispatches inbound events.

- `src/services/remote/remote-channel-types.ts`
  - Defines the `RemoteChannelAdapter` interface.

- `src/services/remote/remote-media-service.ts`
  - Loads attachment files, converts images to base64, transcribes audio.

- `src/services/remote/remote-text-utils.ts`
  - Dedup logic (TTL-based), message splitting, command normalization (handles `/cmd@bot`).
  - Per-channel message limits: Telegram 4096, Feishu 4000.

- `src/services/remote/remote-control-lifecycle-service.ts`
  - Starts/stops remote service based on settings.
  - Applies keep-awake when any channel is enabled and `remote_control_keep_awake` is true.

### Frontend Channel Adapters
- `src/services/remote/channels/telegram-channel-adapter.ts`
  - Maps Telegram event payloads to `RemoteInboundMessage`.
  - Calls Tauri commands for start/stop/send/edit.
  - Parses allowed chat ids and poll timeout from settings.

- `src/services/remote/channels/feishu-channel-adapter.ts`
  - Maps Feishu event payloads to `RemoteInboundMessage`.
  - Calls Tauri commands for start/stop/send/edit.
  - Parses allowed open_ids and credentials from settings.

### UI and Settings
- `src/components/remote/telegram-remote-runner.tsx`
  - Registers adapters and boots lifecycle service on app mount.

- `src/app.tsx`
  - Renders `RemoteServiceRunner` so remote services start with the app.

- `src/components/settings/remote-control-settings.tsx`
  - UI for Telegram and Feishu config (token/appId/appSecret/etc).
  - Validates required fields and poll timeout.

- `src/stores/settings-store.ts`
  - Stores remote settings keys, including `telegram_remote_*`, `feishu_remote_*`, and `remote_control_keep_awake`.

- `src/types/remote-control.ts`
  - Shared types for channels, inbound/outbound requests, attachments, and status payloads.

- `src/locales/en.ts`, `src/locales/zh.ts`, `src/locales/types.ts`
  - Localized text for remote control messages and settings UI.

### Tests (Selected)
- `src/services/remote/remote-chat-service.test.ts`
  - Streaming, send/edit behaviors, and session flow.
- `src/services/remote/remote-text-utils.test.ts`
  - Dedup, command normalization, message splitting.
- `src/services/remote/remote-control-lifecycle-service.test.ts`
  - Keep-awake and start/stop behavior.
- `src-tauri/src/telegram_gateway.rs` (tests)
  - State persistence for last update id.
- `src-tauri/src/feishu_gateway.rs` (tests)
  - Allowlist and sender/chat filtering.

### Legacy Telegram-Only Path (Still in Repo)
- `src/services/remote/telegram-remote-service.ts`
- `src/services/remote/telegram-remote-utils.ts`
- `src/services/remote/telegram-remote-service.test.ts`
- `src/services/remote/telegram-remote-utils.test.ts`

This older Telegram-only service predates the multi-channel `remote-chat-service` and is not wired by `RemoteServiceRunner`. It duplicates command parsing, streaming, and dedup logic. Keep in mind when refactoring.

## Storage and State

- **Settings DB (SQLite)**
  - Telegram: `telegram_remote_enabled`, `telegram_remote_token`, `telegram_remote_allowed_chats`, `telegram_remote_poll_timeout`
  - Feishu: `feishu_remote_enabled`, `feishu_remote_app_id`, `feishu_remote_app_secret`, `feishu_remote_encrypt_key`, `feishu_remote_verification_token`, `feishu_remote_allowed_open_ids`
  - Common: `remote_control_keep_awake`

- **App data directory (filesystem)**
  - `telegram-remote.json` (Telegram config snapshot)
  - `telegram-remote-state.json` (last update id)
  - `attachments/` (downloaded media from both channels)

## Reliability and Limits

- Telegram polling uses exponential backoff, honors `retry_after` when provided.
- Feishu WebSocket reconnects with exponential backoff on failure.
- Attachment downloads are limited to 20MB.
- Streaming updates are throttled and constrained by per-channel edit limits.

## Security Model

- Telegram: allowlist of chat ids; group chats blocked.
- Feishu: allowlist by open_id; only P2P user messages accepted.
- Credentials are stored in settings DB and not logged.

## Recommended Architecture Improvements

### 1) Consolidate Legacy Telegram Service
- Remove or archive `telegram-remote-service.ts` and `telegram-remote-utils.ts` to avoid duplicated logic.
- Keep all channel logic in `remote-chat-service` + adapters.

### 2) Make Channel Capabilities Explicit
- Add a `capabilities` field on `RemoteChannelAdapter` (supportsEdit, maxMessageLen, maxEditLen).
- Replace hardcoded `TELEGRAM_STREAM_EDIT_LIMIT` / `FEISHU_STREAM_EDIT_LIMIT` with adapter-provided values.

### 3) Unify Config Persistence Strategy
- Telegram persists config/state in app data; Feishu is in-memory only.
- Introduce a shared backend config repository (JSON file or database) so both channels behave consistently.

### 4) Separate Orchestration Layers
Split `remote-chat-service` into smaller layers:
- `RemoteSessionStore` (per-channel session state)
- `RemoteCommandRouter` (slash commands and command registry)
- `RemoteStreamDispatcher` (edit/send decisions, throttling, chunking)
- `RemoteInboundProcessor` (dedup + media preparation)

### 5) Normalize Event Names in Backend
- Emit a single `remote-inbound-message` event from Rust with `channelId`, instead of channel-specific names.
- This reduces adapter boilerplate and makes the frontend registry more pluggable.

### 6) Extract Attachment Handling
- Move filename sanitation and size checks into a shared Rust helper used by both gateways.
- Add a channel tag to filenames to avoid collisions and simplify cleanup.

### 7) Improve Extensibility for New Channels
- Create a `remote/channels/*` template and a checklist for adding new channels.
- Add a feature flag mechanism to toggle channels at runtime.

---

Last updated: 2026-02-07
