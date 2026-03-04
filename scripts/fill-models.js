import { withApp } from '@cli/bootstrap.js'
import { resolve } from '@main/arcfs.js'
import { listProvidersSensitively } from '@main/services/provider.js'
import { fetchModelsFromProviders } from '@main/services/model.js'

withApp(async () => {
  const providers = await listProvidersSensitively()
  console.log('Providers:', Object.keys(providers).join(', ') || '(none)')

  const cacheFile = resolve('cache', 'models.json')
  const models = await fetchModelsFromProviders(providers, cacheFile)

  for (const [id, g] of Object.entries(models)) {
    const tag = g.stale ? ' (stale)' : ''
    console.log(`${g.name}${tag}: ${g.models.length} models`)
    if (g.warning) console.log(`  warning: ${g.warning}`)
    if (g.error) console.log(`  error: ${g.error}`)
  }
  const total = Object.values(models).reduce((n, g) => n + g.models.length, 0)
  console.log(`Wrote ${total} models to ${cacheFile}`)
})
