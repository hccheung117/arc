/**
 * Module Discovery
 *
 * Auto-discovers modules and capability adapters at build time using Vite's import.meta.glob.
 * Replaces manual module registration in main.ts.
 */

import type { ModuleDefinition, CapabilityDefinition } from './module'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleFile {
  default: ModuleDefinition
}

interface AdapterFile {
  default: CapabilityDefinition<unknown, unknown>
}

export interface DiscoveredModule {
  name: string
  definition: ModuleDefinition
  adapters: Record<string, CapabilityDefinition<unknown, unknown>>
}

// ─────────────────────────────────────────────────────────────────────────────
// Build-time Discovery (Vite import.meta.glob)
// ─────────────────────────────────────────────────────────────────────────────

// Discover all module definitions: modules/*/mod.ts
const moduleFiles = import.meta.glob<ModuleFile>('../modules/*/mod.ts', { eager: true })

// Discover all potential adapter files: modules/*/*.ts (will filter out mod.ts, business.ts)
const allTsFiles = import.meta.glob<AdapterFile>('../modules/*/*.ts', { eager: true })

// ─────────────────────────────────────────────────────────────────────────────
// Path Parsing Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts module name from path: '../modules/{name}/mod.ts' → name
 */
function extractModuleName(filePath: string): string | null {
  const match = filePath.match(/\.\.\/modules\/([^/]+)\/mod\.ts$/)
  return match?.[1] ?? null
}

/**
 * Parses adapter file path: '../modules/{moduleName}/{filename}.ts'
 * Returns null for non-adapter files (mod.ts, business.ts)
 */
function parseAdapterPath(filePath: string): { moduleName: string; capabilityName: string } | null {
  const match = filePath.match(/\.\.\/modules\/([^/]+)\/([^/]+)\.ts$/)
  if (!match) return null

  const [, moduleName, filename] = match

  // Exclude non-adapter files
  if (filename === 'mod' || filename === 'business') return null

  // Convert kebab-case filename to camelCase capability name
  const capabilityName = kebabToCamel(filename)

  return { moduleName, capabilityName }
}

/**
 * Converts kebab-case to camelCase: 'json-file' → 'jsonFile'
 */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discovers all modules and their capability adapters.
 * Called by kernel.boot() to auto-register modules.
 */
export function discoverModules(): DiscoveredModule[] {
  // Build adapter map: moduleName → capabilityName → adapter
  const adaptersByModule = new Map<string, Record<string, CapabilityDefinition<unknown, unknown>>>()

  for (const [filePath, file] of Object.entries(allTsFiles)) {
    const parsed = parseAdapterPath(filePath)
    if (!parsed) continue

    const { moduleName, capabilityName } = parsed

    if (!file.default) {
      console.warn(`[discovery] Adapter "${filePath}" has no default export`)
      continue
    }

    if (!adaptersByModule.has(moduleName)) {
      adaptersByModule.set(moduleName, {})
    }
    adaptersByModule.get(moduleName)![capabilityName] = file.default
  }

  // Build discovered modules list
  const discovered: DiscoveredModule[] = []

  for (const [filePath, file] of Object.entries(moduleFiles)) {
    const name = extractModuleName(filePath)
    if (!name) {
      console.warn(`[discovery] Could not parse module name from path: ${filePath}`)
      continue
    }

    const definition = file.default
    if (!definition) {
      console.warn(`[discovery] Module "${name}" has no default export`)
      continue
    }

    discovered.push({
      name,
      definition,
      adapters: adaptersByModule.get(name) ?? {},
    })
  }

  return discovered
}
