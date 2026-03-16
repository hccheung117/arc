import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { resolve, readMarkdown, toUrl, fromUrl } from '../arcfs.js'
import { resolveDir } from './profile.js'

const parseFrontmatter = (raw) => {
  const content = raw.replace(/\r\n/g, '\n')
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }
  return { meta: yaml.load(match[1]) ?? {}, body: match[2] }
}

export const listSkills = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })

  const subdirs = entries.filter(e => e.isDirectory())

  return (await Promise.all(subdirs.map(async (entry) => {
    const skillPath = path.join(dir, entry.name, 'SKILL.md')
    const content = await readMarkdown(skillPath)
    if (!content) return null
    const { meta } = parseFrontmatter(content)
    if (!meta.name || !meta.description) return null
    const relative = path.relative(resolve(), path.join(dir, entry.name))
    return { name: meta.name, description: meta.description, directory: toUrl(...relative.split(path.sep)) }
  }))).filter(Boolean)
}

export const discoverSkills = () => resolveDir('skills', listSkills)

export const loadSkillContent = async (skills, name) => {
  const skill = skills.find(s => s.name === name)
  if (!skill) return `Skill not found: ${name}`
  const skillPath = path.join(fromUrl(skill.directory), 'SKILL.md')
  const content = await readMarkdown(skillPath)
  if (!content) return `Skill file not found: ${name}`
  const { body } = parseFrontmatter(content)
  return { content: body, skillDirectory: skill.directory }
}

export const buildSkillAugment = (activeSkill, body) => ({
  type: 'text',
  text: `<active_skill name="${activeSkill}">\n${body}\n</active_skill>`,
  arcSynthetic: `skill:${activeSkill}`,
})

export const hasSkillAugment = (messages, skillName) =>
  messages.some(m => m.parts?.some(p => p.arcSynthetic === `skill:${skillName}`))

export const buildSkillsPrompt = (skills) => {
  if (!skills.length) return null
  const entries = skills.map(s => `<skill name="${s.name}">${s.description}</skill>`).join('\n')
  return `<available_skills>\nProactively load a skill using the load_skill tool whenever it can help with the current task.\n\n${entries}\n</available_skills>`
}
