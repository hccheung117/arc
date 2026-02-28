import { register, push } from '../router.js'
import * as prompts from '../services/prompts.js'
import { resolveDir, appPath } from '../services/profile.js'

const writeDir = appPath('prompts')

export const pushPrompts = async () =>
  push('prompt:listen', await resolveDir('prompts', prompts.listPrompts))

register('prompt:save', async ({ name, content }) => {
  await prompts.savePrompt(writeDir, name, content)
  pushPrompts()
})

register('prompt:remove', async ({ name }) => {
  await prompts.removePrompt(writeDir, name)
  pushPrompts()
})
