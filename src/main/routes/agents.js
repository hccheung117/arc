import { defineChannel } from '../channel.js'
import { discoverAgents } from '../services/subagent.js'

export const agentsCh = defineChannel('agents:feed', discoverAgents)
