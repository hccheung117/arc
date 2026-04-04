# Providers & Models

This guide explains how to configure AI providers, filter their available models, and set default favorites when creating a profile.

## Profile Structure

A profile is a self-contained directory containing configuration files that define how the app connects to AI models, which models are prioritized, and what shared prompts are available.

A typical profile directory looks like this:

```text
profiles/<profile-name>/
├── arc.json            # Marker/manifest file for import/export
├── providers.json      # Defines AI backend endpoints and credentials
├── settings.json       # Defines default favorite models and other UI settings
├── prompts/            # Reusable system prompts (.md files) available to users
│   ├── coding.md
│   └── writing.md
├── agents/             # Subagent definitions loaded on-demand
│   └── <agent-name>.md
└── skills/             # Agent skills loaded on-demand
    └── <skill-name>/
        └── SKILL.md
```

## Providers

Providers define the AI backends available to the app (e.g., OpenAI compatible proxies). Provider configurations are bound directly to your profile.

- **Self-Contained:** Profiles must ship complete with all necessary authentication credentials. There is no in-app UI for users to override or manage keys.
- **Explicit Endpoints:** Endpoint URLs must always be explicitly defined to support proxies seamlessly.

### Configuration

Provider definitions are stored in `providers.json` at the root of your profile directory. The configuration is an object keyed by a unique identifier of your choice.

**`providers.json` Schema:**

```json
{
  "[provider-id]": {
    "type": "anthropic | google | openai-compatible",
    "name": "Your Display Name",
    "baseUrl": "https://proxy.or.official.endpoint/v1",
    "apiKey": "your-api-key-here",
    "models": [
      { "keep": ["claude-opus-*"] },
      { "drop": ["*3*", "*-beta"] },
      { "add": ["claude-opus-5-internal"] }
    ]
  }
}
```

| Property  | Type     | Description |
|-----------|----------|-------------|
| `type`    | string   | The SDK/protocol to use (`anthropic`, `openai-compatible`, `google`). |
| `name`    | string   | The human-readable display name for the UI. |
| `baseUrl` | string   | The explicit endpoint URL. |
| `apiKey`  | string   | The authentication credential. |
| `models`  | array    | Optional pipeline of `keep`/`drop`/`add` steps to control available models. |


*Note: The presence of a provider definition implicitly enables it.*

## Model Filtering

Model filtering allows you to restrict the models shown in the application. This is particularly important for proxy providers (like OpenRouter) that may return hundreds of models when you only want to expose a specific subset.

Filtering is configured inline within the provider definition using the `models` key.

### Pipeline Configuration

The `models` key accepts an ordered array of pipeline steps. Each step is an object with a single verb key (`keep`, `drop`, or `add`).

**Example:**

```json
{
  "openrouter": {
    "type": "openai-compatible",
    "name": "OpenRouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "sk-or-...",
    "models": [
      { "keep": ["claude-*", "gpt-4o*"] },
      { "drop": ["*-preview", "*-beta"] },
      { "add": ["o3-pro"] }
    ]
  }
}
```

- **Execution Order:** Filters are executed as a pipeline from top to bottom. Each step receives the model list produced by the previous step.
- **`keep`:** Retain only models matching any pattern. Discard the rest.
- **`drop`:** Remove models matching any pattern. Keep the rest.
- **`add`:** Append model entries by ID. Each string produces a model with `id` and `name` set to that string. If an ID already exists in the current list, it is skipped. Use this to inject models the provider's API does not list.
- **Pattern Matching:** Patterns use standard glob syntax (`*` matches any sequence of characters) and match strictly against the model's ID as returned by the API.
- If you omit the `models` key entirely, no filtering is applied and all fetched models are shown.

## Profile Settings

Profiles use `settings.json` at the root of the directory to define default UI states and assign specific models to handle system-level background tasks.

### Schema

**`settings.json` Schema:**

```json
{
  "favorites": [
    {
      "provider": "string",
      "model": "string"
    }
  ],
  "assignments": {
    "[task-id]": {
      "provider": "string",
      "model": "string"
    }
  }
}
```

### 1. Favorite Models

You can define a default set of favorite models for your profile. These will appear starred and easily accessible in the model selector.

**Example:**

```json
{
  "favorites": [
    { "provider": "claude", "model": "claude-sonnet-4-6" },
    { "provider": "openrouter", "model": "gpt-4o" }
  ]
}
```

*Note: To favorite the same model ID from multiple different providers, simply add separate entries for each. Users have the ability to override your defaults or add their own favorites in their personal settings.*

### 2. System Task Assignments

The application relies on specific models to handle "invisible" background tasks. If a profile does not assign a model to a task, that feature will silently disable itself in the UI. 

Current system tasks include:

