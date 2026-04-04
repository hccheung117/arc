import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { resolve, readMarkdown, toUrl, fromUrl } from '../arcfs.js'
import { resolveDir } from './profile.js'
import { buildSystemPrompt } from '../prompts/system.jsx'
import * as llm from './llm.js'

export const listAgents = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })

  const files = entries.filter(e => e.isFile() && e.name.endsWith('.md'))
  const relative = path.relative(resolve(), dir)
  const directory = toUrl(...relative.split(path.sep))

  return (await Promise.all(files.map(async (entry) => {
    const agentPath = path.join(dir, entry.name)
    const content = await readMarkdown(agentPath)
    if (!content) return null
    const { data } = matter(content)
    if (!data.name || !data.description) return null
    return {
      name: data.name,
      description: data.description,
      model: data.model || null,
      file: entry.name,
      directory,
    }
  }))).filter(Boolean)
}

export const discoverAgents = async () =>
  resolveDir('agents', listAgents)

export const loadAgentContent = async (agents, name) => {
  const agent = agents.find(a => a.name === name)
  if (!agent) return null
  const dir = fromUrl(agent.directory)
  const agentPath = path.join(dir, agent.file)
  const content = await readMarkdown(agentPath)
  if (!content) return null
  const { data, content: body } = matter(content)
  return { system: body.trim(), model: data.model || null }
}

export const runAgent = async ({ name, prompt, model, agents, skills, allSkills, provider, modelId, tools, signal }) => {
  const agentContent = await loadAgentContent(agents, name)
  if (!agentContent) throw new Error(`Agent not found: ${name}`)

  const resolvedModelId = model || agentContent.model || modelId

  const { subagent: _, load_skill, ...baseTools } = tools
  const filteredSkills = skills?.length
    ? allSkills.filter(s => skills.includes(s.name))
    : []
  const agentTools = filteredSkills.length
    ? { ...baseTools, load_skill }
    : baseTools

  const system = buildSystemPrompt(agentContent.system, filteredSkills)

  return llm.stream({
    provider,
    modelId: resolvedModelId,
    system,
    messages: [{ role: 'user', parts: [{ type: 'text', text: prompt }] }],
    tools: agentTools,
    signal,
    thinking: true,
  })
}
