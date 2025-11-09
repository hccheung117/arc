export type ModelTier = 'flagship' | 'fast' | 'efficient'

export interface Provider {
  id: string
  name: string
}

export interface Model {
  id: string
  name: string
  provider: Provider
  tier: ModelTier
  description: string
}

export const providers: Provider[] = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'google', name: 'Google' },
  { id: 'mistral', name: 'Mistral' },
]

export const models: Model[] = [
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: providers[0],
    tier: 'flagship',
    description: 'Most intelligent model with best performance',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: providers[0],
    tier: 'flagship',
    description: 'Previous flagship model',
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: providers[0],
    tier: 'fast',
    description: 'Fast and efficient responses',
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: providers[0],
    tier: 'efficient',
    description: 'Most cost-effective option',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: providers[1],
    tier: 'flagship',
    description: 'OpenAI flagship multimodal model',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: providers[1],
    tier: 'flagship',
    description: 'Enhanced GPT-4 with improved speed',
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: providers[1],
    tier: 'flagship',
    description: 'Original GPT-4 model',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: providers[1],
    tier: 'fast',
    description: 'Fast and cost-effective model',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: providers[2],
    tier: 'flagship',
    description: 'Advanced reasoning and long context',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: providers[2],
    tier: 'fast',
    description: 'Fast and versatile performance',
  },
  {
    id: 'gemini-1.0-pro',
    name: 'Gemini 1.0 Pro',
    provider: providers[2],
    tier: 'efficient',
    description: 'Efficient general purpose model',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: providers[3],
    tier: 'flagship',
    description: 'Top-tier reasoning capabilities',
  },
  {
    id: 'mistral-medium',
    name: 'Mistral Medium',
    provider: providers[3],
    tier: 'fast',
    description: 'Balanced performance and speed',
  },
  {
    id: 'mistral-small',
    name: 'Mistral Small',
    provider: providers[3],
    tier: 'efficient',
    description: 'Cost-effective for simple tasks',
  },
]
