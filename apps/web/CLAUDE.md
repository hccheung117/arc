# Arc Web App Development Guidelines

This document outlines the key conventions, architectural decisions, and development practices for the Arc web application. Following these guidelines ensures consistency, maintainability, and a smooth development workflow.

## 1. Architecture: Static Export for Electron

The Next.js application is configured for **static export** (`output: 'export'`). This is a critical architectural constraint because the web app is embedded within an Electron-based macOS client.

Key implications:
- **No Server-Side Code**: The production build consists purely of static HTML, CSS, and JavaScript files. Server-side rendering (SSR), API routes, and React Server Components are not supported.
- **Static Generation**: All pages must be statically generated at build time. Dynamic server-side logic is not available at runtime.

## 2. Project Structure and Organization

We follow a structured approach to file organization to keep the codebase clean and predictable.

### 2.1. Import Style: Absolute Paths with Same-Folder Exception

**Use absolute imports with the `@/` path alias for cross-folder imports.** Same-folder imports using `./` are allowed. Parent folder imports (`../`) are disallowed.

```typescript
// ✅ Correct - Absolute imports for cross-folder
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'

// ✅ Correct - Same-folder imports
import { MyComponent } from './my-component'
import { helperFunction } from './helpers'

// ❌ Incorrect - Parent folder imports
import { Button } from '../../../components/ui/button'
import { useAuth } from '../../hooks/use-auth'
import { formatDate } from '../lib/utils'
```

### 2.2. Directory Structure

#### Shared Code

Code that is reusable across multiple, unrelated parts of the application belongs in the root-level directories:

-   `@/components/`: Shared React components.
-   `@/hooks/`: Shared React hooks (`use...`).
-   `@/lib/`: Shared utility functions and libraries.

#### Route-Specific Code (Colocation)

For code that is only used by a specific route (and its children), colocate it within the corresponding `app/` directory. This keeps related logic together and avoids polluting the global shared directories.

**Example for `app/some/route/page.tsx`:**

```
app/
└── some/
    └── route/
        ├── page.tsx          # Main page component
        ├── layout.tsx        # Route-specific layout
        ├── loading.tsx       # Loading UI
        ├── error.tsx         # Error boundary
        ├── not-found.tsx     # 404 page
        ├── lib.ts            # Route-specific utilities
        ├── sidebar.tsx       # Route-specific component
        └── use-route-store.ts # Route-specific hook
```

### 2.3. UI Components (shadcn/ui)

This project uses shadcn/ui for its component library.

-   **Installation Path**: All shadcn/ui components **must** be installed in the `@/components/ui` directory. This directory is reserved exclusively for unmodified shadcn/ui components. Do not place custom components here.
-   **Adding New Components**: Always use the official `shadcn-ui` CLI to add new components. This ensures they are added correctly and consistently.

```bash
# Example: Adding a button component
pnpm dlx shadcn-ui@latest add button
```

## 3. Next.js Best Practices

### 3.1. Utilizing App Router Files

Leverage the special files of the Next.js App Router to handle concerns like layouts, loading states, and error boundaries. Avoid putting all logic into `page.tsx`.

-   `layout.tsx`: Define UI that is shared across multiple pages.
-   `loading.tsx`: Create meaningful loading UI for a route segment.
-   `not-found.tsx`: Design a custom 404 page.
-   `error.tsx`: Handle runtime errors gracefully within a route segment.

This approach promotes better separation of concerns and improves the user experience.

### 3.2. Browser APIs in Static Export Mode

Client Components are pre-rendered to HTML during `next build`. Browser APIs like `window`, `localStorage`, and `navigator` are not available on the server, so you must safely access these APIs only when running in the browser.

**Always use `useEffect` or client-side checks to access Browser APIs:**

```typescript
'use client';

import { useEffect } from 'react';

export default function ClientComponent() {
  useEffect(() => {
    // Safe: Browser APIs are now available
    console.log(window.innerHeight);
    const theme = localStorage.getItem('theme');
    const userAgent = navigator.userAgent;
  }, []);

  return ...;
}
```

This prevents runtime errors during the build process and ensures your components work correctly in static export mode.

## 4. Development Tools

### Next.js MCP Integration

Next.js 16+ includes built-in MCP (Model Context Protocol) support at `http://localhost:3000/_next/mcp` when the dev server runs. **Use this extensively for development and debugging.**

MCP provides real-time runtime inspection capabilities:
-   **Error detection**: Get current build errors, runtime errors, and config validation issues
-   **Page metadata**: Inspect what contributes to page renders in active browser sessions
-   **Server Actions**: Locate Server Action implementations by their ID
-   **Project metadata**: Access dev server configuration and project paths

This enables AI assistants to understand runtime behavior without parsing static files, making debugging and development significantly more efficient.
