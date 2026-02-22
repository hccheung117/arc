import { register, registerStream } from '../router.js'

const activeStreams = new Map()

const MOCK_RESPONSE = "Hello! I'm a mock AI assistant running locally via IPC. This response is being streamed character by character to demonstrate the streaming infrastructure. How can I help you today?"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const streamResponse = async (send, requestId) => {
  const controller = new AbortController()
  activeStreams.set(requestId, controller)

  try {
    const textId = crypto.randomUUID()

    send({ type: 'start' })
    send({ type: 'start-step' })
    send({ type: 'text-start', id: textId })

    for (const char of MOCK_RESPONSE) {
      if (controller.signal.aborted) break
      await sleep(30)
      send({ type: 'text-delta', delta: char, id: textId })
    }

    send({ type: 'text-end', id: textId })
    send({ type: 'finish-step' })
    send({ type: 'finish', finishReason: controller.signal.aborted ? 'stop' : 'end-turn' })
  } finally {
    activeStreams.delete(requestId)
  }
}

registerStream('conversation:send', ({ send, requestId }) => {
  streamResponse(send, requestId)
})

register('stream:abort', ({ requestId }) => {
  activeStreams.get(requestId)?.abort()
})
