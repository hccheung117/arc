import { registerStream } from '../router.js'
import { refinePrompt } from '../services/assist.js'

registerStream('assist:refine-prompt', ({ text, send, signal }) =>
  refinePrompt({ text, send, signal })
)
