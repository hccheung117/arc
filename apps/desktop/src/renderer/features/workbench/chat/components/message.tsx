import type { Message as MessageType } from '@arc-types/messages'
import type { BranchInfo } from '@arc-types/arc-api'
import { MessageUser } from './message-user'
import { MessageAssistant } from './message-assistant'

interface MessageProps {
  message: MessageType
  isThinking?: boolean
  onEdit?: (content: string) => void
  isEditing?: boolean
  branchInfo?: BranchInfo
  onBranchSwitch?: (index: number) => void
}

/**
 * Routes to the appropriate message component based on role
 */
export function Message({ message, ...props }: MessageProps) {
  if (message.role === 'user') {
    return <MessageUser message={message} {...props} />
  }

  return <MessageAssistant message={message} {...props} />
}
