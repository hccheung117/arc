/**
 * Kernel Boot
 *
 * Orchestrates module discovery, dependency resolution, instantiation, and IPC setup.
 * Entry point for the micro-kernel architecture.
 */

import type { IpcMain } from 'electron'
import type { FoundationCapabilities, CapabilityDefinition } from './module'
import { createRegistry, resolveDependencies } from './module'
import { instantiateModule, registerAdapter } from './injector'
import { registerModuleIPC, createModuleEmitter } from './ipc'
import { discoverModules } from './discovery'
import { validateAll } from './governance'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface KernelConfig {
  ipcMain: IpcMain
  dataDir: string
  foundation: FoundationCapabilities
}

export interface Kernel {
  /** Discover modules, resolve dependencies, instantiate in order, register IPC */
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
    boot() {
      // Discover all modules and adapters
      const discovered = discoverModules()

      // Validate governance rules before proceeding
      validateAll(discovered)

      // Register discovered modules
      for (const { name, definition, adapters } of discovered) {
        registry.register(name, definition)

        for (const [capName, adapter] of Object.entries(adapters)) {
          registerAdapter(adapterRegistry, name, capName, adapter)
        }
      }

      // Resolve dependency order
      const order = resolveDependencies(registry)

      // Instantiate modules in dependency order
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

        // Instantiate module with foundation, adapters, and scoped emitter
        const emitter = createModuleEmitter(name, definition.emits)
        const instance = instantiateModule(
          definition,
          {
            dataDir: config.dataDir,
            foundation: config.foundation,
            adapters: adapterRegistry,
          },
          deps,
          emitter
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
