import { push } from '../router.js'

const models = [
  { provider: "Anthropic", providerId: "anthropic", models: [
    { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
    { id: "claude-opus-4", name: "Claude Opus 4" },
  ]},
  { provider: "OpenAI", providerId: "openai", models: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "o3", name: "o3" },
  ]},
  { provider: "Google", providerId: "google", models: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ]},
]

export const pushModels = () => push('models', models)
