# Keep Awake (keep_aware) - Feature Spec

## Overview
Keep Awake prevents the system from sleeping while tasks are running. It uses a reference-counted mechanism so multiple tasks can request sleep prevention concurrently, and sleep is only re-enabled when all requests have been released.

This spec documents the current design, core flow, platform mechanisms, and an implementation review with potential issues and optimizations.

## Goals
- Prevent system sleep while tasks are actively running.
- Support concurrent tasks with correct reference counting.
- Be platform aware (macOS, Windows, Linux).
- Avoid coupling to React component lifecycle.

## Architecture Summary
- Frontend (TypeScript):
  - `ExecutionStore` tracks running tasks.
  - `KeepAwakeManager` subscribes to `ExecutionStore` changes and applies a delta-based ref-count.
  - `KeepAwakeService` talks to Tauri (Rust) to acquire/release sleep prevention, and caches local state.
  - `useTaskKeepAwake` exposes state to React.
- Backend (Rust / Tauri):
  - `KeepAwakeState` maintains the authoritative ref-count.
  - Platform-specific mechanisms keep the OS awake.
  - Tauri commands (`keep_awake_acquire`, `keep_awake_release`, etc.) bridge frontend calls.

## Core Flow
1. App boot
   - `startKeepAwakeManager()` runs in `src/main.tsx` before React render.
2. Task starts
   - `ExecutionStore.startExecution()` changes running count.
   - `KeepAwakeManager` observes running count delta and calls `keepAwakeService.acquire()` per increment.
3. Backend acquire
   - Tauri command `keep_awake_acquire` increments backend ref-count.
   - On first acquire, platform-specific sleep prevention starts.
4. Task ends
   - `ExecutionStore.completeExecution()`/`stopExecution()` decreases running count.
   - `KeepAwakeManager` calls `keepAwakeService.release()` per decrement.
5. Backend release
   - Tauri command `keep_awake_release` decrements backend ref-count.
   - On last release, platform-specific sleep prevention stops.

## Platform Mechanisms
- macOS: `caffeinate -dimsu` spawned as a child process.
- Linux: `systemd-inhibit --what=sleep --mode=block sleep 2147483647` (if `systemd-inhibit` exists).
- Windows: `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED)`.

## State Model
- Authoritative ref-count: Rust `KeepAwakeState.ref_count`.
- Frontend cache:
  - `KeepAwakeService.refCount` (local cache).
  - `KeepAwakeManager.refCount` (mirrors backend after sync).
- Initialization:
  - `KeepAwakeManager` calls `getRefCount()` on start and reconciles delta to the current running count.

## Key Files
- Backend
  - `src-tauri/src/keep_awake.rs`
  - `src-tauri/src/lib.rs` (command registration)
- Frontend
  - `src/services/keep-awake-manager.ts`
  - `src/services/keep-awake-service.ts`
  - `src/hooks/use-task-keep-awake.ts`
  - `src/stores/execution-store.ts`

## Testing Coverage
- `src/services/keep-awake-manager.test.ts`
- `src/services/keep-awake-service.test.ts`
- `src/hooks/use-task-keep-awake.test.tsx`
- `src-tauri/src/keep_awake.rs` (Rust unit tests)

## Current Issues / Risks
1. Linux fallback mismatch
   - If `systemd-inhibit` is missing, Rust returns Ok and frontend ref-count still increments.
   - UI and logs may show sleep prevention enabled even though it is not active.
2. Inconsistent response validation
   - `keep-awake-service.ts` validates boolean for `keep_awake_acquire` but does not validate for `keep_awake_release` or `keep_awake_is_preventing`.
3. Duplicate ref-count sources
   - Frontend `KeepAwakeService` and backend both track counts; temporary divergence can happen if backend count changes outside the current process or if an invoke call fails mid-sequence.
4. No explicit user-facing notification on unsupported platform
   - Locale includes `platformNotSupported`, but it is not surfaced to users when unsupported.

## Optimization Ideas
- Make backend truth explicit
  - After each acquire/release, query `keep_awake_get_ref_count` to hard-sync and avoid drift.
- Surface unsupported platform state
  - Use `platformNotSupported` toast when `isSupported()` is false to clarify behavior.
- Linux capability detection
  - Return a distinct result from Rust if the keep-awake process was not actually started (e.g., missing `systemd-inhibit`).
- Add health checks
  - If the macOS/Linux child process exits early, restart or surface a warning.
- Reduce redundant operations
  - When deltas are large, consider batching or using a single backend command that sets target ref-count.

## Notes
- The keep-awake mechanism is tied to task execution counts, not UI lifecycle, which avoids React re-render issues.
- The current architecture supports concurrent tasks safely with reference counting.
