Arc is a JavaScript Electron app.

Rules:
- Always use minimal code to achieve the desired result.
- Prefer offloading work to dependencies over writing custom code (e.g. `generateId` from `ai` instead of `nanoid`).

Decision Making Tips:
- Never prefer to write custom code because of dependency size - size never matters. Always ask yourself if the dependency really causes more effort than writing custom code - if not, always prefer the dependency.

Major Libraries and Source Code for Reference:
- REPO_ROOT/../playground/ai-elements
- REPO_ROOT/../playground/ai-sdk
- REPO_ROOT/../playground/electron
- REPO_ROOT/../playground/tiptap
- REPO_ROOT/../playground/streamdown
Always use the source code instead of dist in node_modules.