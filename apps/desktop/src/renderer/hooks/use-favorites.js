import { useState, useEffect } from 'react'

// Composite key for efficient Set lookups
export function favoriteKey(providerId, modelId) {
  return `${providerId}:${modelId}`
}

/**
 * Model favorites management
 *
 * Loads favorites from settings, validates against available models,
 * toggles favorites and persists changes.
 */
export function useFavorites(models) {
  const [favorites, setFavorites] = useState(new Set())
  const [showFavorites, setShowFavorites] = useState(false)

  useEffect(() => {
    window.arc.settings.getFavorites().then((saved) => {
      if (saved && saved.length > 0) {
        const validFavorites = saved.filter(
          (f) =>
            f &&
            typeof f === 'object' &&
            f.provider &&
            f.model &&
            f.provider !== 'undefined' &&
            f.model !== 'undefined'
        )
        if (validFavorites.length > 0) {
          const keys = validFavorites.map((f) => favoriteKey(f.provider, f.model))
          setFavorites(new Set(keys))

          // Only show favorites tab if at least one favorite matches available models
          const hasMatchingFavorites = models.some((m) =>
            keys.includes(favoriteKey(m.provider.id, m.id))
          )
          if (hasMatchingFavorites) {
            setShowFavorites(true)
          }
        }
        if (validFavorites.length !== saved.length) {
          window.arc.settings.setFavorites({ favorites: validFavorites })
        }
      }
    })
  }, [models])

  const toggleFavorite = (model) => {
    const key = favoriteKey(model.provider.id, model.id)
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      // Convert Set back to array of objects for storage
      // Split only on the first colon to preserve colons in model (e.g., "claude-haiku-4-5:thinking")
      const favoritesArray = Array.from(next).map((k) => {
        const colonIndex = k.indexOf(':')
        const provider = k.slice(0, colonIndex)
        const model = k.slice(colonIndex + 1)
        return { provider, model }
      })
      window.arc.settings.setFavorites({ favorites: favoritesArray })
      return next
    })
  }

  return { favorites, toggleFavorite, showFavorites, setShowFavorites }
}
