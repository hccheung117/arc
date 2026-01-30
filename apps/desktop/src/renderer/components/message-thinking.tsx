import { useState, useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { Markdown } from '@renderer/components/markdown'
import { useAutoScroll } from '@renderer/hooks/use-auto-scroll'

interface ThinkingBlockProps {
  content: string
  isStreaming: boolean
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  // Initialize expanded only when streaming; completed messages start collapsed
  const [isExpanded, setIsExpanded] = useState(isStreaming)
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Auto-scroll while streaming; detects when user scrolls away to stop
  const { ref: scrollRef, userHasTouched, markTouched } = useAutoScroll({
    enabled: isStreaming && isExpanded,
    content,
    smooth: true,
  })

  // Track thinking duration
  useEffect(() => {
    if (isStreaming && !startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    if (!isStreaming && startTimeRef.current) {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
      setThinkingDuration(duration)
      // Auto-collapse when thinking ends (only if user hasn't touched)
      if (!userHasTouched) {
        setIsExpanded(false)
      }
    }
  }, [isStreaming, userHasTouched])

  // Keep expanded while streaming
  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true)
    }
  }, [isStreaming])

  const headerText = isStreaming
    ? 'Thinking...'
    : thinkingDuration !== null
      ? `Thought for ${thinkingDuration}s`
      : 'Thought'

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => {
          markTouched()
          setIsExpanded(!isExpanded)
        }}
        className="flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
        <span className={isStreaming ? 'animate-pulse' : ''}>
          {headerText}
        </span>
      </button>

      <div
        ref={scrollRef}
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-80 overflow-y-auto opacity-100' : 'max-h-0 overflow-hidden opacity-0'
        }`}
        onClick={markTouched}
      >
        <div className="mt-2 pl-4 border-l-3 border-muted [&_.prose]:[--tw-prose-body:var(--muted-foreground)] [&_.prose]:[--tw-prose-headings:var(--muted-foreground)] [&_.prose]:[--tw-prose-bold:var(--muted-foreground)] text-muted-foreground/80">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    </div>
  )
}
