/**
 * usePersonas Hook
 *
 * Manages persona state with event subscriptions.
 * Provides a stable reference to the current personas list.
 */

import { useState, useEffect, useCallback } from 'react'

export function usePersonas() {
  const [personas, setPersonas] = useState([])

  useEffect(() => {
    let mounted = true

    const fetchPersonas = () => {
      window.arc.personas.list().then((data) => {
        if (mounted) setPersonas(data)
      })
    }

    fetchPersonas()

    // Handle user persona CRUD events incrementally
    const unsubCreated = window.arc.personas.onCreated((persona) => {
      if (!mounted) return
      setPersonas((prev) => [...prev, persona])
    })
    const unsubUpdated = window.arc.personas.onUpdated((persona) => {
      if (!mounted) return
      setPersonas((prev) => prev.map((p) => (p.name === persona.name ? persona : p)))
    })
    const unsubDeleted = window.arc.personas.onDeleted((name) => {
      if (!mounted) return
      setPersonas((prev) => prev.filter((p) => p.name !== name))
    })

    // Re-fetch when profile changes (profile personas may have changed)
    const unsubInstalled = window.arc.profiles.onInstalled(fetchPersonas)
    const unsubUninstalled = window.arc.profiles.onUninstalled(fetchPersonas)
    const unsubActivated = window.arc.settings.onActivated(fetchPersonas)

    return () => {
      mounted = false
      unsubCreated()
      unsubUpdated()
      unsubDeleted()
      unsubInstalled()
      unsubUninstalled()
      unsubActivated()
    }
  }, [])

  const findPersona = useCallback(
    (personaId) => personas.find((p) => p.name === personaId),
    [personas],
  )

  return { personas, findPersona }
}
