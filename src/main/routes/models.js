import { resolve } from '../arcfs.js'
import { push } from '../router.js'
import { listModels } from '../services/model.js'

const cacheFile = resolve('cache', 'models.json')

export const pushModels = async () => {
  const models = await listModels(cacheFile)
  push('model:listen', models)
}
