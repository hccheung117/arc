import { getAssignment } from './settings.js'
import { generateText, streamText } from './llm.js'

const SYSTEM_REFINE = 'Improve the following system prompt. Return only the improved prompt.'

const SYSTEM_TITLE = 'Generate a short Title Case title (max 6 words) for this conversation. Return only the title, no quotes or punctuation.'

export const refinePrompt = async ({ text, send, signal }) => {
  const assignment = await getAssignment('refine-prompt')
  if (!assignment) { send({ type: 'finish' }); return }
  await streamText({
    ...assignment, system: SYSTEM_REFINE,
    messages: [{ role: 'user', parts: [{ type: 'text', text: `<prompt>${text}</prompt>` }] }],
    send, signal, thinking: true,
  })
}

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
    ...assignment, system: SYSTEM_TITLE,
    messages: [{ role: 'user', parts: [{ type: 'text', text: `<first-user-message>${text}</first-user-message>` }] }],
  })
  return title.trim()
}
