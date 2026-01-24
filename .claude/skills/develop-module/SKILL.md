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
2. Determine which capabilities this module needs based on domain analysis. Each selected capability becomes one physical `{cap}.ts` file

## Phase 3: Cap API Design

For each selected capability, apply this thinking process:

1. "I am `{cap}.ts` in the `{module}` module"
2. "What does `business.ts` need to accomplish?"
3. "How would business ideally call me?" — domain-level verbs, not Foundation verbs
4. "What complexity should I absorb?" — low level details, e.g., schemas, paths, format, atomicity, error handling, caching, HTTP, retries
5. "What high-level API should I expose?" — only what's needed, easy to call, hard to misuse

**Present designed APIs to user for approval before writing code.**

## Phase 4: Scaffold

Write the module files:
- mod.ts
- business.ts
- {cap}.ts (one per capability)

## Phase 5: Validate

Run these checks after scaffolding:

1. **Type-check passes** — `npx tsc --noEmit`
2. **ESLint `import type` rule** — adapters in `mod.ts` use `import type`
3. **No Foundation imports in `business.ts`** — business stays pure
4. **File count matches** — exactly `mod.ts` + `business.ts` (if needed) + one file per declared capability
