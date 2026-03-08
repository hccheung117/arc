import { register, registerStream } from '../router.js'
import { refinePrompt, transcribeAudio } from '../services/assist.js'

registerStream('assist:refine-prompt', ({ text, send, signal }) =>
  refinePrompt({ text, send, signal })
)

register('assist:transcribe-audio', ({ audio }) => transcribeAudio({ audio }))
