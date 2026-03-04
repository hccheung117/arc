import { resolve } from '../arcfs.js'
import { register, push } from '../router.js'
import { listModels, fetchModelsFromProviders } from '../services/model.js'
import { listProvidersSensitively } from '../services/provider.js'

const cacheFile = resolve('cache', 'models.json')

export const pushModels = async () => {
  push('model:listen', await listModels(cacheFile))
}

export const refreshModels = async () => {
  const providers = await listProvidersSensitively()
  const models = await fetchModelsFromProviders(providers, cacheFile)
  push('model:listen', models)
}

register('model:refresh', refreshModels)
