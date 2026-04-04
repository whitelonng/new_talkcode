# Rust LLM Provider Testing (Record/Replay)

## Goal

Capture real provider requests/responses and replay them in tests with a mock provider server, ensuring provider-specific parameters and response formats stay supported.

## Concepts

- Record mode captures outbound request + SSE response into a fixture.
- Record mode also stores `test_input` and parsed `expected_events` so fixtures are test-ready.
- Replay happens in tests via a mock HTTP server; there is no runtime replay mode.
- Fixtures are stored in `src-tauri/src/llm/testing/recordings/`.

## Environment Variables

- `LLM_TEST_MODE=record|replay|off`
  - `record`: enable recording.
  - `replay`: currently behaves like `off` for recording; only affects base URL override.
  - `off`: default.
- `LLM_FIXTURE_DIR=/absolute/or/relative/path` (defaults to `src-tauri/src/llm/testing/recordings`)
- `LLM_TEST_BASE_URL=http://127.0.0.1:12345` (optional override for base URL when mode is not `off`)

## Record Real Provider Fixtures

1) Set provider API keys as usual.
2) Run the app or invoke the LLM stream endpoint that hits the provider.
3) Export env vars before launching:

```bash
export LLM_TEST_MODE=record
export LLM_FIXTURE_DIR=/Users/kks/mygit/talkcody/src-tauri/src/llm/testing/recordings
```

Optional: point to a specific base URL:

```bash
export LLM_TEST_BASE_URL=https://api.openai.com/v1
```

Run your normal flow. The stream handler will record:
- Request headers/body (redacted auth headers).
- SSE chunks from the provider response.
- `test_input` derived from the live request.
- `expected_events` derived from parsed stream events.

## Replay Fixtures in Tests

```bash
cd src-tauri
cargo test -p talkcody llm::testing
```

These tests load fixtures from `src-tauri/src/llm/testing/recordings/` and:
- Validate request body shape (provider-specific params).
- Validate stream parsing output order and content.
- Replay SSE responses via a mock HTTP server.

No environment variables are required for test replay.

## Fixture Format

Each fixture is JSON with:
- `version`
- `provider_id`
- `protocol`
- `model`
- `endpoint_path`
- `request`: method, url, headers, body
- `response`: stream (status, headers, sse_events) or JSON error response
- `test_input`: structured input used to build the request in tests
- `expected_events`: expected parsed stream events

## Adding a New Provider Fixture

1) Use real provider once with `LLM_TEST_MODE=record`.
2) Commit the generated fixture JSON.
3) Add or update a test case in `src-tauri/src/llm/testing/tests.rs` if needed.

## Fixture Naming

- Format: `provider_id__protocol__model__channel.json`
- `model` is normalized by replacing `/` and spaces with `_`.
- `channel` values:
  - `api` (default provider base URL)
  - `coding_plan` (coding plan base URL)
  - `international` (international base URL)
  - `custom` (LLM_TEST_BASE_URL override or other base URL)
  - `oauth` (OpenAI OAuth flow)

## Redaction Rules

Recorder redacts headers containing:
- `authorization`
- `x-api-key`
- `api-key`
- any header containing `token`

## Notes

- Fixtures are intentionally deterministic; remove volatile fields before commit if needed.
- For `openai-responses`, the `instructions` field uses a sentinel `__ANY__` in fixtures.
