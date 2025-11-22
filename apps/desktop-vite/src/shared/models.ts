export interface Provider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'google' | 'mistral'
}

export interface Model {
  id: string
  name: string
  provider: Provider
}
