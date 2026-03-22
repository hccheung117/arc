import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { resolve, readMarkdown, toUrl, fromUrl } from '../arcfs.js'
import { resolveDir } from './profile.js'

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
    const { data } = matter(content)
    if (!data.name || !data.description) return null
    const relative = path.relative(resolve(), path.join(dir, entry.name))
    return { name: data.name, description: data.description, directory: toUrl(...relative.split(path.sep)) }
  }))).filter(Boolean)
}

export const discoverSkills = () => resolveDir('skills', listSkills)

export const skillEnvName = (name) => name.replace(/-/g, '_').toUpperCase() + '_SKILL_DIR'

export const loadSkillContent = async (skills, name) => {
  const skill = skills.find(s => s.name === name)
  if (!skill) return `Skill not found: ${name}`
  const skillPath = path.join(fromUrl(skill.directory), 'SKILL.md')
  const content = await readMarkdown(skillPath)
  if (!content) return `Skill file not found: ${name}`
  return { content: matter(content).content, skillDirectory: '$' + skillEnvName(skill.name) }
}

export const buildSkillAugment = (activeSkill, body, env) => ({
  type: 'text',
  text: `<active_skill name="${activeSkill}"${env ? ` path="$${env}"` : ''}>\n${body}\n</active_skill>`,
  arcSynthetic: `skill:${activeSkill}`,
})

export const hasSkillAugment = (messages, skillName) =>
  messages.some(m => m.parts?.some(p => p.arcSynthetic === `skill:${skillName}`))

export const buildSkillsPrompt = (skills) => {
  if (!skills.length) return null
  const entries = skills.map(s => `<skill name="${s.name}" path="$${skillEnvName(s.name)}">${s.description}</skill>`).join('\n')
  return `<available_skills>\nProactively load a skill using the load_skill tool whenever it can help with the current task.\nDo not call load_skill for a skill whose instructions are already present in the conversation.\n\n${entries}\n</available_skills>`
}
