import type { Provider, Model } from '@arc/contracts/src/models'

export const providers: Provider[] = [
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic' },
  { id: 'openai', name: 'OpenAI', type: 'openai' },
  { id: 'google', name: 'Google', type: 'google' },
  { id: 'mistral', name: 'Mistral', type: 'mistral' },
]

export const models: Model[] = [
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: providers[0],
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: providers[0],
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: providers[0],
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: providers[0],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: providers[1],
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: providers[1],
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: providers[1],
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: providers[1],
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: providers[2],
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: providers[2],
  },
  {
    id: 'gemini-1.0-pro',
    name: 'Gemini 1.0 Pro',
    provider: providers[2],
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: providers[3],
  },
  {
    id: 'mistral-medium',
    name: 'Mistral Medium',
    provider: providers[3],
  },
  {
    id: 'mistral-small',
    name: 'Mistral Small',
    provider: providers[3],
  },
]
