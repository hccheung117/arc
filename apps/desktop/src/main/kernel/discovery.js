/**
 * Module Discovery
 *
 * Auto-discovers modules and capability adapters at build time using Vite's import.meta.glob.
 * Replaces manual module registration in main.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Build-time Discovery (Vite import.meta.glob)
// ─────────────────────────────────────────────────────────────────────────────

// Discover all module definitions: modules/*/mod.js
const moduleFiles = import.meta.glob('../modules/*/mod.js', { eager: true })

// Discover all potential adapter files: modules/*/*.js (will filter out mod.js, business.js)
const allJsFiles = import.meta.glob('../modules/*/*.js', { eager: true })

// ─────────────────────────────────────────────────────────────────────────────
// Path Parsing Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts module name from path: '../modules/{name}/mod.js' → name
 */
function extractModuleName(filePath) {
  const match = filePath.match(/\.\.\/modules\/([^/]+)\/mod\.js$/)
  return match?.[1] ?? null
}

/**
 * Parses adapter file path: '../modules/{moduleName}/{filename}.js'
 * Returns null for non-adapter files (mod.js, business.js)
 */
function parseAdapterPath(filePath) {
  const match = filePath.match(/\.\.\/modules\/([^/]+)\/([^/]+)\.js$/)
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
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discovers all modules and their capability adapters.
 * Called by kernel.boot() to auto-register modules.
 */
export function discoverModules() {
  // Build adapter map: moduleName → capabilityName → adapter
  const adaptersByModule = new Map()

  for (const [filePath, file] of Object.entries(allJsFiles)) {
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
    adaptersByModule.get(moduleName)[capabilityName] = file.default
  }

  // Build discovered modules list
  const discovered = []

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
