"use client";

import { useEffect, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);

  // Detect theme changes
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    // Initial theme
    updateTheme();

    // Watch for theme changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;

    const renderDiagram = async () => {
      setIsLoading(true);
      setError("");

      try {
        // Dynamically import mermaid
        const { default: mermaidAPI } = await import("mermaid");

        // Initialize mermaid with theme
        mermaidAPI.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
          fontFamily: "inherit",
        });

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;

        // Render the diagram
        const { svg: renderedSvg } = await mermaidAPI.render(id, chart);

        if (mounted) {
          setSvg(renderedSvg);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setIsLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      mounted = false;
    };
  }, [chart, isDark]);

  if (error) {
    return (
      <div className="my-4 p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-sm text-destructive font-semibold mb-2">Mermaid Diagram Error</p>
        <pre className="text-xs text-destructive/80 overflow-x-auto">
          <code>{error}</code>
        </pre>
        <details className="mt-2">
          <summary className="text-xs text-destructive/60 cursor-pointer">Show diagram source</summary>
          <pre className="mt-2 text-xs text-destructive/60 overflow-x-auto">
            <code>{chart}</code>
          </pre>
        </details>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="my-4 p-8 border rounded-lg bg-secondary animate-pulse">
        <div className="h-48 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Rendering diagram...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="my-4 p-4 border rounded-lg bg-secondary overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
