# Microkernel Architecture

## 1. Vision & Philosophy

**Core Concept**: A functional, capability-based Microkernel architecture supported by a plugin-based module system.

- **Philosophy**: "Everything is a module." The Kernel is the orchestrator; Modules are the actors.
- **Pattern**: Capability-Based Dependency Injection via a central Registry.
- **Paradigm**: Functional Programming.
- **Goal**: Resolve low cohesion, excessive layering, and architectural drift by enforcing strict boundaries and predictable structures.
- **Type Philosophy**: Infer, derive, don't write.

## 2. System Model

The system is divided into three distinct layers, each with a single responsibility:

1.  **Kernel** (Governance): Manages lifecycle, dependency injection, and IPC. It contains **no** business logic.
2.  **Modules** (Domain): Self-contained units that define *what* the app does. They contain **all** business logic.
3.  **Foundation** (Capabilities): Native wrappers that define *how* the app interacts with the OS. They contain **no** business logic.

```
┌──────────────────────────────────────────────────────────────┐
│  KERNEL (Orchestrator)                                       │
│  • Registry  • Dependency Graph  • IPC Router  • Governance  │
└──────────────────────────────┬───────────────────────────────┘
                               │ Orchestrates
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  MODULES (Domain Logic)                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ AI       │  │ Messages │  │ Profiles │ ...                │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                    │
└───────┼─────────────┼─────────────┼──────────────────────────┘
        │ Injects     │ Injects     │ Injects
        ▼             ▼             ▼
┌──────────────────────────────────────────────────────────────┐
│  FOUNDATION (Native Capabilities)                                        │
│  • json-file  • json-log  • binary-file  • markdown-file  • archive  • logger │
└──────────────────────────────────────────────────────────────┘
```

## 3. The Kernel (Orchestrator)

The Kernel is the spinal cord of the application. It creates the environment in which modules exist.

### Responsibilities
1.  **Discovery**: Scans the `modules/` directory to register available modules (`mod.ts`).
2.  **Resolution**: Calculates the dependency graph and determines initialization order.
3.  **Injection**: Wires modules together, injecting requested capabilities (Foundation) and dependencies (other Modules).
4.  **Governance**: Enforces architectural rules (e.g., circular dependencies, undeclared access).
5.  **Routing**: Automates IPC between Main (Modules) and Renderer (UI).

## 4. The Modules (Domain)

Modules are isolated, functional units. They declare their needs (dependencies/capabilities) and expose their value (API).

### Principles
- **Strict Structure**: A module's internal structure implies its capabilities (e.g., presence of `json-file.ts` implies JSON file I/O).
- **Loose Coupling**: Modules never import each other directly. They receive dependencies via the Kernel.
- **Statelessness**: Modules do not hold persistent state in memory. State is derived from disk or passed in.

### Module Definition (`mod.ts`)

```typescript
// Type imports for compile-time inference (no runtime dependency)
import type jsonFileAdapter from './json-file'
import type loggerAdapter from './logger'

// Caps type derived from adapter implementations
type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  // 1. Declare Needs
  capabilities: ['jsonFile', 'logger'],  // Governance: Must match physical files
  depends: ['profiles'],                 // Graph: Resolution order

  // 2. Define Factory
  // - deps: Proxy to other modules (safe access)
  // - caps: Injected adapters (typed via Caps)
  provides: (deps, caps: Caps) => ({
    list: () => listPersonas(caps.jsonFile),
    create: (data) => createPersona(caps.jsonFile, data),

    // Cross-module usage
    assign: async (personaId, profileId) => {
      const profile = await deps.profiles.get(profileId)
      return link(caps.jsonFile, personaId, profile)
    }
  }),

  // 3. Declare Outputs
  emits: ['persona:updated'],              // IPC: Allowed event channels
  paths: ['profiles/', 'app/personas/'],   // Governance: Disk ownership (multi-scope)
})
```

**IPC is fully automated**: Kernel derives IPC channels from module name + `provides` keys. No contract definition needed.

## 5. The Foundation (Capabilities)

The Foundation layer provides safe, standardized wrappers around native system operations ("The How").

### The Capability Contract
The Foundation provides a **Factory** that the Kernel uses to create scoped instances for Modules.

1.  **Shape**: Transforms raw Node APIs into domain-friendly APIs (`json-file`, `json-log`).
2.  **Scope**: Restricts access to declared paths. Factories accept `allowedPaths: string[]` and validate operations against **any** declared path (multi-scope).
3.  **Security**: Validates inputs and handles errors before they reach the module.

### Capability Taxonomy

