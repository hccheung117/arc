## S4 — Simple fake data to verify the user journey: Detailed Action Plan

### Objectives
- Implement an in-memory store to drive the full happy path with fake streaming.

### Deliverables
- Zustand (or similar) store: `chats[]`, `messages[]`, `activeChatId`.
- Composer “Send” appends user message; assistant responds via fake streaming using `setInterval`.
- Buttons: Stop, Regenerate, Delete message, New Chat, Rename Chat all wired to store.

### Step-by-step
1) Domain types
   - Define `Chat`, `Message`, `MessageRole`, `MessageStatus` types in web app.

2) Store setup
   - Implement store with selectors for active chat, messages, and actions: `createChat`, `renameChat`, `deleteMessage`, `send`, `stop`, `regenerate`.
   - Persist nothing yet; in-memory only.

3) Fake streaming
   - On `send`, push user message and create a pending assistant message.
   - Use `setInterval` to append tokens from a canned response; update status to `streaming` → `complete`.
   - Expose `stop` to clear interval and mark status `stopped`.

4) UI wiring
   - Hook composer to `send`.
   - Add Stop/Regenerate/Delete controls on the latest assistant/user messages as appropriate.
   - Implement New Chat and Rename Chat in sidebar/header.

5) Edge handling
   - Prevent multiple concurrent streams per chat; disable buttons while streaming where appropriate.
   - Ensure switching chats isolates message lists; no shared intervals.

### Verification (Exit criteria)
- Create chat → send “Hello” → characters stream in; click Stop → halts within 1s.
- Click Regenerate → last assistant message is replaced by a new streaming response.
- Create 2nd chat, switch back and forth: message lists are isolated; no console errors.

### Risks & Mitigations
- Interval leaks: Track interval IDs per chat and clear on unmount/chat switch.
- UI state races: Gate actions when `streaming` and ensure atomic updates in store.

### Timebox
- 0.5–1 day.


