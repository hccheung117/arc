import fs from 'node:fs/promises'
import path from 'node:path'
import { sessionId } from '@shared/ids.js'
import { readJson, writeJson, readJsonl, appendJsonl, resolve, sessionWorkspace, sessionTmp, fromUrl } from '../arcfs.js'
import { resolveSessionPrompt, saveSessionPrompt, savePrompt as saveAppPrompt, promptsAppDir } from './prompts.js'
import { getProvider } from './provider.js'
import { fallbackTitle, generateTitle } from './assist.js'
import { discoverSkills, loadSkillContent, buildSkillAugment, hasSkillAugment, skillEnvName } from './skill.js'
import { buildSystemPrompt } from '../prompts/system.jsx'
import { renderCurrentTime } from '../prompts/augment.jsx'
import { buildTools } from './tools.js'
import { extractSkillRefs } from '../../shared/text-patterns.js'
import * as llm from './llm.js'
import * as message from './message.js'
import { loadLayout, cleanupSession } from './layout.js'

export const listSessions = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })

  const dirs = entries.filter(e => e.isDirectory())
  const layout = await loadLayout(dir)

  const sessions = await Promise.all(dirs.map(async (entry) => {
    const sessionDir = path.join(dir, entry.name)
    const meta = await readJson(path.join(sessionDir, 'meta.json'))
    if (!meta) return null

    const mtime = await fs.stat(path.join(sessionDir, 'messages.jsonl'))
      .then(s => s.mtime.toISOString())
      .catch(() => null)

    return {
      id: entry.name,
      title: meta.title,
      date: mtime ?? meta.createdAt,
      ...(layout.pinned.includes(entry.name) && { pinned: true }),
    }
  }))

  return sessions.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date))
}

export const getSession = async (dir, id) => {
  const meta = await readJson(path.join(dir, id, 'meta.json'))
  if (!meta) return null
  const layout = await loadLayout(dir)
  return {
    id,
    title: meta.title,
    date: meta.createdAt,
    pinned: layout.pinned.includes(id),
  }
}

export const createSession = async (dir, title = 'New Chat') => {
  const id = sessionId()
  await writeJson(
    path.join(dir, id, 'meta.json'),
    { title, createdAt: new Date().toISOString() },
  )
  return id
}

export const renameSession = async (dir, id, title) => {
  const metaPath = path.join(dir, id, 'meta.json')
  const meta = await readJson(metaPath)
  if (!meta) return
  await writeJson(metaPath, { ...meta, title })
}

const ignore = (code) => (e) => { if (e.code !== code) throw e }

const deriveSession = async (dir, sourceId, { titleFn, messageFn, fileFn }) => {
  const meta = await readJson(path.join(dir, sourceId, 'meta.json'))
  if (!meta) return null
  const newId = sessionId()
  const srcDir = path.join(dir, sourceId)
  const destDir = path.join(dir, newId)
  await writeJson(
    path.join(destDir, 'meta.json'),
    { ...meta, title: titleFn(meta.title), createdAt: new Date().toISOString() },
  )
  await fs.copyFile(path.join(srcDir, 'prompt.md'), path.join(destDir, 'prompt.md')).catch(ignore('ENOENT'))
  await Promise.all([messageFn(srcDir, destDir), fileFn(srcDir, destDir)])
  return newId
}

export const duplicateSession = (dir, id) =>
  deriveSession(dir, id, {
    titleFn: (title) => `${title} (copy)`,
    messageFn: (src, dest) =>
      fs.copyFile(path.join(src, 'messages.jsonl'), path.join(dest, 'messages.jsonl')).catch(ignore('ENOENT')),
    fileFn: (src, dest) => Promise.all([
      fs.cp(path.join(src, 'files'), path.join(dest, 'files'), { recursive: true }).catch(ignore('ENOENT')),
      fs.cp(path.join(src, 'workspace'), path.join(dest, 'workspace'), { recursive: true }).catch(ignore('ENOENT')),
    ]),
  })

export const forkSession = (dir, sourceId, messageId) =>
  deriveSession(dir, sourceId, {
    titleFn: (title) => `${title} (fork)`,
    messageFn: async (src, dest) => {
      const rows = await readJsonl(path.join(src, 'messages.jsonl'))
      const byId = new Map(rows.map(r => [r.id, r]))
      const msg = byId.get(messageId)
      if (!msg) throw new Error(`Message ${messageId} not found`)
      const chain = []
      let cur = msg
      while (cur) {
        chain.push(cur)
        cur = cur.arcParentId ? byId.get(cur.arcParentId) : null
      }
      chain.reverse()
      await appendJsonl(path.join(dest, 'messages.jsonl'), ...chain)
    },
    fileFn: (src, dest) => Promise.all([
      fs.cp(path.join(src, 'files'), path.join(dest, 'files'), { recursive: true }).catch(ignore('ENOENT')),
      fs.cp(path.join(src, 'workspace'), path.join(dest, 'workspace'), { recursive: true }).catch(ignore('ENOENT')),
    ]),
  })

export const deleteSession = async (dir, id) => {
  await fs.rm(path.join(dir, id), { recursive: true, force: true })
  await cleanupSession(dir, id)
}

const promptPath = (dir, sessionId) =>
  path.join(dir, sessionId, 'prompt.md')

