# Main Process

> Implementation patterns for backend concerns.

## Module Architecture

Cap files (`{cap}.ts`) are libraries for `business.ts`, not thin foundation wrappers. They absorb all low-level concerns (e.g., I/O, schemas, format, HTTP, caching, retries) so business reads like pure domain logic.

**Cap design thinking:** "I am `{cap}.ts`. What does business need? How would it ideally call me? What complexity can I absorb to make its job easy?" Cap exposes only what business needs — high-level, domain-friendly verbs. Business has zero knowledge of Foundation, file paths, or implementation details.

Use `/develop-module <name>` for guided module creation.

## Implementation Standards

### AI Streaming

Streaming state divides into three categories:

| Category | Examples |
|----------|----------|
| In-memory only | Typing indicators, chunk buffers, abort controllers |
| Persisted | Complete user messages (immediate), assistant messages (after stream ends) |
| Never persisted | Partial responses, streaming progress, transient errors |

### Logging

| Environment | `info` | `warn`/`error` |
|-------------|--------|----------------|
| Dev | Console | Console |
| Prod | Silent | Console + File |

One log per operation, not per step. No logging in loops.
