// ─────────────────────────────────────────────────────────────────────────────
// defineModule
// ─────────────────────────────────────────────────────────────────────────────

export function defineModule(config) {
  return {
    name: '',
    capabilities: config.capabilities,
    depends: config.depends,
    emits: config.emits,
    paths: config.paths,
    factory: config.provides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// defineCapability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Defines a capability adapter for a module.
 * The factory transforms raw Foundation capabilities into module-specific APIs.
 *
 * @example
 * ```javascript
 * // modules/personas/json-file.js
 * export default defineCapability((fs) => ({
 *   loadPersona: (id) => fs.read(`personas/${id}.json`),
 *   savePersona: (id, data) => fs.write(`personas/${id}.json`, data),
 * }))
 * ```
 */
export function defineCapability(factory) {
  return { factory }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export function createRegistry() {
  const modules = new Map()
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
  constructor(cycle) {
    super(`Circular dependency: ${cycle.join(' -> ')}`)
    this.cycle = cycle
  }
}

export class MissingDependencyError extends Error {
  constructor(module, missing) {
    super(`Module "${module}" depends on unknown "${missing}"`)
    this.module = module
    this.missing = missing
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
export function resolveDependencies(registry) {
  const names = registry.names()

  // Validate all dependencies exist
  for (const name of names) {
    const def = registry.get(name)
    for (const dep of def.depends) {
      if (!registry.has(dep)) {
        throw new MissingDependencyError(name, dep)
      }
    }
  }

  // Build in-degree map and adjacency list
  const inDegree = new Map()
  const dependents = new Map()

  for (const name of names) {
    inDegree.set(name, 0)
    dependents.set(name, [])
  }

  for (const name of names) {
    const def = registry.get(name)
    inDegree.set(name, def.depends.length)
    for (const dep of def.depends) {
      dependents.get(dep).push(name)
    }
  }

  // Kahn's algorithm: start with nodes that have no dependencies
  const queue = []
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name)
  }

  const sorted = []

  while (queue.length > 0) {
    const current = queue.shift()
    sorted.push(current)

    for (const dependent of dependents.get(current)) {
      const newDegree = inDegree.get(dependent) - 1
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
function findCycle(registry) {
  const names = registry.names()
  const visiting = new Set()
  const visited = new Set()
  const path = []

  const dfs = (name) => {
    if (visited.has(name)) return null
    if (visiting.has(name)) {
      // Found cycle - extract it from path
      const cycleStart = path.indexOf(name)
      return [...path.slice(cycleStart), name]
    }

    visiting.add(name)
    path.push(name)

    const def = registry.get(name)
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
