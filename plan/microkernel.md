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
│  FOUNDATION (Native Capabilities)                            │
│  • json-file  • json-log  • archive  • glob  • logger        │
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

### Capability Injection
When a module needs a capability, it defines an adapter file (e.g., `json-file.ts`). The Kernel detects this file, asks the Foundation for the capability, and injects it.

```typescript
// modules/personas/json-file.ts
// The Module defines how it uses the capability
export default defineCapability((fs) => ({
  load: (name: string) => fs.read(`personas/${name}.json`),
  save: (name: string, data: any) => fs.write(`personas/${name}.json`, data),
}))
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
│   ├── registry.ts      # defineModule, defineCapability, module discovery
│   ├── resolver.ts      # Dependency graph
│   ├── injector.ts      # Context wiring
│   └── ipc.ts           # Auto-registration, broadcast, module emitter
├── modules/             # The Domain (Business Logic)
│   └── {name}/          # See Module File Convention below
├── foundation/          # The Capabilities (Native Wrappers)
│   ├── json-file.ts
│   ├── json-log.ts
│   ├── archive.ts
│   ├── logger.ts
│   └── ...
└── main.ts              # Entry Point
```

### Module File Convention

Every module follows the same structure with exactly three file types. This separation ensures testability and clean architecture.

```
modules/{name}/
├── mod.ts              # Required: Declaration only (defineModule)
├── business.ts         # Conditional: Domain logic (when not one-liner)
└── {capability}.ts     # Required per declared capability (defineCapability)
```

**1. {capability}.ts — The Adapter (Domain Knowledge)**
Contains all paths, file formats, and Foundation interactions.
```typescript
// modules/personas/json-file.ts
export default defineCapability((fs) => ({
  loadPersona: (id: string) => fs.read(`personas/${id}.json`), // Path knowledge here
  savePersona: (id: string, data: any) => fs.write(`personas/${id}.json`, data),
  listAll: () => fs.glob('personas/*.json'),
}))
```

**2. business.ts — The Logic (Pure Function)**
Contains algorithms and rules. Receives adapters as parameters. Zero knowledge of paths or Foundation.
```typescript
// modules/personas/business.ts
// Testable by mocking the adapter
export const createPersona = async (store: PersonaStore, data: any) => {
  const id = generateId()
  await store.savePersona(id, { ...data, version: 1 }) // Uses domain method
  return id
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
2. `business.ts` — All domain logic; receives capabilities as parameters; omit if logic is trivial
3. `{capability}.ts` — Thin adapter defining module-specific usage of a Foundation capability
4. **No other files permitted** — No sub-folders, no feature splits, no types.ts

### Module File Manifest

```
modules/
├── settings/
│   ├── mod.ts
│   └── json-file.ts
├── updater/
│   ├── mod.ts
│   ├── business.ts
│   └── logger.ts
├── ui/
│   ├── mod.ts
│   ├── business.ts
│   └── json-file.ts
├── profiles/
│   ├── mod.ts
│   ├── business.ts
│   ├── json-file.ts
│   ├── archive.ts
│   └── logger.ts
├── personas/
│   ├── mod.ts
│   ├── business.ts
│   ├── json-file.ts
│   └── logger.ts
├── messages/
│   ├── mod.ts
│   ├── business.ts
│   ├── json-log.ts
│   └── logger.ts
├── threads/
│   ├── mod.ts
│   ├── business.ts
│   ├── json-file.ts
│   ├── json-log.ts
│   └── logger.ts
└── ai/
    ├── mod.ts
    ├── business.ts
    └── logger.ts
```

### Module Dependency Graph

```
                    ┌─────────┐
                    │   ai    │  ← PURE: zero module dependencies
                    └────▲────┘
                         │ depends (for fetchModels)
    ┌──────────┐   ┌─────┴─────┐   ┌───────────┐
    │ settings │   │ profiles  │   │ messages  │
    │ deps: [] │   │ deps: [ai]│   │ deps: []  │
    └──────────┘   └─────▲─────┘   └─────▲─────┘
                         │               │
    ┌──────────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │ updater  │   │ personas  │   │  threads  │
    │ deps: [] │   │ deps:     │   │ deps:     │
    └──────────┘   │ [profiles]│   │ [messages]│
                   └───────────┘   └───────────┘
    ┌──────────┐
    │   ui     │
    │ deps: [] │
    └──────────┘
```

**Key Dependencies:**
- `ai`: Pure module with zero dependencies. Provides `stream()` (receives all data as params) and `fetchModels()` (pure HTTP).
- `profiles → ai`: Calls `deps.ai.fetchModels()` for HTTP, caches results locally.
- `personas → profiles`: Needs `getActiveProfileId()` to resolve profile personas.
- `threads → messages`: Thread operations derive from message tree.

**AI Orchestration**: The renderer gathers data from profiles, personas, and messages, then passes everything to `ai.stream()`. AI does not fetch data from other modules.

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
