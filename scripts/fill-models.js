import { withApp } from '@cli/bootstrap.js'
import { resolve, writeJson } from '@main/arcfs.js'

const models = [
  { provider: "Anthropic", providerId: "anthropic", models: [
    { id: "claude-opus-4", name: "Claude Opus 4" },
    { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
    { id: "claude-haiku-3.5", name: "Claude Haiku 3.5" },
  ]},
  { provider: "OpenAI", providerId: "openai", models: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "o3", name: "o3" },
    { id: "o3-mini", name: "o3 Mini" },
  ]},
  { provider: "Google", providerId: "google", models: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  ]},
]

withApp(async () => {
  const filePath = resolve('cache', 'models.json')
  await writeJson(filePath, models)
  const total = models.reduce((n, g) => n + g.models.length, 0)
  console.log(`Wrote ${total} models (${models.length} providers) to ${filePath}`)
})
