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
│  • Filesystem  • Network  • Logger  • Archive                │
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
- **Strict Structure**: A module's internal structure implies its capabilities (e.g., presence of `filesystem.ts` implies file I/O access).
- **Loose Coupling**: Modules never import each other directly. They receive dependencies via the Kernel.
- **Statelessness**: Modules do not hold persistent state in memory. State is derived from disk or passed in.

### Module Definition (`mod.ts`)

```typescript
export default defineModule({
  // 1. Declare Needs
  capabilities: ['filesystem', 'logger'],  // Governance: Must match physical files
  depends: ['profiles'],                   // Graph: Resolution order

  // 2. Define Factory
  // - deps: Proxy to other modules (safe access)
  // - caps: Injected foundation capabilities (scoped access)
  provides: (deps, caps) => ({
    list: () => listPersonas(caps.filesystem),
    create: (data) => createPersona(caps.filesystem, data),
    
    // Cross-module usage
    assign: async (personaId, profileId) => {
      const profile = await deps.profiles.get(profileId)
      return link(caps.filesystem, personaId, profile)
    }
  }),
  
  // 3. Declare Outputs
  emits: ['persona:updated'],    // IPC: Allowed events
  paths: ['data/personas'],      // Governance: Disk ownership
})
```

## 5. The Foundation (Capabilities)

The Foundation layer provides safe, standardized wrappers around native system operations ("The How").

### The Capability Contract
The Foundation provides a **Factory** that the Kernel uses to create scoped instances for Modules.

1.  **Shape**: Transforms raw Node APIs into domain-friendly APIs (`json-file`, `json-log`).
2.  **Scope**: Restricts access to specific paths or resources.
3.  **Security**: Validates inputs and handles errors before they reach the module.

### Capability Injection
When a module needs a capability, it defines an adapter file (e.g., `filesystem.ts`). The Kernel detects this file, asks the Foundation for the capability, and injects it.

```typescript
// modules/personas/filesystem.ts
// The Module defines how it uses the capability
export default defineCapability({
  load: (fs, name: string) => fs.readText(`personas/${name}.json`),
  save: (fs, name: string, data: any) => fs.writeJson(`personas/${name}.json`, data),
})
```

## 6. Communication & Data Flow

### Request-Response (Renderer → Main)
- **Zero Boilerplate**: The Renderer imports API types directly from module definitions.
- **Kernel Routing**: `await personas.list()` in Renderer → Kernel IPC → `modules/personas/mod.ts`.

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

### Error Handling
- **Foundation**: Throws typed errors (`NetworkError`).
- **Modules**: Catch Foundation errors, wrap/handle them, and return `Result<T, E>`; only throw domain errors when it's meant to crash the process.
- **Kernel**: Catches unhandled errors and governance violations (must crash).

## 8. Implementation Reference

### Directory Structure
```
main/
├── kernel/              # The Orchestrator
│   ├── registry.ts      # Module discovery
│   ├── resolver.ts      # Dependency graph
│   ├── injector.ts      # Context wiring
│   └── ipc.ts           # Auto-registration
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

Every module follows the same structure with exactly three file types:

```
modules/{name}/
├── mod.ts              # Required: Declaration only (defineModule)
├── business.ts         # Conditional: Domain logic (when not one-liner)
└── {capability}.ts     # Required per declared capability (defineCapability)
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

### Governance Rules
1.  **No Cross-Module Imports**: Modules must not import other modules directly.
2.  **File Size**: Max 1000 lines per file (strict refactor trigger).
3.  **Integrity**: `mod.ts` declarations must match the actual file tree (e.g., declaring `capabilities: ['jsonFile']` requires `json-file.ts`).
4.  **Path Boundary**: Modules can only access disk paths they explicitly declare.

## 9. Development Strategy: Agent First

The architecture splits responsibilities to suit AI development agents:

- **`kernel-developer`**: Maintains the "Spinal Cord" (Infrastructure, Governance).
- **`foundation-developer`**: Builds the "Tools" (Safe, Scoped I/O).
- **`module-developer`**: Builds the "Features" (Domain Logic) using the Tools within the Kernel's rules.
