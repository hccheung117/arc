import { useCallback, useEffect, useRef, useState } from "react"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input"
import { ImageIcon, BrainIcon, MicIcon, Lock, LockOpen } from "lucide-react"
import { cn } from "@/lib/shadcn"

const AttachImageButton = () => {
  const attachments = usePromptInputAttachments()
  return (
    <PromptInputButton onClick={() => attachments.openFileDialog()}>
      <ImageIcon className="size-4" />
    </PromptInputButton>
  )
}

const Handle = ({ onResizeStart, isLocked, onToggleLock }) => {
  const Line = () => (
    <div className={cn(
      "h-0.5 w-6 rounded-full bg-border",
      isLocked && "opacity-0 transition-opacity group-hover/handle:opacity-100"
    )} />
  )
  return (
  <div
    onMouseDown={onResizeStart}
    className={cn(
      "group/handle flex h-5 w-full shrink-0 cursor-row-resize items-center justify-center gap-2",
      !isLocked && "opacity-0 transition-opacity hover:opacity-100"
    )}
  >
    <Line />
    <button
      type="button"
      tabIndex={-1}
      aria-label={isLocked ? "Unlock composer height" : "Lock composer height"}
      onClick={(e) => { e.stopPropagation(); onToggleLock() }}
      onMouseDown={(e) => e.stopPropagation()}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {isLocked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
    </button>
    <Line />
  </div>
  )
}

export default function Composer() {
  const containerRef = useRef(null)
  const dragRef = useRef(null)
  const [isResizing, setIsResizing] = useState(false)
  const [manualMaxHeight, setManualMaxHeight] = useState(undefined)

  const isLocked = manualMaxHeight !== undefined

  const startResizing = useCallback(
    (event) => {
      const container = containerRef.current
      if (!container) return
      const parent = container.parentElement
      if (!parent) return
      const textarea = container.querySelector("textarea")
      if (!textarea) return

      const styles = getComputedStyle(textarea)
      const lineHeight = parseFloat(styles.lineHeight) || 24
      const paddingY =
        (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0)
      const minCap = Math.ceil(lineHeight + paddingY)
      const chrome = container.offsetHeight - textarea.offsetHeight

      dragRef.current = {
        startY: event.clientY,
        startCap: manualMaxHeight ?? Math.max(minCap, textarea.getBoundingClientRect().height),
        minCap,
        chrome,
        parent,
      }

      setIsResizing(true)
      event.preventDefault()
    },
    [manualMaxHeight]
  )

  const toggleLock = useCallback(() => {
    if (manualMaxHeight !== undefined) {
      setManualMaxHeight(undefined)
      return
    }
    const textarea = containerRef.current?.querySelector("textarea")
    if (!textarea) return
    setManualMaxHeight(textarea.getBoundingClientRect().height)
  }, [manualMaxHeight])

  useEffect(() => {
    if (!isResizing || !dragRef.current) return
    const { startY, startCap, minCap, chrome, parent } = dragRef.current

    const handleMouseMove = (e) => {
      const parentRect = parent.getBoundingClientRect()
      const headerHeight = parent.querySelector("header")?.getBoundingClientRect().height ?? 48
      const maxCap = Math.max(minCap, parentRect.height - headerHeight - 16 - chrome)
      const nextCap = startCap + (startY - e.clientY)
      setManualMaxHeight(Math.max(minCap, Math.min(nextCap, maxCap)))
    }

    const handleMouseUp = () => setIsResizing(false)

    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  const handleSubmit = (message) => {
    console.log(message)
  }

  return (
    <div ref={containerRef} className="px-[var(--content-px)] pb-4">
      <Handle
        onResizeStart={startResizing}
        isLocked={isLocked}
        onToggleLock={toggleLock}
      />
      <PromptInput onSubmit={handleSubmit} accept="image/*">
        <PromptInputBody>
          <PromptInputTextarea
            placeholder="How can I help you today?"
            style={manualMaxHeight !== undefined ? { maxHeight: manualMaxHeight } : undefined}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <AttachImageButton />
          </PromptInputTools>
          <div className="flex items-center gap-1">
            <PromptInputButton>
              <BrainIcon className="size-4" />
              <span>Model</span>
            </PromptInputButton>
            <PromptInputButton>
              <MicIcon className="size-5" />
            </PromptInputButton>
            <PromptInputSubmit className="ml-1 rounded-full" />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
