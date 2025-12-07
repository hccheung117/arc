import { createHash } from 'crypto'
import type { ArcFileProvider } from '@arc-types/arc-file'

/**
 * Generates a stable provider ID from provider properties.
 * SHA-256 hash of type|apiKey|baseUrl ensures same config = same ID.
 */
export function generateProviderId(provider: ArcFileProvider): string {
  const input = `${provider.type}|${provider.apiKey ?? ''}|${provider.baseUrl ?? ''}`
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}
