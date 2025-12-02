import { memo, useEffect, useId, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Check, Copy } from 'lucide-react'

interface MarkdownProps {
  children: string
}

type CodeProps = {
  node?: {
    position?: {
      start?: { line?: number }
      end?: { line?: number }
    }
  }
  className?: string | string[]
  children?: React.ReactNode
}

type MermaidDiagramProps = {
  code: string
}

function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const diagramId = useId().replace(/[:]/g, '')

  useEffect(() => {
    let isMounted = true

    async function renderDiagram() {
      try {
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
        })
        const result = await mermaid.render(`mermaid-${diagramId}`, code)
        if (isMounted) {
          setSvg(result.svg)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setSvg(null)
          setError(
            err instanceof Error ? err.message : 'Failed to render diagram'
          )
        }
      }
    }

    renderDiagram()

    return () => {
      isMounted = false
    }
  }, [code, diagramId])

  if (svg) {
    return (
      <div
        className="not-prose my-6 flex justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    )
  }

  return (
    <pre className="not-prose overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-4 text-label">
      <code>
        {error
          ? `Mermaid render error: ${error}\n\n${code}`
          : code}
      </code>
    </pre>
  )
}

function CodeBlock({ node, className, children }: CodeProps) {
  const rawCode = String(children ?? '')
  const normalizedClassName = Array.isArray(className)
    ? className.join(' ')
    : className
  const isMultilineNode =
    typeof node?.position?.start?.line === 'number' &&
    typeof node?.position?.end?.line === 'number' &&
    node.position.start.line !== node.position.end.line
  const isBlock = isMultilineNode || /\n/.test(rawCode)
  const isMermaid = normalizedClassName
    ?.split(/\s+/)
    .some((token) => token === 'language-mermaid')
  const match = /language-(\w+)/.exec(normalizedClassName || '')
  const lang = match?.[1]
  const code = rawCode.replace(/\n$/, '')

  // Copy functionality
  const [isCopied, setIsCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [code])

  // Inline code stays inline
  if (!isBlock) {
    return <code className={normalizedClassName}>{children}</code>
  }

  if (isBlock && isMermaid) {
    return <MermaidDiagram code={code} />
  }

  const languageLabel = lang || 'text'

  /**
   * Code Block Layout Strategy:
   * 
   * Uses CSS Grid on the outer wrapper to constrain children to the container width.
   * Grid cells naturally respect their parent's width, preventing the <pre> element
   * from expanding beyond the viewport. Combined with min-w-0 on the pre, this
   * allows overflow-x-auto to create a horizontal scrollbar within bounds.
   * 
   * This is more robust than flex-based solutions which require min-w-0 at every
   * level of the hierarchy.
   */
  return (
    <div className="not-prose relative my-6 grid rounded-lg border border-border bg-muted">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase select-none">
          {languageLabel}
        </span>
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
      </div>

      {/* Code content - grid child auto-constrained, pre scrolls horizontally */}
      <pre className="overflow-x-auto min-w-0 m-0! p-4!">
        <code className={normalizedClassName}>
          {code}
        </code>
      </pre>
    </div>
  )
}

export const Markdown = memo(function Markdown({ children }: MarkdownProps) {
  return (
    /**
     * Typography: Uses prose with body size (16px/24px) for readable markdown content.
     * The prose plugin configuration is defined in tailwind.config.js with semantic
     * color tokens and the body font size. AI-generated responses and formatted content
     * benefit from slightly larger, more comfortable reading text.
     *
     * @see tailwind.config.js - Typography scale and prose configuration
     */
    <div className="prose max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Unwrap default pre so we can handle it in CodeBlock
          pre: ({ children }) => <>{children}</>,
          code: CodeBlock,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
