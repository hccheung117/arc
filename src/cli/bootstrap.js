import { app } from 'electron'
import '@main/init.js'
import '@main/routes/session.js'
import '@main/routes/prompts.js'
import '@main/routes/models.js'
import '@main/routes/message.js'
import { createClient } from '@cli/client.js'

export const withApp = async (fn) => {
  await app.whenReady()
  const api = createClient()
  try { await fn(api) }
  finally { app.quit() }
}
