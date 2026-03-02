import { readJson, writeJson } from '../arcfs.js'

export const getState = async (file) => await readJson(file) ?? {}

export const setState = async (file, patch) => {
  const current = await getState(file)
  await writeJson(file, { ...current, ...patch })
}
