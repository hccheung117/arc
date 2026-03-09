import { defineChannel } from '../channel.js'
import { listProviders } from '../services/provider.js'

export const providers = defineChannel('provider:feed', () => listProviders())
