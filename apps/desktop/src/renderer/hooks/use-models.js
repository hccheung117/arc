import { useCallback } from 'react'
import { useProfileReactive } from './use-profile-reactive'

/**
 * Fetch models on mount, re-fetch on profile changes.
 */
export function useModels() {
  const fetcher = useCallback(() => window.arc.profiles.listModels(), [])
  const models = useProfileReactive(fetcher)
  return { models: models ?? [] }
}