```
SANDBOXED (path-scoped to module's declared paths[])
────────────────────────────────────────────────────
json-file     - JSON read/write
json-log      - Append-only event log
binary-file   - Raw buffer I/O
archive       - Zip/unzip operations
glob          - File pattern matching
markdown-file - Markdown with frontmatter (read/write)

NETWORK (host-scoped, streaming-aware)
──────────────────────────────────────
http          - HTTP client with streaming support (SSE, chunked)
              - Scoped by allowed hosts/endpoints

UNSANDBOXED (explicit user consent)
───────────────────────────────────
markdown-file.saveAs - Export to user-chosen location via dialog
                       User picks path → implicit consent
```

Unsandboxed operations are safe because they require user interaction (dialog) before any file is written outside the app's data directory.

### Capability Injection
When a module needs a capability, it defines an adapter file (e.g., `json-file.ts`). The Kernel detects this file, asks the Foundation for the capability, and injects it.

The adapter file is not a thin wrapper — it's a **library for business**. It absorbs schemas, paths, and format concerns, exposing only high-level domain-aware APIs.

```typescript
// modules/personas/json-file.ts
// Library for business — substantial, not thin
export default defineCapability((fs) => {
  const PersonaSchema = z.object({ id: z.string(), name: z.string(), ... })

  return {
    loadPersona: (id: string) => fs.read(`personas/${id}.json`, PersonaSchema),
    savePersona: (id: string, data: Persona) => fs.write(`personas/${id}.json`, data),
    listAll: () => fs.glob('personas/*.json'),
    deletePersona: (id: string) => fs.delete(`personas/${id}.json`),
  }
})
```

## 6. Communication & Data Flow

### Request-Response (Renderer → Main)
- **Zero Boilerplate**: IPC channels derived automatically from module name + `provides` keys.
- **Kernel Routing**: `await personas.list()` in Renderer → `arc:personas:list` → Kernel → Module.
- **No Contracts**: Types flow from module `provides` to preload client. TypeScript ensures correctness at compile time.

```
Renderer                          Kernel                           Module
────────                          ──────                           ──────
personas.list()          →        ipc.handle('arc:personas:list')  →  provides.list()
                                  Channel derived from:
                                  • Module name: 'personas'
                                  • Operation key: 'list'
```

### Validation Strategy
- **No IPC-level validation**: Renderer is trusted code, not an external client.
- **Domain validation**: Business logic validates input where domain rules matter.
- **TypeScript safety**: Compile-time type checking prevents most errors.

### Event Subscription (Main → Renderer)
- **Explicit Channels**: Modules declare `emits` in `mod.ts`.
- **Kernel Bus**: Modules emit to the Kernel; Kernel routes to subscribed Renderers.

```
┌─────────────┐       emit()        ┌─────────┐      push       ┌──────────┐
│   Module    │ ──────────────────► │ Kernel  │ ───────────────► │ Renderer │
│ (stateless) │                     │ EventBus│                  │ (React)  │
└─────────────┘                     └─────────┘                  └──────────┘
```

## 7. Cross-Cutting Concerns

### Type Strategy
**"Types Live at the Source"**
- Types are derived from implementation (`typeof implementation`).
- No manual `types.ts` files.
- **Flow**: Implementation → derives → Type → exported → consumed.

**Capability Types in Modules**
- `mod.ts` uses `import type` to import adapter types (compile-time only, no runtime dependency)
- `Caps` type is derived via `ReturnType<typeof adapter.factory>`
- ESLint enforces `import type` only for adapter imports in `mod.ts`
- This separates governance (string array) from typing (derived from adapters)

### Error Handling
- **Foundation**: Throws typed errors (`NetworkError`).
- **Modules**: Catch Foundation errors, wrap/handle them, and return `Result<T, E>`; only throw domain errors when it's meant to crash the process.
- **Kernel**: Catches unhandled errors and governance violations (must crash).

## 8. Implementation Reference

### Directory Structure
```
main/
├── kernel/              # The Orchestrator
│   ├── boot.ts          # Kernel bootstrap sequence
│   ├── discovery.ts     # Module discovery from filesystem
│   ├── governance.ts    # Architectural rule enforcement
│   ├── injector.ts      # Capability injection
│   ├── ipc.ts           # Auto-registration, broadcast, module emitter
│   └── module.ts        # defineModule, defineCapability
├── modules/             # The Domain (Business Logic)
│   └── {name}/          # See Module File Convention below
├── foundation/          # The Capabilities (Native Wrappers)
│   ├── archive.ts
│   ├── binary-file.ts
│   ├── glob.ts
│   ├── http.ts
│   ├── json-file.ts
│   ├── json-log.ts
│   ├── logger.ts
│   └── markdown-file.ts
├── preload.ts           # Electron preload script
└── main.ts              # Entry Point
```

**Acceptable ancillary files** (not shown above):
- `CLAUDE.md` — Project documentation for AI assistants
- `{name}.test.ts` — Test files collocated with implementation

### Module File Convention

Every module follows the same structure with exactly three file types. This separation ensures testability and clean architecture.

