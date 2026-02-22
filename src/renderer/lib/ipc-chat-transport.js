export class IpcChatTransport {
  sendMessages({ messages, abortSignal }) {
    return new Promise((resolve) => {
      let controller
      const stream = new ReadableStream({
        start(c) { controller = c },
      })

      const abort = window.api.stream('conversation:send', { messages }, (chunk) => {
        controller.enqueue(chunk)
        if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
          controller.close()
        }
      })

      abortSignal?.addEventListener('abort', () => abort(), { once: true })
      resolve(stream)
    })
  }

  reconnectToStream() {
    return Promise.resolve(null)
  }
}
