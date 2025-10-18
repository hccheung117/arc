## S7b — Headless Core (in-memory first): Detailed Action Plan

### Objectives
- Create `packages/core` with domain types and services; in-memory repositories behind interfaces.

### Deliverables
- `packages/core`: pure TypeScript ESM with no DOM/Node dependencies.
- Domain models: Chat, Message, ProviderConfig, etc.
- Services: ChatService (send/stop/regenerate), ChatRepository (in-memory), MessageRepository (in-memory).
- Unit tests via Vitest for services behavior.
- `LiveChatAPI` uses Core to reproduce S4–S6 behaviors 1:1.

### Step-by-step
1) Core scaffolding
   - Set up `packages/core` with strict TS config and exports.

2) Domain and interfaces
   - Define models and repository interfaces; streaming contract as iterable callbacks.

3) In-memory repos
   - Implement repositories with deterministic IDs and basic query helpers.

4) Services
   - Implement ChatService orchestration methods mapping to API surface.

5) Unit tests
   - Cover send/stop/regenerate logic and repository behaviors.

6) Wire to LiveChatAPI
   - Replace stub with Core-backed implementation matching mock semantics.

### Verification (Exit criteria)
- Live mode backed by Core reproduces S4–S6 behaviors 1:1; unit tests pass.

### Risks & Mitigations
- Coupling to UI: Keep DTOs UI-agnostic; provide thin adapters in `apps/web`.

### Timebox
- 1–2 days.


