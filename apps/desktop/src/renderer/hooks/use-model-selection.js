import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'arc:selectedModelId'

/**
 * Manage model selection for a chat
 *
 * Initialization priority:
 * 1. Last message's model (if available)
 * 2. localStorage saved preference
 * 3. First available model
 */
export function useModelSelection(
  models,
  lastMessage,
) {
  const [selectedModel, setSelectedModelState] = useState(null)

  // Initialize model on mount or when models/lastMessage change
  useEffect(() => {
    if (models.length === 0) return

    // Try to use last message's model
    if (lastMessage?.model) {
      const model = models.find((m) => m.id === lastMessage.model)
      if (model) {
        setSelectedModelState(model)
        return
      }
    }

    // Fallback to localStorage preference
    const savedId = localStorage.getItem(STORAGE_KEY)
    const savedModel = savedId ? models.find((m) => m.id === savedId) : null
    if (savedModel) {
      setSelectedModelState(savedModel)
      return
    }

    // Fallback to first model
    setSelectedModelState(models[0])
  }, [models, lastMessage?.model])

  // Wrap setter to persist selection
  const setSelectedModel = useCallback((model) => {
    setSelectedModelState(model)
    if (model) {
      localStorage.setItem(STORAGE_KEY, model.id)
    }
  }, [])

  return { selectedModel, setSelectedModel }
}
