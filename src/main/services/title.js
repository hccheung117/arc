import { getAssignment } from './settings.js'
import { generateText } from './llm.js'

const SYSTEM = 'Generate a short Title Case title (max 6 words) for this conversation. Return only the title, no quotes or punctuation.'

export function fallbackTitle(messages) {
  const first = messages.find(m => m.role === 'user')
  const text = first?.parts?.find(p => p.type === 'text')?.text ?? ''
  return text.split('\n')[0].slice(0, 50) || 'New Chat'
}

export async function generateTitle(messages) {
  const assignment = await getAssignment('generate-title')
  if (!assignment) return null

  const first = messages.find(m => m.role === 'user')
  const text = first?.parts?.find(p => p.type === 'text')?.text
  if (!text) return null

  const { text: title } = await generateText({
    ...assignment, system: SYSTEM, prompt: `<first-user-message>${text}</first-user-message>`,
  })
  return title.trim()
}
