/**
 * usePersonas Hook
 *
 * Manages persona state with event subscriptions.
 * Provides a stable reference to the current personas list.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Persona } from '@contracts/personas'

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([])

  useEffect(() => {
    let mounted = true

    const fetchPersonas = () => {
      window.arc.personas.list().then((data) => {
        if (mounted) setPersonas(data)
      })
    }

    fetchPersonas()

    // Handle user persona CRUD events incrementally
    const unsubPersonas = window.arc.personas.onEvent((event) => {
      if (!mounted) return
      if (event.type === 'created') {
        setPersonas((prev) => [...prev, event.persona])
      } else if (event.type === 'updated') {
        setPersonas((prev) => prev.map((p) => (p.name === event.persona.name ? event.persona : p)))
      } else if (event.type === 'deleted') {
        setPersonas((prev) => prev.filter((p) => p.name !== event.name))
      }
    })

    // Re-fetch when profile changes (profile personas may have changed)
    const unsubProfiles = window.arc.profiles.onEvent(fetchPersonas)

    return () => {
      mounted = false
      unsubPersonas()
      unsubProfiles()
    }
  }, [])

  const findPersona = useCallback(
    (personaId: string) => personas.find((p) => p.name === personaId),
    [personas],
  )

  return { personas, findPersona }
}
