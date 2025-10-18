## S7e — Search & performance polish: Detailed Action Plan

### Objectives
- Add per-chat and global search, plus performance improvements (virtualized list, reconnect/timeout handling).

### Deliverables
- Search API and UI: query per chat and across chats; highlight results.
- Virtualized message list for large conversations.
- Robust networking: reconnect/backoff, request timeouts with user feedback.

### Step-by-step
1) Search
   - Start with LIKE/partial match; later consider FTS.
   - Highlight matches in the message list; keyboard navigation between hits.

2) Virtualization
   - Integrate windowed list for messages; maintain scroll position on new tokens.

3) Resilience
   - Add retry/backoff for network glitches; visible partial-response indicators.
   - Timeouts and abort signals on long-running requests.

### Verification (Exit criteria)
- 1,000 seeded messages scroll smoothly; search highlights correct hits; network flake shows graceful UI.

### Risks & Mitigations
- Virtualization + streaming: Keep bottom anchoring and avoid scroll jumps.

### Timebox
- 1–2 days.


