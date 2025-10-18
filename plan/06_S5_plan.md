## S5 — Rendering (text fidelity): Detailed Action Plan

### Objectives
- Realistic message rendering with Markdown, code fences, copy, and optional KaTeX/Mermaid.

### Deliverables
- Markdown renderer with syntax-highlighting and copy button for code blocks.
- Autolink URLs, inline code styles.
- Optional: LaTeX rendering via KaTeX/MathJax; Mermaid diagrams.

### Step-by-step
1) Markdown renderer
   - Choose lightweight MD renderer compatible with Next; enable code fence support.
   - Integrate syntax highlighting (shiki/prism) and theme-aware styles.

2) Code block actions
   - Add a copy-to-clipboard button per code block; toast on success.

3) Links and inline code
   - Auto-link URLs, style inline code with shadcn tokens.

4) Optional features
   - KaTeX/MathJax for LaTeX blocks and inline math.
   - Mermaid render pipeline; ensure SSR-safe and avoid layout shift.

5) Performance
   - Lazy-load heavy renderers (Mermaid/KaTeX) client-side only.

### Verification (Exit criteria)
- Paste a message with a code block → syntax highlighting appears; Copy copies exact code.
- Send a Mermaid block → diagram renders without layout shift.
- Send LaTeX `E=mc^2` → renders correctly.

### Risks & Mitigations
- SSR/CSR mismatch: guard with dynamic imports and `use client` components.
- Mermaid CSS/layout shift: pre-size container and render after mount.

### Timebox
- 0.5–1 day.


