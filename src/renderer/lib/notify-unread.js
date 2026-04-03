const DEBOUNCE_MS = 3000

/** Creates a Notification for a session. Skips if session not found. */
export const fireNotification = (sessionId, sessions, onActivate) => {
  const session = sessions.find(s => s.id === sessionId)
  if (!session) return
  const n = new Notification(session.title, { body: 'New reply available' })
  n.onclick = () => onActivate(sessionId)
}

/** Schedules a debounced notification. Replaces any existing timer for the same session. */
export const scheduleNotification = (pending, sessionId, sessions, onActivate) => {
  if (pending.has(sessionId)) clearTimeout(pending.get(sessionId))
  const id = setTimeout(() => {
    pending.delete(sessionId)
    fireNotification(sessionId, sessions, onActivate)
  }, DEBOUNCE_MS)
  pending.set(sessionId, id)
}

/** Clears all pending notification timers. */
export const cancelAllPending = (pending) => {
  for (const id of pending.values()) clearTimeout(id)
  pending.clear()
}
