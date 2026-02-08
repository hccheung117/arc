# Microkernel Architecture

## 1. Vision & Philosophy

**Core Concept**: A functional, capability-based Microkernel architecture supported by a plugin-based module system.

- **Philosophy**: "Everything is a module." The Kernel is the orchestrator; Modules are the actors.
- **Pattern**: Capability-Based Dependency Injection via a central Registry.
- **Paradigm**: Functional Programming.
- **Goal**: Resolve low cohesion, excessive layering, and architectural drift by enforcing strict boundaries and predictable structures.

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
1.  **Discovery**: Scans the `modules/` directory to register available modules (`mod.js`).
2.  **Resolution**: Calculates the dependency graph and determines initialization order.
3.  **Injection**: Wires modules together, injecting requested capabilities (Foundation) and dependencies (other Modules).
4.  **Governance**: Enforces architectural rules (e.g., circular dependencies, undeclared access).
5.  **Routing**: Automates IPC between Main (Modules) and Renderer (UI).

## 4. The Modules (Domain)

Modules are isolated, functional units. They declare their needs (dependencies/capabilities) and expose their value (API).

### Principles
- **Strict Structure**: A module's internal structure implies its capabilities (e.g., presence of `json-file.js` implies JSON file I/O).
- **Loose Coupling**: Modules never import each other directly. They receive dependencies via the Kernel.
- **Statelessness**: Modules do not hold persistent state in memory. State is derived from disk or passed in.

### Module Definition (`mod.js`)

```javascript
export default defineModule({
  // 1. Declare Needs
  capabilities: ['jsonFile', 'logger'],  // Governance: Must match physical files
  depends: ['profiles'],                 // Graph: Resolution order

  // 2. Define Factory
  // - deps: Proxy to other modules (safe access)
  // - caps: Injected adapters
  provides: (deps, caps) => ({
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
When a module needs a capability, it defines an adapter file (e.g., `json-file.js`). The Kernel detects this file, asks the Foundation for the capability, and injects it.

The adapter file is not a thin wrapper — it's a **library for business**. It absorbs schemas, paths, and format concerns, exposing only high-level domain-aware APIs.

```javascript
// modules/personas/json-file.js
// Library for business — substantial, not thin
export default defineCapability((fs) => {
  const PersonaSchema = z.object({ id: z.string(), name: z.string() })

  return {
    loadPersona: (id) => fs.read(`personas/${id}.json`, PersonaSchema),
    savePersona: (id, data) => fs.write(`personas/${id}.json`, data),
    listAll: () => fs.glob('personas/*.json'),
    deletePersona: (id) => fs.delete(`personas/${id}.json`),
  }
})
```

## 6. Communication & Data Flow

### Request-Response (Renderer → Main)
- **Zero Boilerplate**: IPC channels derived automatically from module name + `provides` keys.
- **Kernel Routing**: `await personas.list()` in Renderer → `arc:personas:list` → Kernel → Module.

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

### Event Subscription (Main → Renderer)
- **Explicit Channels**: Modules declare `emits` in `mod.js`.
- **Kernel Bus**: Modules emit to the Kernel; Kernel routes to subscribed Renderers.

```
┌─────────────┐       emit()        ┌─────────┐      push       ┌──────────┐
│   Module    │ ──────────────────► │ Kernel  │ ───────────────► │ Renderer │
│ (stateless) │                     │ EventBus│                  │ (React)  │
└─────────────┘                     └─────────┘                  └──────────┘
```

## 7. Cross-Cutting Concerns

### Runtime Shapes
No types. Runtime shapes via plain objects and Zod schemas. JSDoc for IDE hints when helpful.

### Error Handling
- **Foundation**: Throws typed errors (`NetworkError`).
- **Modules**: Catch Foundation errors, wrap/handle them, and return `Result<T, E>`; only throw domain errors when it's meant to crash the process.
- **Kernel**: Catches unhandled errors and governance violations (must crash).

## 8. Implementation Reference

### Directory Structure
```
main/
├── kernel/              # The Orchestrator
│   ├── boot.js          # Kernel bootstrap sequence
│   ├── discovery.js     # Module discovery from filesystem
│   ├── governance.js    # Architectural rule enforcement
│   ├── injector.js      # Capability injection
│   ├── ipc.js           # Auto-registration, broadcast, module emitter
│   └── module.js        # defineModule, defineCapability
├── modules/             # The Domain (Business Logic)
│   └── {name}/          # See Module File Convention below
├── foundation/          # The Capabilities (Native Wrappers)
│   ├── archive.js
│   ├── binary-file.js
│   ├── glob.js
│   ├── http.js
│   ├── json-file.js
│   ├── json-log.js
│   ├── logger.js
│   └── markdown-file.js
├── preload.js           # Electron preload script
└── main.js              # Entry Point
```

**Acceptable ancillary files** (not shown above):
- `CLAUDE.md` — Project documentation for AI assistants
- `{name}.test.js` — Test files collocated with implementation

### Module File Convention

Every module follows the same structure with exactly three file types. This separation ensures testability and clean architecture.

```
modules/{name}/
├── mod.js              # Required: Declaration only (defineModule)
├── business.js         # Conditional: Domain logic (when not one-liner)
└── {capability}.js     # Required per declared capability (defineCapability)
```

**1. {capability}.js — The Library for Business**
Cap files are libraries that serve `business.js`. They anticipate what business needs and provide high-level, domain-aware APIs that make business's job easy. They absorb all persistence complexity: schemas, paths, formats, validation, error handling.

**Design Mindset**: "I am `json-log.js` in the messages module. What does business need to do with message logs? Let me provide easy-to-use APIs so business can focus on domain logic."

```javascript
// modules/messages/json-log.js
// Substantial — not a thin wrapper
export default defineCapability((log) => {
  const schema = z.object({ id: z.string(), content: z.string() })

  return {
    // High-level, domain-aware API
    appendEvent: (threadId, event) =>
      log.append(`app/messages/${threadId}.jsonl`, schema.parse(event)),

    readHistory: (threadId) =>
      log.read(`app/messages/${threadId}.jsonl`, schema),

    deleteThread: (threadId) =>
      log.delete(`app/messages/${threadId}.jsonl`),
  }
})
```

**2. business.js — Pure Domain Logic**
Contains algorithms, rules, and orchestration. Receives capabilities as parameters. Zero knowledge of paths, schemas, or persistence format.
```javascript
// modules/messages/business.js
// Pure domain logic — no persistence knowledge
export const appendMessage = async (store, input) => {
  const event = buildMessageEvent(input)  // Pure transform
  await store.appendEvent(input.threadId, event)  // Cap handles persistence
  return event
}
```

**3. mod.js — The Wiring (Declaration)**
Wires capabilities to the API surface.
```javascript
// modules/personas/mod.js
import * as biz from './business'