- `generate-title`: Generates short conversational titles based on the user's first message. Usually a fast, cheap model.
- `refine-prompt`: Powers the "Improve Prompt" feature in the editor. Requires a highly capable reasoning model.
- `transcribe-audio`: Handles voice input transcription. Requires a dedicated audio transcription model (e.g. OpenAI's Whisper).

**Example:**

```json
{
  "assignments": {
    "generate-title": { "provider": "openai", "model": "gpt-4o-mini" },
    "refine-prompt": { "provider": "claude", "model": "claude-sonnet-4-6" },
    "transcribe-audio": { "provider": "openai", "model": "whisper-1" }
  }
}
```

## Skills

The application supports progressive-disclosure skill loading following the [Agent Skills spec](https://agentskills.io/specification). Skills are specialized capabilities that the LLM can invoke dynamically during a conversation.

### Defining Skills

Skills are directory structures that live in the `skills/<skill-name>/` directory within your profile. Each skill must contain a `SKILL.md` file with YAML frontmatter that defines its metadata:

```markdown
---
name: my-skill
description: Useful for performing specialized tasks when requested.
---

# Skill Instructions
Here are the detailed instructions for this skill...
```

**Frontmatter Constraints:**
- `name` (Required): Max 64 chars. Lowercase letters, numbers, hyphens. No leading/trailing hyphens.
- `description` (Required): Max 1024 chars. Non-empty.
- `license`, `compatibility`, `metadata` (Optional).

**Skill Directory Structure:**
```text
skills/
└── <skill-name>/
    ├── SKILL.md       # Required: The main instructions
    ├── references/    # Optional: Companion files
    ├── scripts/       # Optional: Companion scripts
    └── assets/        # Optional: Companion assets
```

### How Skills Work

Skills provide the AI with specialized capabilities and domain knowledge exactly when needed. This means you can extend the AI's abilities without writing massive system prompts.

1. **Automatic Discovery:** The application automatically finds all skills in your profile and makes the AI aware of what they do.
2. **Smart Activation:** Based on the skill's description, the AI autonomously decides when to load and follow a skill's full instructions.
3. **Override Priority:** You can override built-in or default skills by providing a skill with the exact same name in your profile.
4. **Rich Capabilities:** Skills aren't just text—they can include companion files, scripts, and assets that the AI can read and execute to perform complex, multi-step workflows.

This progressive-disclosure approach ensures the AI remains fast and general-purpose, while giving it access to deep domain knowledge and specialized workflows when the task demands it.

### Built-in Skills

Arc ships with built-in skills that provide core capabilities out of the box. These skills are bundled with the application and cannot be deleted, serving as the lowest priority fallback.

**Merge Priority:**
When discovering skills, the application merges them in the following order (highest to lowest priority):
1. **`@app`** — Personal user overrides
2. **Active profile** — Shared configuration
3. **Built-in** — Shipped application defaults

You can override a built-in skill simply by creating a skill with the exact same name in your profile or personal `@app` directory.

**Constraints:**
- Built-in skills are **read-only**. The LLM can read and execute files from them, but cannot modify their contents.

### Executing Scripts

Skills can include executable scripts to perform complex tasks, process data, or interact with the local system. When a skill requires it, the AI can securely execute these scripts from the skill's directory.

**Supported Runtimes:**
- **Node.js**: The app includes a built-in Node.js environment, meaning JavaScript scripts will run universally on any machine without requiring the user to install Node.
- **Native Scripts**: Shell scripts or executable binaries can be run natively depending on the host OS (e.g., Bash on macOS/Linux, PowerShell on Windows).
- **Custom Binaries**: Scripts can also specify third-party runtimes (like `python3`), provided they are installed on the user's system.

**Security & Context:**
Execution is sandboxed to ensure safety. Scripts can only be executed from trusted skill directories, and they automatically receive environment variables pointing to the user's current workspace and the skill's directory, allowing them to safely process files.

## Subagents

The application supports delegating tasks to specialized subagents. Subagents run independently with their own context window, stream progress back to the UI, and return a focused summary to the parent agent.

### Defining Subagents

Each subagent type is defined as a markdown file with YAML frontmatter. These files live in the `agents/` directory within your profile or personal `@app` directory.

**Example file** (`profiles/<profile-name>/agents/explorer.md`):

```markdown
---
name: explorer
description: Fast codebase exploration — finds files, searches code, reads content.
model: claude-sonnet-4-20250514
---

You are a codebase exploration agent. Your job is to find and summarize relevant code.

Search thoroughly, read files as needed, and return a focused summary of your findings.
Always include file paths and line numbers so the main agent can reference them.
```

**Frontmatter Constraints:**
- `name` (Required): Identifier used by the `subagent` tool and `@mentions`.
- `description` (Required): Shown to the parent agent in the system prompt.
- `model` (Optional): Default literal model ID. The parent can override at dispatch. Falls back to the session's active model if unset.

The markdown body (after frontmatter) is the agent's system prompt.

### How Subagents Work

1. **Automatic Discovery:** The application automatically finds all agent definition files in your profile (`.md` files in `agents/`) and makes the main AI aware of what they do.
2. **Override Priority:** You can override built-in or default agents by providing an agent with the exact same name in your personal `@app` directory or active profile (Order: `@app` > active profile > builtin).
3. **Task Delegation:** The parent LLM decides when to dispatch a subagent via the `subagent` tool, providing a prompt, optional skills access, and optional model override.
4. **Isolated Context:** The subagent runs in a fresh context window. The parent model only sees the final summary text, while the user sees the full execution streamed live in the UI.

### Forcing Subagent Use

Users can force or strongly hint the use of a specific subagent by typing `@agentName` in the composer. This `@mention` renders as a hint injected into the user message, nudging the parent agent to delegate the task to the requested subagent.

## Import & Export

Profiles can be exported and imported as `.arc` files. This allows you to easily backup or share your configured AI backends, default favorites, and reusable prompts. 

### Exporting

You can export the active profile directly from the application via **File > Export Profile**. This action packs the active profile directory into an `.arc` file (a standard zip archive). The exported file includes all your configuration files and credentials.

### Importing

You can import an existing profile via **File > Import Profile** and selecting a `.arc` file. The application will:
1. Validate that it's a valid `.arc` archive (containing exactly one top-level folder with an `arc.json` marker file).
2. Extract the contents into your local `profiles/` directory, overwriting any existing profile with the same name.
3. Immediately activate the profile and reload all providers, settings, and prompts.

**`.arc` File Format:**

The `.arc` format is a zip archive structured identically to the local Profile Structure detailed at the beginning of this guide. The presence of `arc.json` acts as a marker/manifest to indicate it's a valid, importable profile.

```text
<profile-name>.arc (zip):
└── <profile-name>/
    └── ... (see Profile Structure above)
```