import { register, push } from '../router.js'
import * as prompts from '../services/prompts.js'

export const pushPrompts = async () =>
  push('prompt:listen', await prompts.resolveProfilePrompts())

register('prompt:commit', async ({ name, content }) => {
  await prompts.savePrompt(prompts.promptsAppDir, name, content)
  pushPrompts()
})

register('prompt:remove', async ({ name }) => {
  await prompts.removePrompt(prompts.promptsAppDir, name)
  pushPrompts()
})
