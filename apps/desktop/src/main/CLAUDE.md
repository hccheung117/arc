# Main Process

> Implementation patterns for backend concerns.

## AI Streaming

Streaming state divides into three categories:

| Category | Examples |
|----------|----------|
| In-memory only | Typing indicators, chunk buffers, abort controllers |
| Persisted | Complete user messages (immediate), assistant messages (after stream ends) |
| Never persisted | Partial responses, streaming progress, transient errors |

## Logging

| Environment | `info` | `warn`/`error` |
|-------------|--------|----------------|
| Dev | Console | Console |
| Prod | Silent | Console + File |

One log per operation, not per step. No logging in loops.
