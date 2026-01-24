/**
 * Module Injector
 *
 * Wires modules by detecting capability adapter files and injecting
 * adapted capabilities. Manual registration for now; full discovery in P5.
 */

import type { ModuleDefinition, CapabilityDefinition, FoundationCapabilities, PathScopedFactory } from './module'

// ─────────────────────────────────────────────────────────────────────────────
// Capability Mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps capability names (camelCase, used in module declarations) to
 * Foundation capability keys (camelCase, from FoundationCapabilities).
 */
const CAPABILITY_TO_FOUNDATION: Record<string, keyof FoundationCapabilities> = {
  jsonFile: 'jsonFile',
  jsonLog: 'jsonLog',
  binaryFile: 'binaryFile',
  archive: 'archive',
  glob: 'glob',
  markdownFile: 'markdownFile',
  logger: 'logger',
}

/** Capabilities that require path scoping (factories, not instances). */
const PATH_SCOPED: Set<string> = new Set(['jsonFile', 'jsonLog', 'binaryFile', 'archive', 'glob', 'markdownFile'])

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleInstance<API = unknown> {
  name: string
  api: API
}

export interface InjectorConfig {
  dataDir: string
  foundation: FoundationCapabilities
  adapters: Map<string, Map<string, CapabilityDefinition<unknown, unknown>>>
  // adapters structure: moduleName -> capabilityName -> CapabilityDefinition
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a module instance by injecting adapted capabilities.
 *
 * For each capability in the module's declaration:
 * 1. Look up the raw Foundation capability
 * 2. Check if the module has an adapter for this capability
 * 3. If adapter exists, transform the raw capability via the adapter factory
 * 4. If no adapter, pass the raw Foundation capability directly
 * 5. Build caps object and call the module factory
 *
 * @param definition - Module definition from defineModule()
 * @param config - Injector configuration with Foundation capabilities and adapters
 * @param deps - Resolved module dependencies (proxied APIs from other modules)
 * @returns Module instance with name and API
 *
 * @throws Error if a declared capability is unknown (not in CAPABILITY_TO_FOUNDATION)
 */
export function instantiateModule(
  definition: ModuleDefinition,
  config: InjectorConfig,
  deps: Record<string, unknown>,
  emit: (event: string, data: unknown) => void
): ModuleInstance {
  const moduleAdapters = config.adapters.get(definition.name)

  const caps: Record<string, unknown> = {}

  for (const capName of definition.capabilities) {
    const foundationKey = CAPABILITY_TO_FOUNDATION[capName]
    if (!foundationKey) {
      throw new Error(`Unknown capability "${capName}" in module "${definition.name}"`)
    }

    // Path-scoped capabilities are factories; call with module's paths to get scoped instance
    let rawCap: unknown
    if (PATH_SCOPED.has(capName)) {
      const factory = config.foundation[foundationKey] as PathScopedFactory<unknown>
      rawCap = factory(config.dataDir, definition.paths)
    } else {
      rawCap = config.foundation[foundationKey]
    }

    const adapter = moduleAdapters?.get(capName)
    caps[capName] = adapter ? adapter.factory(rawCap) : rawCap
  }

  const api = definition.factory(deps, caps, emit)

  return { name: definition.name, api }
}

/**
 * Registers a capability adapter for a module.
 * Called during module registration before instantiation.
 *
 * @param adapters - Adapter registry (shared mutable state)
 * @param moduleName - Name of the module owning this adapter
 * @param capabilityName - Name of the capability being adapted (e.g., 'jsonFile')
 * @param adapter - Capability definition from defineCapability()
 */
export function registerAdapter(
  adapters: Map<string, Map<string, CapabilityDefinition<unknown, unknown>>>,
  moduleName: string,
  capabilityName: string,
  adapter: CapabilityDefinition<unknown, unknown>
): void {
  if (!adapters.has(moduleName)) {
    adapters.set(moduleName, new Map())
  }
  adapters.get(moduleName)!.set(capabilityName, adapter)
}
