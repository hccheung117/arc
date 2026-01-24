import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { BranchInfo } from '@main/modules/messages/business'

interface BranchIndicatorProps {
  branchInfo: BranchInfo
  onSwitch: (index: number) => void
}

/**
 * Compact branch navigation control.
 * Shows "< 2/3 >" style navigation at branch points.
 */
export function BranchIndicator({ branchInfo, onSwitch }: BranchIndicatorProps) {
  const { currentIndex, branches } = branchInfo
  const total = branches.length

  return (
    <div className="flex items-center gap-0.5 text-meta text-muted-foreground">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={currentIndex === 0}
        onClick={() => onSwitch(currentIndex - 1)}
        aria-label="Previous branch"
      >
        <ChevronLeft className="h-3 w-3" />
      </Button>
      <span className="min-w-[3ch] text-center tabular-nums">
        {currentIndex + 1}/{total}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={currentIndex === total - 1}
        onClick={() => onSwitch(currentIndex + 1)}
        aria-label="Next branch"
      >
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  )
}
