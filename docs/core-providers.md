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
└── skills/             # Agent skills loaded on-demand via tools
    └── <skill-name>/
        └── SKILL.md
```

## Providers

Providers define the AI backends available to the app (e.g., OpenAI, Anthropic proxies). Provider configurations are bound directly to your profile.

- **Self-Contained:** Profiles must ship complete with all necessary authentication credentials. There is no in-app UI for users to override or manage keys.
- **Explicit Endpoints:** Endpoint URLs must always be explicitly defined to support proxies seamlessly.

### Configuration

Provider definitions are stored in `providers.json` at the root of your profile directory. The configuration is an object keyed by a unique identifier of your choice.

**`providers.json` Schema:**

```json
{
  "[provider-id]": {
    "type": "anthropic | openai-compatible",
    "name": "string",
    "baseUrl": "string",
    "apiKey": "string",
    "models": [
      { "keep": ["string"] },
      { "drop": ["string"] }
    ]
  }
}
```

| Property | Description |
|----------|-------------|
| `type` | The SDK/protocol to use (`anthropic`, `openai-compatible`). |
| `name` | The human-readable display name for the UI. |
| `baseUrl` | The explicit endpoint URL. |
| `apiKey` | The authentication credential. |
| `models` | Optional array of keep/drop filters to restrict available models. |

*Note: The presence of a provider definition implicitly enables it.*

## Model Filtering

Model filtering allows you to restrict the models shown in the application. This is particularly important for proxy providers (like OpenRouter or LiteLLM) that may return hundreds of models when you only want to expose a specific subset.

Filtering is configured inline within the provider definition using the `models` key.

### Pipeline Configuration

The `models` key accepts an ordered array of pipeline steps. Each step is an object with a single verb key (`keep` or `drop`) whose value is an array of glob patterns.

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
      { "drop": ["*-preview", "*-beta"] }
    ]
  }
}
```

- **Execution Order:** Filters are executed as a pipeline from top to bottom. Each step receives the model list produced by the previous step.
- **`keep`:** Retain only models matching any pattern. Discard the rest.
- **`drop`:** Remove models matching any pattern. Keep the rest.
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

The application relies on specific models to handle "invisible" background tasks. If a profile does not assign a model to a task, that feature will silently degrade or disable itself in the UI. 

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

1. **Discovery & Merging:** At conversation time, the application scans for all available skills. It merges skills from the built-in `@app` profile and your active profile. Active profile skills take precedence by name, allowing you to override default skills.
2. **System Prompt Injection:** The names and descriptions of all discovered skills are automatically injected into the system prompt as an XML catalog.
3. **On-Demand Loading:** The LLM is provided with a `load_skill` tool. When the model determines a task matches a skill's description, it calls this tool to pull the full `SKILL.md` instructions into its context window.
4. **Companion Files:** The `load_skill` tool returns the skill's instructions along with its directory URL (`arcfs://...`). The LLM can subsequently use the `read` tool to load any companion files from the `references/`, `scripts/`, or `assets/` subdirectories.

This progressive-disclosure approach keeps the initial system prompt lean while giving the model access to deep domain knowledge, specialized workflows, and supplementary files when needed.

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

The `.arc` format is a zip archive structured identically to the local profile directory. The presence of `arc.json` acts as a marker/manifest to indicate it's a valid, importable profile.

```text
<profile-name>.arc (zip):
└── <profile-name>/
    ├── arc.json           # Marker/manifest file
    ├── providers.json     # Providers configuration (credentials included)
    ├── settings.json      # Default favorite models and settings
    ├── prompts/           # Reusable system prompts
    └── skills/            # Agent skills loaded on-demand
```