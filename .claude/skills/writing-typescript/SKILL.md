---
name: writing-typescript
description: TypeScript coding standards and type philosophy. Must use this skill when reading, writing or editing TypeScript code.
---

Always write TypeScript code that strictly aligns with Preferences.

# Preferences

## Type Annotations

- Annotate parameters; let return types infer
- Inline single-consumer types at call sites—no named types for one-off use
- `as const` objects, never `enum`
- Derive from implementations: `ReturnType<typeof fn>`, `z.infer<typeof Schema>`

## Type Placement

- **Contract types** (API, DB, storage) → shared types directory
- **Feature types** (multi-file within feature) → feature directory
- **Local types** → inline in file

Shared directories hold **only** contract types.

## Modeling

- Composition over extension: `{ user: User; isAdmin: boolean }` not `extends`
- Contract types derive from validation schemas

## Justification Test

Delete any named type where: single consumer, inferable, or not crossing a boundary.
