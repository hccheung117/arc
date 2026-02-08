import { useState, useCallback } from 'react'
import { Check, Copy } from 'lucide-react'
import { MermaidDiagram } from './markdown-mermaid'

// Types

// Parsing utilities

function normalizeClassName(className) {
  if (!className) return ''
  return Array.isArray(className) ? className.join(' ') : className
}

function extractLanguage(className) {
  const match = /language-(\w+)/.exec(className)
  return match?.[1]
}

function hasLanguageToken(className, token) {
  return className.split(/\s+/).includes(token)
}

/**
 * Determines if code spans multiple lines.
 *
 * Two heuristics combined:
 * 1. AST position data (reliable when available from remark)
 * 2. Newline check (fallback for edge cases where position is missing)
 */
function isMultiline(
  node,
  code
) {
  const position = node?.position
  const hasPositionData =
    typeof position?.start?.line === 'number' &&
    typeof position?.end?.line === 'number'

  if (hasPositionData) {
    return position.start.line !== position.end.line
  }

  return code.includes('\n')
}

function determineVariant(
  node,
  className,
  code
) {
  if (!isMultiline(node, code)) {
    return 'inline'
  }
  if (hasLanguageToken(className, 'language-mermaid')) {
    return 'mermaid'
  }
  return 'block'
}

// Copy button

const COPY_FEEDBACK_DURATION_MS = 2000

function CopyButton({ code }) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), COPY_FEEDBACK_DURATION_MS)
  }, [code])

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
    >
      {isCopied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

// Renderers

function InlineCode({
  className,
  children,
}) {
  return <code className={className || undefined}>{children}</code>
}

/**
 * Code Block Layout Strategy:
 *
 * Uses CSS Grid on the outer wrapper to constrain children to the container width.
 * Grid cells naturally respect their parent's width, preventing the <pre> element
 * from expanding beyond the viewport. Combined with min-w-0 on the pre, this
 * allows overflow-x-auto to create a horizontal scrollbar within bounds.
 */
function BlockCode({
  language,
  className,
  code,
}) {
  return (
    <div className="not-prose relative my-6 grid rounded-lg border border-border bg-muted">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase select-none">
          {language}
        </span>
        <CopyButton code={code} />
      </div>

      <pre className="overflow-x-auto min-w-0 m-0! p-4!">
        <code className={className || undefined}>{code}</code>
      </pre>
    </div>
  )
}

// Main component

export function CodeBlock({ node, className, children }) {
  const rawCode = String(children ?? '')
  const normalizedClassName = normalizeClassName(className)
  const code = rawCode.replace(/\n$/, '')
  const variant = determineVariant(node, normalizedClassName, rawCode)

  switch (variant) {
    case 'inline':
      return <InlineCode className={normalizedClassName}>{children}</InlineCode>

    case 'mermaid':
      return <MermaidDiagram code={code} />

    case 'block':
      return (
        <BlockCode
          language={extractLanguage(normalizedClassName) ?? 'text'}
          className={normalizedClassName}
          code={code}
        />
      )
  }
}
