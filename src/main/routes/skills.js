import { defineChannel } from '../channel.js'
import { discoverSkills } from '../services/skill.js'

export const skillsCh = defineChannel('skills:feed', discoverSkills)
