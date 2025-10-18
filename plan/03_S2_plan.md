## S2 — Clickable mockup (foundation: windows & layouts): Detailed Action Plan

### Objectives
- Lock the application shell and responsive behavior across breakpoints.

### Deliverables
- Sidebar (chat list), main (message panel), composer bar.
- Responsive breakpoints and focus styles; keyboard accessibility.
- Electron window basics: min size, resize, app menu (About/Quit), dark-mode titlebar.

### Step-by-step
1) Layout grid
   - Implement a responsive CSS grid/flex layout: sidebar + main area.
   - Sidebar collapses below 768px (toggle button appears).

2) Components (stubs)
   - Sidebar list item, message panel shell, composer input with send button (nonfunctional).
   - Header with title and settings icon.

3) Accessibility & focus
   - Visible focus ring styles; tab order logical; ensure ARIA roles where appropriate.

4) Electron window chrome
   - Set min size, resizable, dark titlebar if supported; app menu with About/Quit items.

5) Keyboard interactions
   - Wire `Cmd/Ctrl+K` to open a placeholder command palette (modal with focus trap).

### Verification (Exit criteria)
- Resize Electron/web from 320px → 1440px: no overlap/overflow; sidebar auto-collapses on <768px.
- `Ctrl/Cmd+K` opens a placeholder command palette; `Esc` closes; focus trap holds.
- App menu exists in Electron and is clickable (actions may be no-ops).

### Risks & Mitigations
- Layout shift: Reserve space with skeletons/placeholders; avoid dynamic height jumps.
- Electron menu cross-platform: Use simple template first; per-OS tweaks later.

### Timebox
- 0.5–1 day.


