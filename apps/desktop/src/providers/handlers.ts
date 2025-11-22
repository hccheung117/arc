import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { providers } from '@/db/schema'
import { encryptSecret, decryptSecret } from '@/security'

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
