## S7f — Desktop fit-and-finish (Electron): Detailed Action Plan

### Objectives
- Provide Electron-specific integrations: file-backed SQLite, real file pick/save, and an updates stub.

### Deliverables
- `platform-electron`: SQLite via `better-sqlite3` with file-backed DB.
- File system APIs for open/save dialogs and attachment handling.
- “Check for updates” menu action opening a modal.

### Step-by-step
1) SQLite on desktop
   - Implement Electron platform DB driver using `better-sqlite3`; migrate data from web if present.

2) File integration
   - IPC handlers for pick/save dialogs; secure preload exposing minimal APIs.
   - Attachment storage and retrieval mapped to app data directory.

3) Updates stub
   - Menu item triggers modal with current version and a placeholder check.

4) Parity checks
   - Ensure quit/reopen retains data; attachments persist and open.

### Verification (Exit criteria)
- Quit/reopen retains data; attach a local image file; menu action opens an updates modal.

### Risks & Mitigations
- Security: Context isolation, no `nodeIntegration`; validate IPC inputs.
- Cross-platform paths: Use Electron `app.getPath` consistently.

### Timebox
- 2 days.