export const ensureMeta = async (dir, sessionId, promptRef, title = 'New Chat') => {
  const metaPath = path.join(dir, sessionId, 'meta.json')
  const existing = await readJson(metaPath)
  if (existing) return false
  await writeJson(metaPath, {
    title,
    createdAt: new Date().toISOString(),
    ...(promptRef && { promptRef }),
  })
  return true
}

export const loadPrompt = async (dir, sessionId) => {
  const meta = await readJson(path.join(dir, sessionId, 'meta.json'))
  return resolveSessionPrompt(promptPath(dir, sessionId), meta?.promptRef)
}

export const linkPrompt = async (dir, id, promptRef) => {
  const metaPath = path.join(dir, id, 'meta.json')
  const meta = await readJson(metaPath)
  if (!meta) return
  await writeJson(metaPath, { ...meta, promptRef })
  await fs.unlink(path.join(dir, id, 'prompt.md')).catch(e => { if (e.code !== 'ENOENT') throw e })
}

export const savePrompt = async (dir, id, content) => {
  const meta = await readJson(path.join(dir, id, 'meta.json'))
  if (meta?.promptRef) {
    await saveAppPrompt(promptsAppDir, meta.promptRef, content)
    return true
  }
  await saveSessionPrompt(promptPath(dir, id), content)
  return false
}

// [DETECT-MAIN] activeSkill detected from last user message text, not from renderer.
// [SSOT] The renderer no longer extracts or passes activeSkill — the editor document
// is the single source of truth, and the SkillMention node renders to `/skillName`
// in plain text (see composer-extensions.js renderText).
export const prepareSend = async (dir, { sessionId, inputMessages, promptRef, providerId, modelId }) => {
  const provider = await getProvider(providerId)
  if (!provider) throw new Error(`Provider "${providerId}" not found`)

  const title = fallbackTitle(inputMessages)
  const isNew = await ensureMeta(dir, sessionId, promptRef, title)
  const system = await loadPrompt(dir, sessionId)
  const messages = await message.resolveFileMentions(resolve('sessions', sessionId), inputMessages)
  const filePath = message.messagesPath(dir, sessionId)

  // Skill augmentation: inject full skill content as a user message part.
  // The `/skillName` prefix is intentionally kept in the user text so the LLM
  // sees which skill was invoked; the augmentation adds the skill's instructions.
  const skills = await discoverSkills()
  // [DETECT-MAIN] Detect active skill from the last user message's first text part.
  // The SkillMention node renders as `/skillName` (see composer-extensions.js renderText).
  // Messages use the AI SDK format: { role, parts: [{ type: 'text', text }, ...] }.
  const lastUserText = inputMessages.at(-1)?.parts?.find(p => p.type === 'text')?.text
  const skillRefs = extractSkillRefs(lastUserText ?? '', skills.map(s => s.name))
  const activeSkill = skillRefs[0]?.name ?? null
  const skillContent = activeSkill ? await loadSkillContent(skills, activeSkill) : null
  // typeof null === 'object' in JS — don't use typeof to guard property access
  const activeSkillBody = skillContent?.content ?? null
  const activeSkillEnv = activeSkill ? skillEnvName(activeSkill) : null

  // Dedup: check JSONL (the SSOT) for existing skill augment to avoid double injection
  const { messages: history } = await message.loadMessages(dir, sessionId)
  const alreadyAugmented = activeSkill && activeSkillBody && hasSkillAugment(history, activeSkill)

  // First activation → prepend full augment before persistence; subsequent sends skip injection
  const skillAugmentedMessages = activeSkill && activeSkillBody && !alreadyAugmented
    ? message.augmentUserMessage(messages, [buildSkillAugment(activeSkill, activeSkillBody, activeSkillEnv)], { prepend: true })
    : messages

  // Inject current time into every user message so the LLM knows when it was sent
  const augmentedMessages = message.augmentUserMessage(
    skillAugmentedMessages,
    [{ type: 'text', text: renderCurrentTime(), arcSynthetic: 'time' }],
    { prepend: true },
  )

  const lastId = await message.persistNewMessages(filePath, augmentedMessages)

  // Reload full persisted history — this includes skill augments from earlier
  // turns that the renderer doesn't carry in its Chat state.
  const { messages: llmMessages, branches } = await message.loadMessages(dir, sessionId)

  const workspacePath = fromUrl(await sessionWorkspace(sessionId))
  const tmpPath = fromUrl(await sessionTmp(sessionId))
  const fullSystem = buildSystemPrompt(system, skills)
  const tools = buildTools({ skills, workspacePath, tmpPath })

  return {
    isNew,
    messages: llmMessages,
    branches,

    stream: (signal) =>
      llm.stream({ provider, modelId, system: fullSystem, messages: llmMessages, tools, signal, thinking: true }),

    finalize: async (result) => {
      await message.persistAssistantMessage(filePath, {
        ...result, lastId, arcProviderId: providerId, arcModelId: modelId,
      })
      const updated = await message.loadMessages(dir, sessionId)
      return updated.branches
    },

    afterSend: async () => {
      if (!isNew) return false
      const newTitle = await generateTitle(messages)
      if (!newTitle) return false
      const current = await getSession(dir, sessionId)
      if (current?.title !== title) return false
      await renameSession(dir, sessionId, newTitle)
      return true
    },
  }
}
