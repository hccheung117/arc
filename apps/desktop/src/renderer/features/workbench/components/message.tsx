import type { Message as MessageType } from '@arc-types/messages'
import type { BranchInfo } from '@main/contracts/messages'
import { MessageUser } from './message-user'
import { MessageAssistant } from './message-assistant'

interface MessageProps {
  id?: string
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
export function Message({ message, id, ...props }: MessageProps) {
  if (message.role === 'user') {
    return <MessageUser id={id} message={message} {...props} />
  }

  return <MessageAssistant id={id} message={message} {...props} />
}
