import { push } from '../router.js'

const personas = ["Persona 1", "Persona 2", "Persona 3"]

export const pushPersonas = () => push('personas', personas)
