import { useState, useEffect, useCallback } from 'react'
import { useProfileReactive } from './use-profile-reactive'

export function usePersonas() {
  const fetcher = useCallback(() => window.arc.personas.list(), [])
  const profilePersonas = useProfileReactive(fetcher)

  const [personas, setPersonas] = useState([])

  // Sync from profile-reactive fetches
  useEffect(() => {
    if (profilePersonas) setPersonas(profilePersonas)
  }, [profilePersonas])

  // Handle incremental CRUD events
  useEffect(() => {
    const unsubCreated = window.arc.personas.onCreated((persona) => {
      setPersonas((prev) => [...prev, persona])
    })
    const unsubUpdated = window.arc.personas.onUpdated((persona) => {
      setPersonas((prev) => prev.map((p) => (p.name === persona.name ? persona : p)))
    })
    const unsubDeleted = window.arc.personas.onDeleted((name) => {
      setPersonas((prev) => prev.filter((p) => p.name !== name))
    })
    return () => {
      unsubCreated()
      unsubUpdated()
      unsubDeleted()
    }
  }, [])

  const findPersona = useCallback(
    (personaId) => personas.find((p) => p.name === personaId),
    [personas],
  )

  return { personas, findPersona }
}
