## S6 — Images (UI/UX only, no real FS): Detailed Action Plan

### Objectives
- Validate image attachment UX with drag/drop, paste, preview chips, and lightbox.

### Deliverables
- Composer supports drag/drop and paste of images; preview chip appears.
- On send, show image bubble using ObjectURL; lightbox with zoom; gallery layout for multiple images.
- Size/type validation with friendly inline errors.

### Step-by-step
1) Composer attachments
   - Handle drag/drop and paste events; accept PNG/JPEG/WebP; reject others with error.
   - Show removable preview chips with filename and size.

2) Sending images
   - On send, generate ObjectURLs and attach to message payload for rendering.
   - Revoke ObjectURLs on message deletion or unmount to avoid leaks.

3) Timeline rendering
   - Image bubble component with responsive sizes; click opens lightbox modal.
   - Multi-image grid layout with consistent spacing.

4) Validation
   - Enforce max size (e.g., 10–20MB); display clear inline error banners.

### Verification (Exit criteria)
- Drag a PNG → preview appears; Send → thumbnail in timeline; click → lightbox opens; Esc closes.
- Paste a JPEG from clipboard → same behavior.
- Try a 20MB file → inline error banner with reason (“too large”).

### Risks & Mitigations
- Memory leaks from ObjectURLs: track and revoke when not needed.
- Clipboard compatibility: feature-detect clipboard API; provide fallback messaging.

### Timebox
- 0.5–1 day.


