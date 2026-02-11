/**
 * Resolve provider config for a refine model.
 *
 * Gathers model list, active profile, and provider config in parallel
 * to produce the credentials needed to start a refine stream.
 */
export async function resolveRefineConfig(modelId) {
  const [modelsList, profileId] = await Promise.all([
    window.arc.profiles.listModels(),
    window.arc.settings.getActiveProfileId(),
  ])
  const model = modelsList.find((m) => m.id === modelId)
  if (!model) throw new Error(`Model ${modelId} not found`)
  if (!profileId) throw new Error('No active profile')

  const providerConfig = await window.arc.profiles.getProviderConfig({
    profileId,
    providerId: model.provider.id,
  })

  return {
    baseURL: providerConfig.baseUrl ?? undefined,
    apiKey: providerConfig.apiKey ?? undefined,
  }
}
