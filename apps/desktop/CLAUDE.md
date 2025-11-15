# Arc Desktop App Development Guidelines

This document outlines the key conventions and development practices for the Arc desktop Electron application.

## Import Style: Absolute Paths with Same-Folder Exception

**Use absolute imports with the `@/` path alias for cross-folder imports.** Same-folder imports using `./` are allowed. Parent folder imports (`../`) are disallowed.

```typescript
// ✅ Correct - Absolute imports for cross-folder
import { someUtil } from '@/lib/utils'
import { handleMessage } from '@/ipc/messages'
import { db } from '@/db'

// ✅ Correct - Same-folder imports
import { helper } from './helper'
import { config } from './config'

// ❌ Incorrect - Parent folder imports
import { someUtil } from '../../../lib/utils'
import { handleMessage } from '../../ipc/messages'
import { db } from '../db'
```

## AI Integration Guidelines

### Core Principle: Vercel AI SDK as Primary Interface

All AI provider integrations MUST use the **Vercel AI SDK** (`ai` package) as the universal interface. This provides:
- Consistent API across multiple providers (OpenAI, Anthropic, Google, etc.)
- Built-in streaming support with standardized event types
- Framework-agnostic core for Electron compatibility
- TypeScript-first design with excellent type safety

**DO NOT** integrate provider SDKs directly (e.g., `openai` package). Use Vercel AI SDK's provider packages (e.g., `@ai-sdk/openai`, `@ai-sdk/anthropic`).

### IPC Streaming Pattern

AI responses stream from main process to renderer using an event-based push model:

### Streaming State Management

**In-Memory Only**:
- Streaming status (typing indicators, chunk buffers)
- Active stream tracking (`Map<streamId, AbortController>`)
- Transient errors during streaming

**Persisted to Database**:
- Complete user messages (immediately on send)
- Complete assistant messages (only after stream finishes)
- Conversation metadata (timestamps, participant info)

**Never Persist**:
- Partial/incomplete assistant responses
- Streaming progress indicators
- Temporary error states
