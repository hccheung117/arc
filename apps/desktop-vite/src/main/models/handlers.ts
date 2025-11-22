import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { models, providers } from '../db/schema'
import type { Model } from '../../shared/models'

export async function getModels(): Promise<Model[]> {
  const result = await db
    .select({
      id: models.id,
      name: models.name,
      providerId: providers.id,
      providerName: providers.name,
      providerType: providers.type,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.active, 1))

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    provider: {
      id: row.providerId,
      name: row.providerName,
      type: row.providerType as 'openai' | 'anthropic' | 'google' | 'mistral',
    },
  }))
}
