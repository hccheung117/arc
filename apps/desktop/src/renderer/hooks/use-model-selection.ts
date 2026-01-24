import { useState, useEffect, useCallback } from 'react'
import type { Model } from '@main/modules/profiles/business'
import type { Message } from '@renderer/lib/messages'

const STORAGE_KEY = 'arc:selectedModelId'

interface UseModelSelectionReturn {
  selectedModel: Model | null
  setSelectedModel: (model: Model | null) => void
}

/**
 * Manage model selection for a chat
 *
 * Initialization priority:
 * 1. Last message's model (if available)
 * 2. localStorage saved preference
 * 3. First available model
 */
export function useModelSelection(
  models: Model[],
  lastMessage: Message | undefined,
): UseModelSelectionReturn {
  const [selectedModel, setSelectedModelState] = useState<Model | null>(null)

  // Initialize model on mount or when models/lastMessage change
  useEffect(() => {
    if (models.length === 0) return

    // Try to use last message's model
    if (lastMessage?.modelId) {
      const model = models.find((m) => m.id === lastMessage.modelId)
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
  }, [models, lastMessage?.modelId])

  // Wrap setter to persist selection
  const setSelectedModel = useCallback((model: Model | null) => {
    setSelectedModelState(model)
    if (model) {
      localStorage.setItem(STORAGE_KEY, model.id)
    }
  }, [])

  return { selectedModel, setSelectedModel }
}
