## S1 — Minimal placeholder UI + Electron smoke: Detailed Action Plan

### Objectives
- Prove the stack boots: Next 15 + Tailwind 4 + shadcn/ui in web, and Electron loads the same UI.

### Deliverables
- `apps/web`: Next.js 15 app with Tailwind 4 configured, shadcn/ui installed.
- Minimal layout with sidebar/header/content and a visible shadcn `Button`.
- `apps/desktop`: Electron main that opens a window pointing to the web dev server in dev.
- Scripts to run both in dev.

### Step-by-step
1) Web app init
   - Create Next 15 app in `apps/web` (ESM, `app/` router).
   - Configure Tailwind 4 per Next guidance; import base styles in root layout.
   - Install shadcn/ui and generate a `Button` component to verify styling.

2) Placeholder layout
   - Implement a simple shell: sidebar (stub), header with app name, content area with Button.
   - Ensure global CSS and Tailwind classes load correctly.

3) Electron wrapper
   - Create `apps/desktop` with `main.ts` that launches a `BrowserWindow`.
   - In dev, load `http://localhost:3000`. In prod (later), load built files.
   - Add dev script that concurrently runs `web dev` and `desktop dev`.

4) Scripts
   - `pnpm --filter web dev` starts Next dev server.
   - `pnpm --filter desktop dev` starts Electron with the dev URL.

### Verification (Exit criteria)
- Web: `pnpm --filter web dev` → visit `localhost:3000` and see “Arc shell”.
- Electron: `pnpm --filter desktop dev` opens a window rendering the same page.
- Tailwind classes and shadcn Button render identically in web & Electron.

### Risks & Mitigations
- CSS mismatch: Confirm Tailwind and shadcn setup order; verify PostCSS config.
- Dev URL timing: Add retry/wait logic in Electron dev startup.
- Cross-platform Electron: Use recent Electron and avoid native modules yet.

### Timebox
- 0.5–1 day.


