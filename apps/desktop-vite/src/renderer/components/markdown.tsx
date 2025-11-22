import { memo, useEffect, useId, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { BundledLanguage } from 'shiki'
import { codeToHtml } from 'shiki/bundle/web'

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
        className="not-prose"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    )
  }

  return (
    <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-4 text-label">
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
  const [highlight, setHighlight] = useState<{ key: string; html: string } | null>(null)
  const match = /language-(\w+)/.exec(normalizedClassName || '')
  const lang = match?.[1] as BundledLanguage | undefined
  const code = rawCode.replace(/\n$/, '')
  const highlightKey =
    isBlock && !isMermaid && lang && code ? `${lang}:${code}` : null

  useEffect(() => {
    if (!highlightKey || !lang) {
      return
    }

    let isMounted = true

    codeToHtml(code, {
      lang,
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    })
      .then((highlighted) => {
        if (isMounted) {
          setHighlight({ key: highlightKey, html: highlighted })
        }
      })
      .catch(() => {
        if (isMounted) {
          setHighlight(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [code, highlightKey, lang])

  // Inline code stays inline
  if (!isBlock) {
    return <code className={normalizedClassName}>{children}</code>
  }

  if (isBlock && isMermaid) {
    return <MermaidDiagram code={code} />
  }

  // Block code without language (no syntax highlighting)
  if (!lang) {
    return (
      <pre>
        <code className={normalizedClassName}>{code}</code>
      </pre>
    )
  }

  // Syntax highlighted code block
  if (highlightKey && highlight?.key === highlightKey) {
    return <div dangerouslySetInnerHTML={{ __html: highlight.html }} />
  }

  // Loading state
  return (
    <pre>
      <code className={normalizedClassName}>{code}</code>
    </pre>
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
          code: CodeBlock,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
