import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { resolve, readMarkdown, toUrl, fromUrl, builtinBase } from '../arcfs.js'
import { resolveDir, appPath } from './profile.js'
import { renderActiveSkill } from '../prompts/augment.jsx'

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

const listBuiltinSkills = async () => {
  const entries = await listSkills(builtinBase())
  return entries.map(e => ({ ...e, directory: toUrl('builtin', e.name), source: '@builtin' }))
}

export const discoverSkills = async () => {
  const resolved = await resolveDir('skills', listSkills)
  const builtins = await listBuiltinSkills()
  const resolvedNames = new Set(resolved.map(s => s.name))
  return [...resolved, ...builtins.filter(s => !resolvedNames.has(s.name))]
}

export const skillEnvName = (name) => name.replace(/-/g, '_').toUpperCase() + '_SKILL_DIR'

export const loadSkillContent = async (skills, name) => {
  const skill = skills.find(s => s.name === name)
  if (!skill) return `Skill not found: ${name}`
  const skillPath = path.join(fromUrl(skill.directory), 'SKILL.md')
  const content = await readMarkdown(skillPath)
  if (!content) return `Skill file not found: ${name}`
  const body = matter(content).content
    .replaceAll('$ARC_APP_SKILLS_DIR', appPath('skills'))
  return { content: body, skillDirectory: '$' + skillEnvName(skill.name) }
}

export const buildSkillAugment = (activeSkill, body, env) => ({
  type: 'text',
  text: renderActiveSkill(activeSkill, body, env),
  arcSynthetic: `skill:${activeSkill}`,
})

export const hasSkillAugment = (messages, skillName) =>
  messages.some(m => m.parts?.some(p => p.arcSynthetic === `skill:${skillName}`))

