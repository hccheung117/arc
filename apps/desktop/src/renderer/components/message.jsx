import { MessageUser } from './message-user'
import { MessageAssistant } from './message-assistant'

/**
 * Routes to the appropriate message component based on role
 */
export function Message({ message, id, ...props }) {
  if (message.role === 'user') {
    return <MessageUser id={id} message={message} {...props} />
  }

  return <MessageAssistant id={id} message={message} {...props} />
}
