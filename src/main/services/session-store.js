import { readUIMessageStream } from 'ai'
import { push } from '../router.js'

const sessions = new Map()

const emit = (event) => push('session:state:feed', event)

const getOrCreate = (sessionId) => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      branches: {},
      prompt: null,
      status: 'ready',
      error: null,
      abortController: null,
    })
  }
  return sessions.get(sessionId)
}

export const get = (sessionId) => sessions.get(sessionId)

export const load = (sessionId, { messages, branches, prompt }) => {
  const state = getOrCreate(sessionId)
  state.messages = messages
  state.branches = branches
  state.prompt = prompt
  emit({
    type: 'snapshot',
    sessionId,
    messages: state.messages,
    branches: state.branches,
    prompt: state.prompt,
    status: state.status,
  })
}

export const patchPrompt = (sessionId, prompt) => {
  const state = getOrCreate(sessionId)
  state.prompt = prompt
  emit({ type: 'snapshot', sessionId, messages: state.messages, branches: state.branches, prompt, status: state.status })
}

// Phase 1: Set up AbortController and status before LLM call starts.
// Returns the signal to pass to the LLM stream.
export const prepareStream = (sessionId) => {
  const state = getOrCreate(sessionId)
  const abortController = new AbortController()
  state.abortController = abortController
  state.status = 'streaming'
  state.error = null
  emit({ type: 'status', sessionId, status: 'streaming' })
  return abortController.signal
}

// Phase 2: Consume the StreamTextResult, broadcasting tip events.
// Returns { assistantId, streamResult } on success, null on abort/error.
export const consumeStream = async (sessionId, streamResult, assistantId) => {
  const state = get(sessionId)
  if (!state) return null

  const uiStream = streamResult.toUIMessageStream({
    sendReasoning: true,
    generateMessageId: () => assistantId,
  })
  const messageStream = readUIMessageStream({ stream: uiStream, terminateOnError: true })

  try {
    for await (const message of messageStream) {
      if (state.abortController?.signal.aborted) break
      emit({ type: 'tip', sessionId, message })
    }
  } catch (e) {
    state.status = 'ready'
    state.error = e.message ?? 'Streaming failed'
    state.abortController = null
    emit({ type: 'status', sessionId, status: 'ready', error: state.error })
    return null
  }

  if (state.abortController?.signal.aborted) {
    state.status = 'ready'
    state.abortController = null
    emit({ type: 'status', sessionId, status: 'ready' })
    return null
  }

  return { assistantId, streamResult }
}

// Phase 3: Finalize — update store with persisted state and broadcast snapshot.
export const endStream = (sessionId, { messages, branches }) => {
  const state = get(sessionId)
  if (!state) return
  state.messages = messages
  state.branches = branches
  state.status = 'ready'
  state.error = null
  state.abortController = null
  emit({
    type: 'snapshot',
    sessionId,
    messages: state.messages,
    branches: state.branches,
    prompt: state.prompt,
    status: 'ready',
  })
}

export const abort = (sessionId) => {
  const state = get(sessionId)
  if (state?.abortController) state.abortController.abort()
}

export const isStreaming = (sessionId) =>
  get(sessionId)?.status === 'streaming'

export const remove = (sessionId) => {
  sessions.delete(sessionId)
}
