/** Returns a new Set with sessionId added, or the same Set if no change needed. */
export const addUnread = (prev, sessionId, activeSessionId) => {
  if (sessionId === activeSessionId || prev.has(sessionId)) return prev
  const next = new Set(prev)
  next.add(sessionId)
  return next
}

/** Returns a new Set with sessionId removed, or the same Set if it wasn't present. */
export const clearUnread = (prev, sessionId) => {
  if (!prev.has(sessionId)) return prev
  const next = new Set(prev)
  next.delete(sessionId)
  return next
}
