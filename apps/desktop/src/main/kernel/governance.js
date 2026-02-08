/**
 * Module Governance
 *
 * Validates architectural integrity at startup. Enforces bidirectional matching
 * between declared capabilities and physical adapter files.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class GovernanceError extends Error {
  constructor(violations) {
    super(`Governance violations:\n${violations.map((v) => `  • ${v}`).join('\n')}`)
    this.violations = violations
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a single module's capability-file integrity.
 * Returns array of violation messages (empty if valid).
 *
 * Checks:
 * 1. Every declared capability has an adapter file
 * 2. Every adapter file is declared in capabilities
 */
export function validateModule(module) {
  const violations = []
  const declared = new Set(module.definition.capabilities)
  const physical = new Set(Object.keys(module.adapters))

  // Check: declared capabilities must have adapter files
  for (const cap of declared) {
    if (!physical.has(cap)) {
      violations.push(`[${module.name}] Missing adapter: declared '${cap}' but no ${camelToKebab(cap)}.js`)
    }
  }

  // Check: adapter files must be declared in capabilities
  for (const cap of physical) {
    if (!declared.has(cap)) {
      violations.push(`[${module.name}] Orphan adapter: ${camelToKebab(cap)}.js exists but '${cap}' not declared`)
    }
  }

  return violations
}

/**
 * Validates all discovered modules. Throws GovernanceError if any violations.
 * Called during kernel boot before module registration.
 */
export function validateAll(modules) {
  const allViolations = modules.flatMap(validateModule)

  if (allViolations.length > 0) {
    throw new GovernanceError(allViolations)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts camelCase to kebab-case: 'jsonFile' → 'json-file'
 */
function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
