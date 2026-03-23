import { h } from '../jsx.js'

export const SYSTEM_REFINE = 'Improve the following system prompt. Return only the improved prompt.'
export const SYSTEM_TITLE = 'Generate a short Title Case title (max 6 words) for this conversation. Return only the title, no quotes or punctuation.'

export const renderPromptTag = (text) => <prompt>{text}</prompt>
export const renderTitleTag = (text) => <first_user_message>{text}</first_user_message>
