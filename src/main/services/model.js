import { readJson } from '../arcfs.js'

export const listModels = async (cacheFile) => {
  return await readJson(cacheFile) ?? []
}
