# Core: Model Filtering

## Architecture

Model filtering allows users to restrict the models shown in the application, which is particularly important for proxy providers (OpenRouter, LiteLLM, etc.) that may return hundreds of models when only a few are desired.

The filtering is configured inline within the provider definition in `providers.json`, making it part of the provider setup rather than a detached user preference.

## Configuration Data Shape

The `models` key on a provider definition accepts an ordered array of pipeline steps. Each step is an object with a single verb key (`keep` or `drop`) whose value is an array of glob patterns.

```json
{
  "openrouter": {
    "type": "openai",
    "name": "OpenRouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "sk-or-...",
    "models": [
      { "keep": ["anthropic/claude-*", "openai/gpt-4o*"] },
      { "drop": ["*-preview", "*-beta"] }
    ]
  }
}
```

### Pipeline Semantics

Filters are executed as a pipeline, top to bottom. Each step receives the model list produced by the previous step (or the full fetched list for the first step).

| Verb | Effect |
|------|--------|
| `keep` | Retain only models whose `id` matches any pattern. Discard the rest. |
| `drop` | Remove models whose `id` matches any pattern. Keep the rest. |

- **Explicit Execution Order:** A pipeline array explicitly defines the execution order, avoiding ambiguity between whitelist and blacklist prioritization.
- **Pattern Matching:** Patterns use standard glob syntax (`*` matches any sequence of characters) and match strictly against the `model.id` as returned by the provider API.
- **No Configuration:** Omitting the `models` key entirely means no filtering is applied, and all fetched models are passed through.
