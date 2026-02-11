import { useState, useRef, useEffect } from 'react'
import { startRefine, stopAIChat, onAIDelta, onAIComplete, onAIError } from '@renderer/lib/messages'
import { error as logError } from '@renderer/lib/logger'

async function resolveRefineConfig(modelId) {
  const [modelsList, profileId] = await Promise.all([
    window.arc.profiles.listModels(),
    window.arc.settings.getActiveProfileId(),
  ])
  const model = modelsList.find((m) => m.id === modelId)
  if (!model) throw new Error(`Model ${modelId} not found`)
  if (!profileId) throw new Error('No active profile')

  const providerConfig = await window.arc.profiles.getProviderConfig({
    profileId,
    providerId: model.provider.id,
  })

  return {
    baseURL: providerConfig.baseUrl ?? undefined,
    apiKey: providerConfig.apiKey ?? undefined,
  }
}

/**
 * Refine AI stream subsystem
 *
 * Manages refine state, starts refine stream via lib,
 * subscribes to events, buffers refined text, handles cancellation.
 */
export function useRefine({ refineModel, message, setMessage }) {
  const [refineState, setRefineState] = useState({ status: 'idle' })
  const refineBufferRef = useRef('')
  const isRefining = refineState.status === 'refining'

  const handleRefine = async () => {
    if (!refineModel || isRefining || !message.trim()) return

    const original = message

    try {
      const provider = await resolveRefineConfig(refineModel)
      const { streamId } = await startRefine(original, refineModel, provider)
      setRefineState({ status: 'refining', streamId, original })
    } catch (err) {
      logError('refine', 'Failed to start refine', err)
      setMessage(original)
      setRefineState({ status: 'idle' })
    }
  }

  const handleRefineCancel = () => {
    if (refineState.status !== 'refining') return

    stopAIChat(refineState.streamId)
    setMessage(refineState.original)
    setRefineState({ status: 'idle' })
  }

  // Refine stream subscription
  useEffect(() => {
    if (refineState.status !== 'refining') return

    refineBufferRef.current = ''
    const streamId = refineState.streamId

    const unsubDelta = onAIDelta((data) => {
      if (data.streamId !== streamId) return
      refineBufferRef.current += data.chunk
      setMessage(refineBufferRef.current)
    })

    const unsubComplete = onAIComplete((data) => {
      if (data.streamId !== streamId) return
      setRefineState({ status: 'idle' })
    })

    const unsubError = onAIError((data) => {
      if (data.streamId !== streamId) return
      setMessage(refineState.original)
      setRefineState({ status: 'idle' })
    })

    return () => {
      unsubDelta()
      unsubComplete()
      unsubError()
    }
  }, [refineState, setMessage])

  return { isRefining, handleRefine, handleRefineCancel }
}
