import { resolve } from '../arcfs.js'
import { register } from '../router.js'
import { defineChannel } from '../channel.js'
import { listModels, fetchModelsFromProviders } from '../services/model.js'
import { listProvidersSensitively } from '../services/provider.js'

const cacheFile = resolve('cache', 'models.json')

export const models = defineChannel('model:feed', () => listModels(cacheFile))

export const refreshModels = models.mutate(async () => {
  const providers = await listProvidersSensitively()
  await fetchModelsFromProviders(providers, cacheFile)
})

register('model:refresh', refreshModels)
