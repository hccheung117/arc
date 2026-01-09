import type { BranchInfo } from '@arc-types/arc-api'
import { MessageActions } from './message-actions'
import { BranchIndicator } from './message-branch'

interface MessageFooterProps {
  content: string
  isHovered: boolean
  onEdit?: (content: string) => void
  branchInfo?: BranchInfo
  onBranchSwitch?: (index: number) => void
  /** Controls alignment of action buttons */
  align: 'left' | 'right'
}

/**
 * Shared footer for messages containing branch navigation and action buttons.
 * Used by both MessageUser and MessageAssistant to ensure consistent layout.
 */
export function MessageFooter({
  content,
  isHovered,
  onEdit,
  branchInfo,
  onBranchSwitch,
  align,
}: MessageFooterProps) {
  const hasBranches = branchInfo && branchInfo.branches.length > 1 && onBranchSwitch

  return (
    <div className="h-chat-action-h flex items-center gap-1">
      {align === 'right' && <div className="flex-1" />}
      {hasBranches && (
        <BranchIndicator branchInfo={branchInfo} onSwitch={onBranchSwitch} />
      )}
      <MessageActions
        content={content}
        isHovered={isHovered}
        onEdit={onEdit}
      />
    </div>
  )
}
