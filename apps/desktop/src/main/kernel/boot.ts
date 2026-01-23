/**
 * Kernel Boot
 *
 * Orchestrates module registration, dependency resolution, instantiation, and IPC setup.
 * Entry point for the micro-kernel architecture.
 */

import type { IpcMain } from 'electron'
import type {
  FoundationCapabilities,
  ModuleDefinition,
  CapabilityDefinition,
} from './module'
import { createRegistry, resolveDependencies } from './module'
import { instantiateModule, registerAdapter } from './injector'
import { registerModuleIPC } from './ipc'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface KernelConfig {
  ipcMain: IpcMain
  dataDir: string
  foundation: FoundationCapabilities
}

export interface Kernel {
  /** Register a module definition with optional capability adapters */
  register(
    name: string,
    definition: ModuleDefinition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapters?: Record<string, CapabilityDefinition<any, any>>
  ): void

  /** Resolve dependencies, instantiate modules in order, register IPC */
  boot(): void

  /** Get instantiated module API by name */
  getModule<T>(name: string): T | undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Kernel Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createKernel(config: KernelConfig): Kernel {
  const registry = createRegistry()
  const adapterRegistry = new Map<string, Map<string, CapabilityDefinition<unknown, unknown>>>()
  const instances = new Map<string, unknown>()

  return {
    register(name, definition, adapters) {
      registry.register(name, definition)

      if (adapters) {
        for (const [capName, adapter] of Object.entries(adapters)) {
          registerAdapter(adapterRegistry, name, capName, adapter)
        }
      }
    },

    boot() {
      const order = resolveDependencies(registry)

      for (const name of order) {
        const definition = registry.get(name)!

        // Build deps object from already-instantiated modules
        const deps: Record<string, unknown> = {}
        for (const depName of definition.depends) {
          const depInstance = instances.get(depName)
          if (!depInstance) {
            throw new Error(`Dependency "${depName}" not instantiated for module "${name}"`)
          }
          deps[depName] = depInstance
        }

        // Instantiate module with foundation and adapters
        const instance = instantiateModule(
          definition,
          {
            dataDir: config.dataDir,
            foundation: config.foundation,
            adapters: adapterRegistry,
          },
          deps
        )

        // Register IPC handlers for module API
        registerModuleIPC(config.ipcMain, name, instance.api as Record<string, (...args: unknown[]) => unknown>)

        // Store instance for subsequent modules' dependencies
        instances.set(name, instance.api)
      }
    },

    getModule<T>(name: string): T | undefined {
      return instances.get(name) as T | undefined
    },
  }
}
