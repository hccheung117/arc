## S7c — Real provider (OpenAI first): Detailed Action Plan

### Objectives
- Implement `PlatformHTTP` abstraction with AbortController and streaming; build OpenAI adapter for health check and completions.

### Deliverables
- `PlatformHTTP` interface in platform packages with fetch-like API supporting streaming (SSE/NDJSON) and abort.
- OpenAI adapter: model list, health check, chat completions streaming.
- Error mapping (401/429/timeout) → UI-friendly banners.
- Stop/Regenerate wired to abort/restart streams.

### Step-by-step
1) Transport layer
   - Define `PlatformHTTP` with request, stream, and abort semantics; implement web version.

2) OpenAI adapter
   - Implement `/models` list, a health check ping, and `/chat/completions` streaming via fetch with reader.
   - Parse JSON lines; surface tokens to `LiveChatAPI` callback.

3) Error handling
   - Map HTTP codes and network errors to structured errors with user-facing messages.

4) UI integration
   - `LiveChatAPI.send` uses adapter; `stop` aborts controller; `regenerate` restarts with last prompt.

### Verification (Exit criteria)
- Valid key streams real tokens; Stop/Regenerate work; bogus key shows “Invalid API key”.

### Risks & Mitigations
- CORS: Use platform layer to avoid browser CORS where possible; allow custom base URL.
- Streaming fragmentation: Robust parser with backpressure handling.

### Timebox
- 1–2 days.


