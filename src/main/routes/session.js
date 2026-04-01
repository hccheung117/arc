import fs from 'node:fs/promises'
import { dialog, Menu, shell } from 'electron'
import { register, push, getMainWindow } from '../router.js'
import { defineChannel } from '../channel.js'
import { resolve, sessionWorkspace, fromUrl } from '../arcfs.js'
import * as session from '../services/session.js'
import * as layout from '../services/layout.js'
import * as message from '../services/message.js'
import { generateId } from 'ai'
import * as sessionStore from '../session-store.js'
import { cleanParts } from '../services/llm.js'
import { promptsCh } from './prompts.js'
import { closePopout } from './popout.js'

const dir = resolve('sessions')

const sessions = defineChannel('session:feed', async () => {
  const [list, folders] = await Promise.all([
    session.listSessions(dir),
    layout.listFolders(dir),
  ])
  return { sessions: list, folders }
})

const forkFromMessage = async (sessionId, messageId) => {
  const newId = await session.forkSession(dir, sessionId, messageId)
  if (!newId) return
  await sessions.push()
  push('session:navigate:feed', newId)
}

export const reloadSession = async (sessionId) => {
  const { messages, branches } = await message.loadMessages(dir, sessionId)
  const prompt = await session.loadPrompt(dir, sessionId)
  sessionStore.load(sessionId, { messages: message.stripSyntheticParts(messages), branches, prompt })
}

export { sessions, forkFromMessage }

register('session:list', () => session.listSessions(dir))

register('session:context-menu', async ({ id }) => {
  const chat = await session.getSession(dir, id)
  if (!chat) return
  const folders = await layout.listFolders(dir)
  const folderIdx = folders.findIndex(f => f.sessions.includes(id))
  const inFolder = folderIdx !== -1

  const moveSubmenu = [
    ...folders
      .map((f, i) => ({ label: f.name, click: sessions.mutate(() => layout.moveToFolder(dir, id, i)) }))
      .filter((_, i) => i !== folderIdx),
    ...(folders.length > (inFolder ? 1 : 0) ? [{ type: 'separator' }] : []),
    { label: 'New Folder', click: async () => {
      await layout.createFolder(dir, 'New Folder', id)
      await sessions.push()
      const updated = await layout.listFolders(dir)
      push('session:folder-rename:start', updated.length - 1)
    } },
  ]

  Menu.buildFromTemplate([
    ...(!inFolder ? [
      { label: chat.pinned ? 'Unpin' : 'Pin', click: sessions.mutate(() => layout.pinSession(dir, id)) },
      { type: 'separator' },
    ] : []),
    { label: 'Rename', click: () => push('session:rename:start', id) },
    { label: 'Duplicate', click: sessions.mutate(async () => {
      const newId = await session.duplicateSession(dir, id)
      if (inFolder && newId) await layout.moveToFolder(dir, newId, folderIdx)
    }) },
    { type: 'separator' },
    ...(inFolder ? [{ label: 'Remove from Folder', click: sessions.mutate(() => layout.removeFromFolder(dir, id)) }] : []),
    { label: 'Move to Folder', submenu: moveSubmenu },
    { type: 'separator' },
    { label: 'Delete', click: sessions.mutate(() => { closePopout(id); sessionStore.remove(id); return session.deleteSession(dir, id) }) },
  ]).popup()
})

register('session:rename', sessions.mutate(({ id, title }) => session.renameSession(dir, id, title)))
register('session:create-folder', sessions.mutate(({ name, id }) => layout.createFolder(dir, name, id)))
register('session:move-to-folder', sessions.mutate(({ id, folderIndex }) => layout.moveToFolder(dir, id, folderIndex)))
register('session:remove-from-folder', sessions.mutate(({ id }) => layout.removeFromFolder(dir, id)))
register('session:rename-folder', sessions.mutate(({ folderIndex, name }) => layout.renameFolder(dir, folderIndex, name)))
register('session:delete-folder', sessions.mutate(({ folderIndex }) => layout.deleteFolder(dir, folderIndex)))
register('session:toggle-folder-collapse', sessions.mutate(({ folderIndex }) => layout.toggleFolderCollapse(dir, folderIndex)))

