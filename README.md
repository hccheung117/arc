# Arc

## Installation

To install dependencies, run:

```bash
npm install
```

## Development

To start the development server:

```bash
npm start
```

This will start the Electron application in development mode.

## Arc Profile

A profile bundles AI provider infrastructure — connections, credentials, and model discovery — into a single installable package. User preferences (assignments, favorites, shortcuts) live separately in settings files.

```
/
├── arc.json                          # Provider infrastructure (required)
├── settings.json                     # Default preferences (optional)
└── personas/                         # Bundled personas (optional)
    └── {name}/
        └── PERSONA.md
```

**Legend:** 🔴 Required, ⚪ Optional

### `arc.json` — Provider Infrastructure

#### 📦 Core Metadata
*   🔴 **`version`** — Schema version (Currently `0`).
*   🔴 **`id`** — Unique slug for the profile.
*   🔴 **`name`** — Human-readable display name.

#### 🔌 Providers
*   🔴 **`id`** — Unique identifier for this provider within the profile.
*   🔴 **`type`** — The provider driver (e.g., `openai`).
*   ⚪ **`apiKey`** — API authentication token.
*   ⚪ **`baseUrl`** — Custom API endpoint.
*   ⚪ **`modelFilter`** — Whitelist (`allow`) or blacklist (`deny`) models using glob patterns.
*   ⚪ **`modelAliases`** — Map of model ID to display name override.

```json
{
  "version": 0,
  "id": "awesome-arc-profile",
  "name": "Awesome Arc Profile",
  "providers": [
    {
      "id": "awesome-provider",
      "type": "openai",
      "apiKey": "sk-...",
      "modelFilter": {
        "mode": "allow",
        "rules": ["opus-4.6*", "gemini-3-pro*", "gpt-5.2*"]
      },
      "modelAliases": {
        "opus-4.6": "Opus 4.6",
        "gemini-3-pro": "Gemini 3 Pro",
        "gpt-5.2": "GPT-5.2"
      }
    }
  ]
}
```

### `settings.json` — Preferences

Profile authors can ship default preferences alongside provider infrastructure. All fields are optional.

*   ⚪ **`assignments`** — Links a role (e.g., `refine`) to a provider/model pair.
*   ⚪ **`favorites`** — Models merged into the user's favorites on install.
*   ⚪ **`shortcuts`** — Keyboard shortcut overrides (e.g., `send`).

```json
{
  "assignments": {
    "refine": { "provider": "awesome-provider", "model": "opus-4.6" }
  },
  "favorites": [
    { "provider": "awesome-provider", "model": "opus-4.6" },
    { "provider": "awesome-provider", "model": "gemini-3-pro" },
    { "provider": "awesome-provider", "model": "gpt-5.2" }
  ],
  "shortcuts": {
    "send": "enter"
  }
}
```

## Personas

Personas customize AI behavior with system prompts. Stored as markdown files.

### PERSONA.md Format

```markdown
---
name: Display Name        # Optional display name
description: Short desc   # Optional description
protected: true           # Optional, protects system prompt from revealing
---

System prompt content goes here...
```
