import { useCallback } from 'react'
import { useProfileReactive } from './use-profile-reactive'

/**
 * Fetch refine model from layered settings, re-fetch on profile changes.
 */
export function useRefineModel() {
  const fetcher = useCallback(
    () => window.arc.settings.getAssignments().then((a) => a?.refine?.model),
    [],
  )
  return { refineModel: useProfileReactive(fetcher) }
}
