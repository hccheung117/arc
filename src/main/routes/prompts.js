import { register, push } from '../router.js'
import { resolve } from '../arcfs.js'
import * as prompts from '../services/prompts.js'

const dir = resolve('profiles', '@app', 'prompts')

export const pushPrompts = async () =>
  push('prompt:listen', await prompts.listPrompts(dir))

register('prompt:save', async ({ name, content }) => {
  push('prompt:listen', await prompts.savePrompt(dir, name, content))
})

register('prompt:remove', async ({ name }) => {
  push('prompt:listen', await prompts.removePrompt(dir, name))
})
