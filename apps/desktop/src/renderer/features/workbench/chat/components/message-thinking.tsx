import { useState, useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { Markdown } from '@renderer/components/markdown'

interface ThinkingBlockProps {
  content: string
  isStreaming: boolean
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  // Initialize expanded only when streaming; completed messages start collapsed
  const [isExpanded, setIsExpanded] = useState(isStreaming)
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const userHasTouchedRef = useRef(false)

  // Track thinking duration
  useEffect(() => {
    if (isStreaming && !startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    if (!isStreaming && startTimeRef.current) {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
      setThinkingDuration(duration)
      // Auto-collapse when thinking ends (only if user hasn't touched)
      if (!userHasTouchedRef.current) {
        setIsExpanded(false)
      }
    }
  }, [isStreaming])

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
          userHasTouchedRef.current = true
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
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-80 overflow-y-auto opacity-100' : 'max-h-0 overflow-hidden opacity-0'
        }`}
        onClick={() => { userHasTouchedRef.current = true }}
        onScroll={() => { userHasTouchedRef.current = true }}
      >
        <div className="mt-2 pl-4 border-l-2 border-muted text-muted-foreground">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    </div>
  )
}
