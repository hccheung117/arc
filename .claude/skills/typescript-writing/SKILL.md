---
name: typescript-writing
description: TypeScript coding standards and type philosophy. Must use this skill when reading, writing or editing TypeScript code.
---

# TypeScript Writing Standards

## 1. Core Philosophy: "Clarity Over Correctness"

Types are a **readability tool with a budget**, not a correctness religion.

- **Types should name real concepts** (e.g., `User`, `Transaction`, `AppState`)
- **Avoid "Type Gymnastics":** If a type requires complex generics or conditional logic, it likely adds more maintenance debt than safety
- **Write implementations; let types emerge:** If a type exists only to satisfy the compiler, localize it or delete it and let inference handle it

## 2. Placement Policy: Where Types Live

Eliminate "decision tax" with a strict hierarchy:

| Type Category | Location | Purpose |
|---------------|----------|---------|
| **Contract Types** | Shared/types directories | Shapes crossing boundaries (API payloads, DB schemas, storage) |
| **Domain Types** | Feature/module directories | Types used across multiple files within a single feature |
| **Local Types** | Inside the `.ts` file | Types used by a single function or component |

**Hard Rule:** Shared directories contain only **Contract Types**. Keep UI/logic convenience types close to where they're used.

## 3. Verbosity Policy: "Annotate Boundaries, Infer Interiors"

TypeScript excels at inference. Don't duplicate the compiler's work.

- **Annotate:** Exported APIs and function parameters (documents the contract)
- **Infer:** Local variables and return types (unless inference fails or logic is complex)
- **Use `as const`:** Prefer object literals with `as const` over TS `enum` for better inference and zero runtime overhead

### Minimal Annotation Style

**Inline parameters over separate interfaces:**

```typescript
// Avoid: Redundant boilerplate
interface UpdateUserParams {
  id: string;
  email: string;
}
export async function updateUser(params: UpdateUserParams) { ... }

// Prefer: Inline parameters
export async function updateUser(params: {
  id: string;
  email: string;
}) { ... }
```

**Derive types from implementations:**

```typescript
// Prefer: Let implementation define the type
export function createConfig() {
  return {
    port: 3000,
    env: 'dev' as const,
    retries: 3,
  }
}

// Derive only if needed elsewhere
export type Config = ReturnType<typeof createConfig>
```

## 4. Modeling Patterns

- **Discriminated Unions:** For state (e.g., `Loading | Success | Error`), unions increase clarity and prevent impossible states
- **Composition over Extension:** Avoid `interface B extends A`. Use wrapper shapes or pick only what's needed: `{ user: User; isAdmin: boolean }`
- **One Source of Truth:**
  - For **Contract Types** with validation: Derive TS type from schema (e.g., `type User = z.infer<typeof UserSchema>`)
  - For **Logic**: Define the type once near the behavior that owns it

## 5. Checklist for Every Type

Apply this checklist **per-type**, not per-file. A `types.ts` file doesn't exempt types from earning their place there.

1. **How many consumers?** Single consumer → inline it at the call site, don't create a named type
2. **Is this a boundary?** (API, DB, External Input) → Use runtime validation and export the type
3. **Is this shared across features?** No → Keep it in the feature directory
4. **Is this shared across files?** No → Keep it in-file
5. **Can the compiler infer this?** Yes → Remove the manual annotation
6. **Is this type hard to read?** Yes → Simplify the code rather than writing a more complex type

**Single-consumer rule:** If a type like `FooOptions` is only used by `foo()`, inline it:
```typescript
// Avoid: Named type with single consumer
interface StreamOptions { model: Model; messages: Message[] }
export function streamText(options: StreamOptions) { ... }

// Prefer: Inline at call site
export function streamText(options: { model: Model; messages: Message[] }) { ... }
```
