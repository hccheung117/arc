export class IpcTransport {
  sendMessages({ messages, chatId, abortSignal }) {
    return new Promise((resolve) => {
      let controller
      const stream = new ReadableStream({
        start(c) { controller = c },
      })

      const abort = window.api.call('session:send', { sessionId: chatId, messages }, (chunk) => {
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
