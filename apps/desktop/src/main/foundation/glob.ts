/**
 * Glob Pattern Matching
 *
 * Generic pattern matching with * wildcard support.
 */

/**
 * Tests if a value matches a glob pattern (supports * wildcard).
 */
export function matchesGlob(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$')
  return regex.test(value)
}

export interface Glob {
  matches: (value: string, pattern: string) => boolean
}

export const createGlob = (): Glob => ({
  matches: matchesGlob,
})
