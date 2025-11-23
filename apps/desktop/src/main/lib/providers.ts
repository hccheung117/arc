import { eq } from 'drizzle-orm'
import { db } from '@main/db/client'
import { providers } from '@main/db/schema'
import { encryptSecret, decryptSecret } from '@main/lib/security'

export async function updateProviderConfig(
  providerId: string,
  config: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  await db
    .update(providers)
    .set({
      ...(config.apiKey !== undefined && { apiKey: encryptSecret(config.apiKey) }),
      ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
    })
    .where(eq(providers.id, providerId))
    .run()
}

export async function getProviderConfig(providerId: string): Promise<{
  apiKey: string | null
  baseUrl: string | null
}> {
  const result = await db
    .select({
      apiKey: providers.apiKey,
      baseUrl: providers.baseUrl,
    })
    .from(providers)
    .where(eq(providers.id, providerId))
    .get()

  if (!result) {
    throw new Error(`Provider ${providerId} not found`)
  }

  return {
    ...result,
    apiKey: result.apiKey ? decryptSecret(result.apiKey) : null,
  }
}

/**
 * Generic config get handler.
 * Routes key patterns to appropriate config sources.
 * Currently supports: "provider:{providerId}"
 */
export async function getConfig<T = unknown>(key: string): Promise<T | null> {
  if (key.startsWith('provider:')) {
    const providerId = key.slice('provider:'.length)
    const config = await getProviderConfig(providerId)
    return config as T
  }

  return null
}

/**
 * Generic config set handler.
 * Routes key patterns to appropriate config updaters.
 * Currently supports: "provider:{providerId}"
 */
export async function setConfig<T = unknown>(key: string, value: T): Promise<void> {
  if (key.startsWith('provider:')) {
    const providerId = key.slice('provider:'.length)
    const config = value as { apiKey?: string; baseUrl?: string }
    await updateProviderConfig(providerId, config)
  }
}
