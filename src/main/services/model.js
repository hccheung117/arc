import picomatch from 'picomatch'
import { readJson, writeJson } from '../arcfs.js'

export const listModels = async (cacheFile) => {
  return await readJson(cacheFile) ?? {}
}

const fetchAnthropic = async ({ baseUrl, apiKey }) => {
  const res = await fetch(`${baseUrl}/v1/models?limit=1000`, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const { data } = await res.json()
  return data.map(m => ({ id: m.id, name: m.display_name }))
}

const fetchOpenAI = async ({ baseUrl, apiKey }) => {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const { data } = await res.json()
  return data.map(m => ({ id: m.id, name: m.id }))
}

const fetchers = { anthropic: fetchAnthropic, openai: fetchOpenAI }

const filterModels = (models, pipeline) =>
  pipeline.reduce((acc, step) => {
    if (step.keep) {
      const match = picomatch(step.keep)
      return acc.filter(m => match(m.id))
    }
    if (step.drop) {
      const match = picomatch(step.drop)
      return acc.filter(m => !match(m.id))
    }
    return acc
  }, models)

export const fetchModelsFromProviders = async (providers, cacheFile) => {
  const stale = await listModels(cacheFile)

  const entries = Object.entries(providers)
  const results = await Promise.allSettled(
    entries.map(async ([id, p]) => {
      const fetcher = fetchers[p.type]
      try {
        if (!fetcher) throw new Error(`Unknown type: ${p.type}`)
        const models = await fetcher(p)
        const filtered = p.models ? filterModels(models, p.models) : models
        return [id, { name: p.name, models: filtered }]
      } catch (err) {
        if (fetcher === fetchOpenAI) throw err
        // Proxies may not follow the provider's model-listing API
        // but most support OpenAI-compatible /v1/models
        const raw = await fetchOpenAI(p)
        const models = p.models ? filterModels(raw, p.models) : raw
        return [id, { name: p.name, models, warning: `${err.message}; used OpenAI-compatible fallback` }]
      }
    })
  )

  const merged = Object.fromEntries(results.map((result, i) => {
    const [id, p] = entries[i]
    if (result.status === 'fulfilled') return result.value
    const error = result.reason?.message ?? String(result.reason)
    const cached = stale[id]
    if (cached) return [id, { ...cached, stale: true, error }]
    return [id, { name: p.name, models: [], stale: true, error }]
  }))

  await writeJson(cacheFile, merged)
  return merged
}
