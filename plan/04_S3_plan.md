## S3 — Clickable mockup (design & UX flows): Detailed Action Plan

### Objectives
- Validate core screen flows without data; ensure snappy interactions and no hydration issues.

### Deliverables
- First-run screen → “Connect provider” modal (nonfunctional yet).
- Settings drawer (theme, font size) with client-side validation only.
- Empty states and loading skeletons.

### Step-by-step
1) First-run state
   - Render a welcome/empty chat screen with CTA to connect a provider.
   - Clicking CTA opens a modal with fields for vendor, API key, base URL (no save yet).

2) Settings drawer
   - Implement panel with theme (Light/Dark/System) and font size controls; persist in memory.
   - Validate required fields client-side; show inline errors on blur/submit.

3) Navigation
   - Add routes for Home, Settings, New Chat; ensure transitions avoid layout shift.

4) Skeletons and busy states
   - Skeleton placeholders for chat list and message panel; small spinners where appropriate.

### Verification (Exit criteria)
- From fresh load: open Settings, toggle theme & font size, close → UI updates instantly, no hydration warnings.
- Open “Connect provider” modal → required fields show inline errors on blur/submit.
- Navigate among Home ↔ Settings ↔ New Chat without any visible layout jumps.

### Risks & Mitigations
- Hydration mismatches: Keep settings state purely client-side; guard SSR-only code.
- Accessibility: Ensure modals have focus traps and `aria-*` attributes.

### Timebox
- 0.5–1 day.


