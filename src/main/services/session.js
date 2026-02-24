const chats = [
  { id: 1, title: "Help me debug React app", date: new Date().toISOString() },
  { id: 2, title: "Write a Python script", date: new Date().toISOString() },
  { id: 3, title: "Explain async/await", date: new Date(Date.now() - 86400000).toISOString() },
  { id: 4, title: "CSS Grid layout help", date: new Date(Date.now() - 86400000).toISOString() },
  { id: 5, title: "Docker compose setup", date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 6, title: "Git rebase tutorial", date: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 7, title: "SQL query optimization", date: new Date(Date.now() - 6 * 86400000).toISOString() },
  { id: 8, title: "REST API design", date: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: 9, title: "TypeScript generics", date: new Date(Date.now() - 15 * 86400000).toISOString() },
  { id: 10, title: "Kubernetes basics", date: new Date(Date.now() - 25 * 86400000).toISOString() },
]

export const listSessions = () => chats

export const getSession = (id) => chats.find(c => c.id === id)

export const pinSession = (id) => {
  const chat = chats.find(c => c.id === id)
  if (chat) chat.pinned = !chat.pinned
}

export const duplicateSession = (id) => {
  const chat = chats.find(c => c.id === id)
  if (!chat) return
  chats.push({ ...chat, id: Math.max(...chats.map(c => c.id)) + 1, title: `${chat.title} (copy)`, date: new Date().toISOString() })
}

export const deleteSession = (id) => {
  const idx = chats.findIndex(c => c.id === id)
  if (idx !== -1) chats.splice(idx, 1)
}

export const renameSession = (id, title) => {
  const chat = chats.find(c => c.id === id)
  if (chat) chat.title = title
}

const MOCK_RESPONSE = "Hello! I'm a mock AI assistant running locally via IPC. This response is being streamed character by character to demonstrate the streaming infrastructure. How can I help you today?"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const streamText = async (send, signal) => {
  const textId = crypto.randomUUID()

  send({ type: 'start' })
  send({ type: 'start-step' })
  send({ type: 'text-start', id: textId })

  for (const char of MOCK_RESPONSE) {
    if (signal.aborted) break
    await sleep(30)
    send({ type: 'text-delta', delta: char, id: textId })
  }

  send({ type: 'text-end', id: textId })
  send({ type: 'finish-step' })
  send({ type: 'finish', finishReason: signal.aborted ? 'stop' : 'end-turn' })
}
