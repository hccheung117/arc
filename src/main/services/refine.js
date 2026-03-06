import { getAssignment } from './settings.js'
import { streamText } from './llm.js'

const SYSTEM = 'Improve the following system prompt. Return only the improved prompt.'

export const refinePrompt = async ({ text, send, signal }) => {
  const assignment = await getAssignment('refine-prompt')
  if (!assignment) { send({ type: 'finish' }); return }
  await streamText({
    ...assignment, system: SYSTEM,
    messages: [{ role: 'user', parts: [{ type: 'text', text: `<prompt>${text}</prompt>` }] }],
    send, signal, thinking: true,
  })
}
