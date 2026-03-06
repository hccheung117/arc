import { registerStream } from '../router.js'
import { refinePrompt } from '../services/refine.js'

registerStream('prompt:refine', ({ text, send, signal }) =>
  refinePrompt({ text, send, signal })
)
