export interface Provider {
  id: string
  name: string
  type: 'openai'
}

export interface Model {
  id: string
  name: string
  provider: Provider
}
