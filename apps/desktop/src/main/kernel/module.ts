import type { ScopedJsonFile } from '@main/foundation/json-file'
import type { ScopedJsonLog } from '@main/foundation/json-log'
import type { ScopedArchive } from '@main/foundation/archive'
import type { Glob } from '@main/foundation/glob'
import type { Logger } from '@main/foundation/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FoundationCapabilities = {
  jsonFile: ScopedJsonFile
  jsonLog: ScopedJsonLog
  archive: ScopedArchive
  glob: Glob
  logger: Logger
}

export type CapabilityName = keyof FoundationCapabilities

/**
 * Maps dependency names to their APIs via IPC proxy.
 * Each dependency becomes a property with its exported API.
 */
export type DependencyProxy<Deps extends readonly string[]> = {
  [K in Deps[number]]: Record<string, (...args: unknown[]) => unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any

export interface ModuleConfig<
  Caps extends readonly CapabilityName[],
  Deps extends readonly string[],
  API extends Record<string, AnyFunction>,
  Events extends readonly string[],
  // AdaptedCaps allows modules to define their own Caps type with adapter return types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AdaptedCaps = any
> {
  capabilities: Caps
  depends: Deps
  // Caps are adapted at runtime by kernel injector; modules cast to their own Caps type
  provides: (deps: DependencyProxy<Deps>, caps: AdaptedCaps) => API
  emits: Events
  paths: readonly string[]
}

export interface ModuleDefinition<API = unknown> {
  name: string
  capabilities: readonly string[]
  depends: readonly string[]
  emits: readonly string[]
  paths: readonly string[]
  factory: (deps: unknown, caps: unknown) => API
}

// ─────────────────────────────────────────────────────────────────────────────
// defineModule
// ─────────────────────────────────────────────────────────────────────────────

export function defineModule<
  const Caps extends readonly CapabilityName[],
  const Deps extends readonly string[],
  const API extends Record<string, AnyFunction>,
  const Events extends readonly string[]
>(config: ModuleConfig<Caps, Deps, API, Events>): ModuleDefinition<API> {
  return {
    name: '',
    capabilities: config.capabilities,
    depends: config.depends,
    emits: config.emits,
    paths: config.paths,
    factory: config.provides as (deps: unknown, caps: unknown) => API,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// defineCapability
// ─────────────────────────────────────────────────────────────────────────────

export interface CapabilityDefinition<Raw, Adapted> {
  factory: (raw: Raw) => Adapted
}

/**
 * Defines a capability adapter for a module.
 * The factory transforms raw Foundation capabilities into module-specific APIs.
 *
 * @example
 * ```typescript
 * // modules/personas/json-file.ts
 * export default defineCapability((fs) => ({
 *   loadPersona: (id: string) => fs.read(`personas/${id}.json`),
 *   savePersona: (id: string, data: any) => fs.write(`personas/${id}.json`, data),
 * }))
 * ```
 */
export function defineCapability<Raw, Adapted>(
  factory: (raw: Raw) => Adapted
): CapabilityDefinition<Raw, Adapted> {
  return { factory }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleRegistry {
  register(name: string, definition: ModuleDefinition): void
  get(name: string): ModuleDefinition | undefined
  names(): string[]
  has(name: string): boolean
}

export function createRegistry(): ModuleRegistry {
  const modules = new Map<string, ModuleDefinition>()
  return {
    register(name, def) {
      if (modules.has(name)) throw new Error(`Module "${name}" already registered`)
      modules.set(name, { ...def, name })
    },
    get: (name) => modules.get(name),
    names: () => [...modules.keys()],
    has: (name) => modules.has(name),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class CircularDependencyError extends Error {
  constructor(public cycle: string[]) {
    super(`Circular dependency: ${cycle.join(' -> ')}`)
  }
}

export class MissingDependencyError extends Error {
  constructor(
    public module: string,
    public missing: string
  ) {
    super(`Module "${module}" depends on unknown "${missing}"`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver (Kahn's Algorithm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves module dependencies using Kahn's algorithm for topological sort.
 * Returns initialization order where dependencies come before dependents.
 * Throws CircularDependencyError if a cycle is detected.
 * Throws MissingDependencyError if a dependency is not registered.
 */
export function resolveDependencies(registry: ModuleRegistry): string[] {
  const names = registry.names()

  // Validate all dependencies exist
  for (const name of names) {
    const def = registry.get(name)!
    for (const dep of def.depends) {
      if (!registry.has(dep)) {
        throw new MissingDependencyError(name, dep)
      }
    }
  }

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const name of names) {
    inDegree.set(name, 0)
    dependents.set(name, [])
  }

  for (const name of names) {
    const def = registry.get(name)!
    inDegree.set(name, def.depends.length)
    for (const dep of def.depends) {
      dependents.get(dep)!.push(name)
    }
  }

  // Kahn's algorithm: start with nodes that have no dependencies
  const queue: string[] = []
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name)
  }

  const sorted: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)

    for (const dependent of dependents.get(current)!) {
      const newDegree = inDegree.get(dependent)! - 1
      inDegree.set(dependent, newDegree)
      if (newDegree === 0) {
        queue.push(dependent)
      }
    }
  }

  // If not all nodes processed, there's a cycle
  if (sorted.length !== names.length) {
    // Find a cycle for error reporting
    const cycle = findCycle(registry)
    throw new CircularDependencyError(cycle)
  }

  return sorted
}

/**
 * Finds a cycle in the dependency graph using DFS.
 * Called only when Kahn's algorithm detects a cycle exists.
 */
function findCycle(registry: ModuleRegistry): string[] {
  const names = registry.names()
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const path: string[] = []

  const dfs = (name: string): string[] | null => {
    if (visited.has(name)) return null
    if (visiting.has(name)) {
      // Found cycle - extract it from path
      const cycleStart = path.indexOf(name)
      return [...path.slice(cycleStart), name]
    }

    visiting.add(name)
    path.push(name)

    const def = registry.get(name)!
    for (const dep of def.depends) {
      const cycle = dfs(dep)
      if (cycle) return cycle
    }

    path.pop()
    visiting.delete(name)
    visited.add(name)
    return null
  }

  for (const name of names) {
    const cycle = dfs(name)
    if (cycle) return cycle
  }

  // Should never reach here if called after Kahn's detected a cycle
  return []
}
