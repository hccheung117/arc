---
description: Guided workflow for developing a kernel module with proper cap/business separation. USE PROACTIVELY when developing a module or migrating existing code into the module system.
argument-hint: [module]
---

# Develop Module

Guided workflow for developing a module at `apps/desktop/src/main/modules/{name}/`.

## Phase 1: Domain Analysis

Understand:
1. What does this module do? What problem does it solve?
2. What data does it manage or produce?
3. What events does it emit (if any)?
4. What other modules does it depend on?

## Phase 2: Capability Selection

1. Discover available legal capabilities
2. Determine which capabilities this module needs based on domain analysis. Each selected capability becomes one physical `{cap}.js` file

## Phase 3: Cap API Design

For each selected capability, apply this thinking process:

1. "I am `{cap}.js` in the `{module}` module"
2. "What does `business.js` need to accomplish?"
3. "How would business ideally call me?" — domain-level verbs, not Foundation verbs
4. "What complexity should I absorb?" — low level details, e.g., schemas, paths, format, atomicity, error handling, caching, HTTP, retries
5. "What high-level API should I expose?" — only what's needed, easy to call, hard to misuse

**Error Handling Strategy**: Foundation throws typed errors; modules catch and return `Result<T, E>`.

**Present designed APIs to user for approval before writing code.**

## Phase 4: Module Surface Design

Design the `provides:` API in `mod.js` — this is what consumers call via IPC.

### Identify Primitives

1. "What is the smallest set of operations that can express all use cases?"
2. For each proposed operation: "Can this be expressed by composing other operations?"
   - If yes: "What do we lose by not having it?" (atomicity? performance?)
3. "What data does the consumer already have vs. need to fetch?"

### Test Against Reality

4. For compound operations:
   - "Does the UI gesture map 1:1 to this operation?"
   - "Would splitting it cause partial failure states?"
   - "Would splitting it multiply IPC round trips?"

5. For convenience methods:
   - "Does the consumer already have the inputs to do this themselves?"
   - "Am I hiding complexity or just adding indirection?"

### Shape Signatures

6. For each input parameter:
   - "Is this the most general form?" (e.g., `ids[]` vs `id1, id2`)
   - "Could two parameters be one with a sentinel value?" (e.g., `parentId | null` vs separate ops)

7. For each return type:
   - "Does the consumer need this data, or do they already have it?"
   - "If returning void, how will the consumer know what happened?" (events?)

### Check Boundaries

8. For operations touching another module:
   - "Should this live here, or in the other module?"
   - "Am I re-implementing something that module already provides?"

9. "What would a new consumer need that current consumers don't?"
   - "Does the API allow it, or would I need to add more methods?"

### Decision Framework

- **Keep compound ops when**: IPC cost is real, atomicity matters, UI gesture is 1:1
- **Remove convenience methods when**: consumer already has inputs, it's just indirection
- **Generalize signatures when**: current form is overly specific to one use case

**Present designed surface to user for approval before scaffolding.**

## Phase 5: Scaffold

Write the module files:
- mod.js
- business.js
- {cap}.js (one per capability)

## Phase 6: Validate

Run these checks after scaffolding:

1. **ESLint passes** — `npx eslint .` from `apps/desktop/`
2. **No Foundation imports in `business.js`** — business stays pure
3. **File count matches** — exactly `mod.js` + `business.js` (if needed) + one file per declared capability
