## S7a — Interface seam (Mock ⇄ Live): Detailed Action Plan

### Objectives
- Define a single `IChatAPI` interface used by the UI; keep `MockChatAPI` behavior and enable swapping to a `LiveChatAPI` stub without changing components.

### Deliverables
- `IChatAPI` interface covering: `send`, `stop`, `regenerate`, `listChats`, `createChat`, `deleteMessage`, `search`.
- `MockChatAPI` implementing current S4–S6 behaviors.
- `LiveChatAPI` stub that returns shape-compatible results and rejects unimplemented methods gracefully.
- Dev panel switch (e.g., in settings) to toggle Mock/Live at runtime.

### Step-by-step
1) Interface definition
   - Define domain DTOs independently from UI components; include streaming contract (async iterator or callback-based token handler).

2) Mock adapter
   - Wrap existing store-driven logic behind `MockChatAPI` while preserving identical UI semantics.

3) Live adapter (stub)
   - Implement method signatures; for now, return dummy data or `notImplemented` errors with friendly messages.

4) Provider wiring
   - Central provider (React context) that supplies the active `IChatAPI` to components.
   - Settings/dev panel toggle flips between mock and live instances.

### Verification (Exit criteria)
- Toggling Mock/Live does not change UI flows; Live can be unimplemented but must not crash the UI.

### Risks & Mitigations
- Leaky UI assumptions: Enforce API result shapes and provide adapters if shapes evolve.

### Timebox
- 0.5 day.


