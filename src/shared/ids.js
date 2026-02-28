export const sessionId = () => {
  const d = new Date().toISOString().replace(/\D/g, '')
  return `${d.slice(0, 8)}-${d.slice(8, 14)}-${Math.random().toString(36).slice(2, 10)}`
}
