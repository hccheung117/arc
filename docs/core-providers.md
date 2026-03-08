# Core: Provider Definitions

## Architecture

Providers define the AI backends available to the app (e.g., OpenAI, Anthropic proxies).
The configuration of these providers is bound to **Profiles**, rather than being globally defined or layered.

- **Profile-Provided:** Only user-installed or organization profiles supply provider definitions. The base `@app` profile does not provide or store any provider configurations.
- **Self-Contained:** Profiles ship complete with all necessary authentication credentials. There is no in-app UI for users to override or manage keys.
- **Explicit Endpoints:** To treat proxies as a first-class use case, endpoint URLs must always be explicitly defined, without relying on implicit SDK defaults.

## Configuration Data Shape

Provider definitions are stored in `providers.json` at the root of a profile directory. The configuration is an object keyed by a unique identifier chosen by the profile author.

### Schema Requirements

| Property | Description |
|----------|-------------|
| `type` | The SDK/protocol to use (`anthropic`, `openai-compatible`, `google`). |
| `name` | The human-readable display name for the UI. |
| `baseUrl` | The explicit endpoint URL. |
| `apiKey` | The authentication credential. |

*Note: The presence of a provider definition implicitly enables it. Multiple providers can share the same `type` (e.g., different Anthropic-compatible proxies).*

## Lifecycle & Caching

- **Discovery:** The active profile is the sole source of truth. There are no layering or merging semantics between profiles for providers.
- **Model Synchronization:** `providers.json` dictates *how* to authenticate and *where* to connect. A separate background process fetches the available models from these endpoints and persists them to an expendable cache (`cache/models.json`), keeping configuration durable and catalogs ephemeral.