import { useCallback, useEffect, useRef, useState } from "react"
import { Lock, LockOpen } from "lucide-react"
import { cn } from "@/lib/shadcn"

export function useAutogrowLock() {
  const containerRef = useRef(null)
  const dragRef = useRef(null)
  const [isResizing, setIsResizing] = useState(false)
  const [manualMaxHeight, setManualMaxHeight] = useState(undefined)

  const isLocked = manualMaxHeight !== undefined

  const startResizing = useCallback(
    (event) => {
      const container = containerRef.current
      if (!container) return
      const parent = container.closest("[data-body]")
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

  return { containerRef, isLocked, manualMaxHeight, startResizing, toggleLock }
}

const Line = ({ isLocked }) => (
  <div className={cn(
    "h-0.5 w-6 rounded-full bg-border",
    isLocked && "opacity-0 transition-opacity group-hover/handle:opacity-100"
  )} />
)

export function ComposerAutogrowLockHandle({ onResizeStart, isLocked, onToggleLock }) {
  return (
    <div
      onMouseDown={onResizeStart}
      className={cn(
        "group/handle flex h-5 w-full shrink-0 cursor-row-resize items-center justify-center gap-2",
        !isLocked && "opacity-0 transition-opacity hover:opacity-100"
      )}
    >
      <Line isLocked={isLocked} />
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
      <Line isLocked={isLocked} />
    </div>
  )
}
