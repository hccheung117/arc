import { useControllableState } from "@radix-ui/react-use-controllable-state"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/shadcn"
import { BrainIcon, ChevronDownIcon } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { toolUI } from "@/lib/tool-ui"

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

const isFailedStep = (step) => step.state === 'output-error' || step.state === 'output-denied'

const SubagentOutput = memo(({ parts }) => {
  const textParts = parts.filter(p => p.type === 'text' && p.text?.trim())
  const toolParts = parts.filter(p => p.toolCallId && p.state)

  return (
    <div className="space-y-2 border-l-2 border-border pl-3 ml-1">
      {toolParts.map(p => {
        const name = p.type.startsWith('tool-') ? p.type.slice(5) : p.toolName
        const t = toolUI(name)
        const Icon = t.icon
        const done = p.state === 'output-available' || p.state === 'output-error'
        return (
          <div key={p.toolCallId} className="flex gap-2 text-xs text-muted-foreground">
            <Icon className="size-3 mt-0.5" />
            <span>{t.label(p.input, done)}</span>
          </div>
        )
      })}
      {textParts.length > 0 && (
        <div className="text-xs text-muted-foreground/70 whitespace-pre-wrap">
          {textParts.at(-1).text}
        </div>
      )}
    </div>
  )
})
SubagentOutput.displayName = 'SubagentOutput'

const NarrativeStep = memo(({ step, isLast }) => {
  const [expanded, setExpanded] = useState(false)
  const tool = toolUI(step.toolName)
  const Icon = tool.icon
  const failed = isFailedStep(step)

  return (
    <div className="flex gap-2 text-sm text-muted-foreground fade-in-0 slide-in-from-top-2 animate-in">
      <div className="relative mt-0.5">
        <Icon className="size-4" />
        {!isLast && <div className="absolute top-7 bottom-0 left-1/2 -mx-px w-px bg-border" />}
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        <button
          type="button"
          className="text-left hover:text-foreground transition-colors"
          onClick={() => step.hasResult && setExpanded(!expanded)}
        >
          {!step.hasResult
            ? <Shimmer duration={1}>{tool.label(step.input, false)}</Shimmer>
            : <>{tool.label(step.input, true)}{failed && <span className="ml-1.5 text-red-400/70">✕</span>}</>}
        </button>
        {expanded && step.output != null && (
          step.toolName === 'subagent' && step.output?.parts
            ? <SubagentOutput parts={step.output.parts} />
            : (
              <pre className="text-xs text-muted-foreground/70 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">
                {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
              </pre>
            )
        )}
      </div>
    </div>
  )
})

export const ThinkingNarrative = memo(({
  narrative,
  isStreaming = false,
  hasResponseText = false,
}) => {
  const hasTools = narrative.some(n => n.type === 'tool')
  const hasActiveTools = narrative.some(n => n.type === 'tool' && !n.hasResult)

  const [isOpen, setIsOpen] = useControllableState({ defaultProp: isStreaming })
  const [duration, setDuration] = useState(undefined)
  const [hasAutoClosed, setHasAutoClosed] = useState(false)
  const startTimeRef = useRef(null)
  const hasEverStreamedRef = useRef(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      hasEverStreamedRef.current = true
      if (startTimeRef.current === null) startTimeRef.current = Date.now()
    } else if (startTimeRef.current !== null) {
      setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S))
      startTimeRef.current = null
    }
  }, [isStreaming])

  useEffect(() => {
    if (isStreaming && !isOpen) setIsOpen(true)
  }, [isStreaming, isOpen, setIsOpen])

  useEffect(() => {
    if (hasEverStreamedRef.current && hasResponseText && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false)
        setHasAutoClosed(true)
      }, AUTO_CLOSE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [hasResponseText, isOpen, setIsOpen, hasAutoClosed])

  const handleOpenChange = useCallback((v) => setIsOpen(v), [setIsOpen])

  const label = useMemo(() => {
    if (isStreaming && hasActiveTools) return <Shimmer duration={1}>Working</Shimmer>
    if (isStreaming && hasTools) return 'Working'
    if (isStreaming) return <Shimmer duration={1}>Thinking...</Shimmer>
    if (duration === undefined) return 'Thought for a while'
    if (duration < 60) return `Thought for ${duration} seconds`
    return `Thought for ${Math.round(duration / 60)} minutes`
  }, [isStreaming, hasTools, hasActiveTools, duration])

  return (
    <Collapsible
      className="not-prose mb-4"
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <BrainIcon className="size-4" />
        {label}
        <ChevronDownIcon className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn(
        "mt-4 space-y-3 select-text",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      )}>
        {narrative.map((item, i) => {
          if (item.type === 'reasoning' || item.type === 'interstitial-text')
            return <p key={i} className="text-sm text-muted-foreground whitespace-pre-wrap">{item.text}</p>
          if (item.type === 'tool') {
            const isLastItem = !narrative.slice(i + 1).some(n => n.type === 'tool')
            return <NarrativeStep key={item.toolCallId} step={item} isLast={isLastItem} />
          }
          return null
        })}
      </CollapsibleContent>
    </Collapsible>
  )
})

ThinkingNarrative.displayName = 'ThinkingNarrative'
NarrativeStep.displayName = 'NarrativeStep'