export default defineModule({
  capabilities: ['jsonFile'],
  provides: (deps, caps) => ({
    // IPC channel 'arc:personas:create' derived automatically
    create: (data) => biz.createPersona(caps.jsonFile, data),
  }),
})
```

**Rules**:
1. `mod.js` — Pure declaration; wires capabilities to API surface
2. `business.js` — Pure domain logic; receives capabilities as parameters; omit if logic is trivial
3. `{capability}.js` — Library for business; absorbs persistence complexity; provides high-level domain-aware APIs
4. **No other files permitted** — No sub-folders, no feature splits

### Module File Manifest

```
modules/
├── ai/
│   ├── mod.js
│   ├── business.js
│   ├── http.js
│   └── logger.js
├── messages/
│   ├── mod.js
│   ├── business.js
│   ├── binary-file.js
│   ├── json-log.js
│   ├── logger.js
│   └── markdown-file.js
├── personas/
│   ├── mod.js
│   ├── business.js
│   ├── binary-file.js
│   ├── glob.js
│   ├── logger.js
│   └── markdown-file.js
├── profiles/
│   ├── mod.js
│   ├── business.js
│   ├── archive.js
│   ├── binary-file.js
│   ├── glob.js
│   ├── json-file.js
│   └── logger.js
├── settings/
│   ├── mod.js
│   └── json-file.js
├── threads/
│   ├── mod.js
│   ├── business.js
│   └── json-file.js
├── ui/
│   ├── mod.js
│   ├── business.js
│   ├── json-file.js
│   └── logger.js
└── updater/
    ├── mod.js
    ├── business.js
    └── logger.js
```

### Governance Rules
1.  **No Cross-Module Imports**: Modules must not import other modules directly.
2.  **File Size**: Max 1000 lines per file (strict refactor trigger).
3.  **Integrity**: `mod.js` declarations must match the actual file tree (e.g., declaring `capabilities: ['jsonFile']` requires `json-file.js`).
4.  **Path Boundary**: Modules can only access disk paths they explicitly declare. Multi-scope declarations (e.g., `paths: ['profiles/', 'app/settings.json']`) are validated against any declared path.

## 9. Development Strategy: Agent First

The architecture splits responsibilities to suit AI development agents:

- **`kernel-developer`**: Maintains the "Spinal Cord" (Infrastructure, Governance).
- **`foundation-developer`**: Builds the "Tools" (Safe, Scoped I/O).
- **`module-developer`**: Builds the "Features" (Domain Logic) using the Tools within the Kernel's rules.