register('session:folder-context-menu', ({ folderIndex }) => {
  Menu.buildFromTemplate([
    { label: 'Rename', click: () => push('session:folder-rename:start', folderIndex) },
    { label: 'Delete', click: sessions.mutate(() => layout.deleteFolder(dir, folderIndex)) },
  ]).popup()
})

register('session:activate', async ({ sessionId }) => {
  const { messages, branches } = await message.loadMessages(dir, sessionId)
  const prompt = await session.loadPrompt(dir, sessionId)
  sessionStore.load(sessionId, { messages: message.stripSyntheticParts(messages), branches, prompt })
})

register('session:open-workspace', async ({ sessionId }) => {
  const url = await sessionWorkspace(sessionId)
  shell.openPath(fromUrl(url))
})

register('session:export', async ({ sessionId }) => {
  const content = await message.exportMarkdown(dir, sessionId)
  const meta = await session.getSession(dir, sessionId)
  const raw = meta?.title ?? 'Chat'
  const safe = raw.replace(/[/\\:*?"<>|]/g, '_').replace(/[\x00-\x1f]/g, '_').trim() || 'Chat'
  const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow(), {
    defaultPath: `Arc - ${safe}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (canceled || !filePath) return false
  await fs.writeFile(filePath, content, 'utf-8')
  return true
})

register('session:link-prompt', async ({ id, promptRef }) => {
  await session.linkPrompt(dir, id, promptRef)
  const prompt = await session.loadPrompt(dir, id)
  sessionStore.patchPrompt(id, prompt)
})

register('session:save-prompt', async ({ id, content }) => {
  const shared = await session.savePrompt(dir, id, content)
  if (shared) await promptsCh.push()
  const prompt = await session.loadPrompt(dir, id)
  sessionStore.patchPrompt(id, prompt)
})

// [DETECT-MAIN] activeSkill is no longer in the payload from the renderer.
// It is detected from message text inside prepareSend (services/session.js).
register('session:send', async ({ sessionId, messages: inputMessages, promptRef, providerId, modelId }) => {
  if (!providerId || !modelId) return { error: 'No model selected' }
  if (sessionStore.isStreaming(sessionId)) return { error: 'Already streaming' }

  let ctx
  try {
    ctx = await session.prepareSend(dir, { sessionId, inputMessages, promptRef, providerId, modelId })
  } catch (e) {
    return { error: e.message }
  }

  sessionStore.load(sessionId, {
    messages: message.stripSyntheticParts(ctx.messages),
    branches: ctx.branches,
    prompt: sessionStore.get(sessionId)?.prompt ?? null,
  })
  await sessions.push()

  ctx.afterSend()
    .then(async (changed) => { if (changed) await sessions.push() })
    .catch(() => {})

  const signal = sessionStore.prepareStream(sessionId)

  // Fire-and-forget: stream runs in main, not tied to any renderer.
  ;(async () => {
    let streamResult
    try {
      streamResult = await ctx.stream(signal)
    } catch {
      sessionStore.endStream(sessionId, {
        messages: sessionStore.get(sessionId)?.messages ?? [],
        branches: ctx.branches,
      })
      return
    }

    const assistantId = generateId()
    const result = await sessionStore.consumeStream(sessionId, streamResult, assistantId)
    if (!result) {
      // Abort or error — reload from disk so renderer syncs with persisted state
      const { messages: diskMessages } = await message.loadMessages(dir, sessionId)
      sessionStore.endStream(sessionId, {
        messages: message.stripSyntheticParts(diskMessages),
        branches: ctx.branches,
      })
      return
    }

    let parts
    try {
      const steps = await result.streamResult.steps
      parts = cleanParts(steps)
    } catch {
      sessionStore.endStream(sessionId, {
        messages: sessionStore.get(sessionId)?.messages ?? [],
        branches: ctx.branches,
      })
      return
    }

    const branches = await ctx.finalize({ assistantId: result.assistantId, parts })
    const { messages: finalMessages } = await message.loadMessages(dir, sessionId)
    sessionStore.endStream(sessionId, {
      messages: message.stripSyntheticParts(finalMessages),
      branches,
    })
    await sessions.push()
  })()

  return { ok: true }
})

register('session:abort', ({ sessionId }) => sessionStore.abort(sessionId))
