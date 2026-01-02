import { useEffect, useId, useState } from 'react'

interface MermaidDiagramProps {
  code: string
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
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
      <code>{error ? `Mermaid render error: ${error}\n\n${code}` : code}</code>
    </pre>
  )
}

