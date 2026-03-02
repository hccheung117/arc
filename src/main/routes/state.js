import { resolve } from '../arcfs.js'
import { register, push } from '../router.js'
import { getState, setState } from '../services/state.js'

const stateFile = resolve('state.json')

register('state:set', async (patch) => {
  await setState(stateFile, patch)
  push('state:listen', await getState(stateFile))
})

export const pushState = async () => {
  push('state:listen', await getState(stateFile))
}
