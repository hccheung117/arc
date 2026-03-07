import { push } from '../router.js'
import { listProviders } from '../services/provider.js'

export const pushProviders = async () => {
  push('provider:feed', await listProviders())
}
