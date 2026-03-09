import { register } from '../router.js'
import { defineChannel } from '../channel.js'
import * as prompts from '../services/prompts.js'

export const promptsCh = defineChannel('prompt:feed', () => prompts.resolveProfilePrompts())

register('prompt:commit', promptsCh.mutate(({ name, content }) => prompts.savePrompt(prompts.promptsAppDir, name, content)))
register('prompt:remove', promptsCh.mutate(({ name }) => prompts.removePrompt(prompts.promptsAppDir, name)))
