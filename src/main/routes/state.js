import { resolve } from '../arcfs.js'
import { register } from '../router.js'
import { defineChannel } from '../channel.js'
import { getState, setState } from '../services/state.js'

const stateFile = resolve('state.json')

export const appState = defineChannel('state:feed', () => getState(stateFile))

register('state:set', appState.mutate((patch) => setState(stateFile, patch)))
