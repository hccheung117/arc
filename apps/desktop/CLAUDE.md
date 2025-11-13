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
