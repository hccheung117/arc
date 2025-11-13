import { db } from './client'
import { providers, models } from './schema'

export async function seedModels() {
  const existingProviders = await db.select().from(providers).limit(1)

  if (existingProviders.length > 0) {
    return
  }

  db.transaction((tx) => {
    tx.insert(providers).values([
      { id: 'anthropic', name: 'Anthropic', type: 'anthropic' },
      { id: 'openai', name: 'OpenAI', type: 'openai' },
      { id: 'google', name: 'Google', type: 'google' },
      { id: 'mistral', name: 'Mistral', type: 'mistral' },
    ])

    tx.insert(models).values([
      {
        id: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        providerId: 'anthropic',
      },
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        providerId: 'anthropic',
      },
      {
        id: 'claude-3-5-haiku',
        name: 'Claude 3.5 Haiku',
        providerId: 'anthropic',
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        providerId: 'anthropic',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        providerId: 'openai',
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        providerId: 'openai',
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        providerId: 'openai',
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        providerId: 'openai',
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        providerId: 'google',
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        providerId: 'google',
      },
      {
        id: 'gemini-1.0-pro',
        name: 'Gemini 1.0 Pro',
        providerId: 'google',
      },
      {
        id: 'mistral-large',
        name: 'Mistral Large',
        providerId: 'mistral',
      },
      {
        id: 'mistral-medium',
        name: 'Mistral Medium',
        providerId: 'mistral',
      },
      {
        id: 'mistral-small',
        name: 'Mistral Small',
        providerId: 'mistral',
      },
    ])
  })
}
