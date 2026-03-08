# Providers & Models

This guide explains how to configure AI providers, filter their available models, and set default favorites when creating a profile.

## Profile Structure

A profile is a self-contained directory containing configuration files that define how the app connects to AI models, which models are prioritized, and what shared prompts are available.

A typical profile directory looks like this:

```text
profiles/<profile-name>/
├── providers.json      # Defines AI backend endpoints and credentials
├── settings.json       # Defines default favorite models and other UI settings
└── prompts/            # Reusable system prompts (.md files) available to users
    ├── coding.md
    └── writing.md
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