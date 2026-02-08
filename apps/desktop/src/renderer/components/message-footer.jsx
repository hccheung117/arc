import { MessageActions } from './message-actions'
import { BranchIndicator } from './message-branch'

/**
 * Shared footer for messages containing branch navigation and action buttons.
 * Used by both MessageUser and MessageAssistant to ensure consistent layout.
 *
 * Note: threadId and messageId are accessed via context in MessageActions,
 * avoiding prop drilling through this intermediate component.
 */
export function MessageFooter({
  content,
  isHovered,
  onEdit,
  branchInfo,
  onBranchSwitch,
  align,
}) {
  const hasBranches = branchInfo && branchInfo.branches.length > 1 && onBranchSwitch

  return (
    <div className="h-chat-action-h flex items-center gap-1">
      {align === 'right' && <div className="flex-1" />}
      {hasBranches && (
        <BranchIndicator branchInfo={branchInfo} onSwitch={onBranchSwitch} />
      )}
      <MessageActions content={content} isHovered={isHovered} onEdit={onEdit} />
    </div>
  )
}
