# JSX Prompt Builder

This guide explains how the application uses JSX components to build XML-style text strings for system prompts and message augmentation, separating prompt engineering from application logic.

## How It Works

Prompt assembly uses real JSX (`.jsx` files) with a custom string-rendering factory, removing the need for a React dependency. This approach allows prompt text to be written naturally while maintaining full IDE support and syntax highlighting.

**Separation of concerns:**
```text
JSX components → string factory → XML text strings
                                        ↓
                          augmentation logic
```

JSX components own "what the text says," while backend services own "where it goes in the message array."

## The JSX Factory

The custom JSX factory is located at `src/main/jsx.js`. It is a lightweight renderer that outputs strings instead of DOM nodes.

Key behaviors:
- **Function tags** (PascalCase components): The factory calls the function and returns its result.
- **String tags** (intrinsic elements like `<session_workspace>`): The factory wraps the content in standard XML tags.
- **Fragments** (`<>`): Joins child sections with double newlines (`\n\n`), mirroring common prompt spacing patterns.
- **Raw Text**: Text passes through raw without HTML entity escaping, ensuring prompt instructions and code examples remain intact. Attribute values and text content are not escaped.

This factory is configured in `vite.main.config.mjs` via esbuild options:

```js
esbuild: {
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
}
```

## Prompt Components

Prompt components are organized by domain in `src/main/prompts/`. They export functions that return formatted strings for consumption by backend services.

### System Prompts (`system.jsx`)
Constructs the main system prompt injected into the LLM context.
- Uses internal components like `<AvailableSkills>`, `<SessionWorkspace>`, and `<SessionTmp>`.
- **Export:** `buildSystemPrompt(system, skills)`

### Augmentation Text (`augment.jsx`)
Constructs dynamic context injected into user messages (see [Message Augmentation](./core-augmentation.md)).
- **Exports:** 
  - `renderWorkspaceFiles(paths)` → Renders `<global_workspace_files>`
  - `renderActiveSkill(name, body, env)` → Renders `<active_skill>`

### Assist Text (`assist.jsx`)
Constructs prompts for background system tasks.
- **Exports:** 
  - `renderPromptTag(text)` → Renders `<prompt>`
  - `renderTitleTag(text)` → Renders `<first_user_message>`

## Service Integration

Application services import the prompt components and use their string outputs directly in message arrays or LLM payloads.

**Example: Session Initialization (`src/main/services/session.js`)**

```js
import { buildSystemPrompt } from '../prompts/system.jsx'

// Generates the complete system prompt string including workspace and skill context
const fullSystem = buildSystemPrompt(system, skills)
```

**Example: Message Augmentation (`src/main/services/skill.js`)**

```js
import { renderActiveSkill } from '../prompts/augment.jsx'

export const buildSkillAugment = (activeSkill, body, env) => ({
  type: 'text',
  text: renderActiveSkill(activeSkill, body, env),
  arcSynthetic: `skill:${activeSkill}`,
})
```

By keeping prompt generation encapsulated in `.jsx` files, services remain focused entirely on routing, state management, and API communication.