```
modules/{name}/
├── mod.ts              # Required: Declaration only (defineModule)
├── business.ts         # Conditional: Domain logic (when not one-liner)
└── {capability}.ts     # Required per declared capability (defineCapability)
```

**1. {capability}.ts — The Library for Business**
Cap files are libraries that serve `business.ts`. They anticipate what business needs and provide high-level, domain-aware APIs that make business's job easy. They absorb all persistence complexity: schemas, paths, formats, validation, error handling.

**Design Mindset**: "I am `json-log.ts` in the messages module. What does business need to do with message logs? Let me provide easy-to-use APIs so business can focus on domain logic."

```typescript
// modules/messages/json-log.ts
// Substantial — not a thin wrapper
export default defineCapability((log) => {
  const schema = z.object({ id: z.string(), content: z.string(), ... })

  return {
    // High-level, domain-aware API
    appendEvent: (threadId: string, event: MessageEvent) =>
      log.append(`app/messages/${threadId}.jsonl`, schema.parse(event)),

    readHistory: (threadId: string) =>
      log.read(`app/messages/${threadId}.jsonl`, schema),

    deleteThread: (threadId: string) =>
      log.delete(`app/messages/${threadId}.jsonl`),
  }
})
```

**2. business.ts — Pure Domain Logic**
Contains algorithms, rules, and orchestration. Receives capabilities as parameters. Zero knowledge of paths, schemas, or persistence format.
```typescript
// modules/messages/business.ts
// Pure domain logic — no persistence knowledge
export const appendMessage = async (
  store: MessageStore,  // Receives cap
  input: AppendInput
) => {
  const event = buildMessageEvent(input)  // Pure transform
  await store.appendEvent(input.threadId, event)  // Cap handles persistence
  return event
}
```

**3. mod.ts — The Wiring (Declaration)**
Wires capabilities to the API surface. Uses `import type` to derive adapter types.
```typescript
// modules/personas/mod.ts
import type jsonFileAdapter from './json-file'
import * as biz from './business'

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
}

export default defineModule({
  capabilities: ['jsonFile'],
  provides: (deps, caps: Caps) => ({
    // caps.jsonFile is correctly typed as the adapter's return type
    // IPC channel 'arc:personas:create' derived automatically
    create: (data) => biz.createPersona(caps.jsonFile, data),
  }),
})
```

**Rules**:
1. `mod.ts` — Pure declaration; wires capabilities to API surface
2. `business.ts` — Pure domain logic; receives capabilities as parameters; omit if logic is trivial
3. `{capability}.ts` — Library for business; absorbs persistence complexity; provides high-level domain-aware APIs
4. **No other files permitted** — No sub-folders, no feature splits, no types.ts

### Module File Manifest

```
modules/
├── ai/
│   ├── mod.ts
│   ├── business.ts
│   ├── http.ts
│   └── logger.ts
├── messages/
│   ├── mod.ts
│   ├── business.ts
│   ├── binary-file.ts
│   ├── json-log.ts
│   ├── logger.ts
│   └── markdown-file.ts
├── personas/
│   ├── mod.ts
│   ├── business.ts
│   ├── binary-file.ts
│   ├── glob.ts
│   ├── logger.ts
│   └── markdown-file.ts
├── profiles/
│   ├── mod.ts
│   ├── business.ts
│   ├── archive.ts
│   ├── binary-file.ts
│   ├── glob.ts
│   ├── json-file.ts
│   └── logger.ts
├── settings/
│   ├── mod.ts
│   └── json-file.ts
├── threads/
│   ├── mod.ts
│   ├── business.ts
│   └── json-file.ts
├── ui/
│   ├── mod.ts
│   ├── business.ts
│   ├── json-file.ts
│   └── logger.ts
└── updater/
    ├── mod.ts
    ├── business.ts
    └── logger.ts
```

### Governance Rules
1.  **No Cross-Module Imports**: Modules must not import other modules directly.
2.  **File Size**: Max 1000 lines per file (strict refactor trigger).
3.  **Integrity**: `mod.ts` declarations must match the actual file tree (e.g., declaring `capabilities: ['jsonFile']` requires `json-file.ts`).
4.  **Path Boundary**: Modules can only access disk paths they explicitly declare. Multi-scope declarations (e.g., `paths: ['profiles/', 'app/settings.json']`) are validated against any declared path.
5.  **Type-Only Adapter Imports**: `mod.ts` must use `import type` for adapter imports (ESLint enforced). Runtime injection is kernel's responsibility.

## 9. Development Strategy: Agent First

The architecture splits responsibilities to suit AI development agents:

- **`kernel-developer`**: Maintains the "Spinal Cord" (Infrastructure, Governance).
- **`foundation-developer`**: Builds the "Tools" (Safe, Scoped I/O).
- **`module-developer`**: Builds the "Features" (Domain Logic) using the Tools within the Kernel's rules.
