"use client";

import { useState, useEffect } from "react";
import { codeToHtml } from "shiki";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  code: string;
  language: string;
  inline?: boolean;
}

export function CodeBlock({ code, language, inline = false }: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
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

  // Highlight code with Shiki
  useEffect(() => {
    if (inline) {
      // Don't highlight inline code, just wrap it
      setHighlightedCode(`<code>${escapeHtml(code)}</code>`);
      return;
    }

    const highlight = async () => {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: isDark ? "github-dark" : "github-light",
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error("Failed to highlight code:", error);
        // Fallback to plain code
        setHighlightedCode(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
    };

    highlight();
  }, [code, language, inline, isDark]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  // Inline code rendering
  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono text-[0.875em]"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    );
  }

  // Block code rendering
  return (
    <div className="group relative my-4">
      {/* Language badge and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-border rounded-t-lg">
        <span className="text-xs font-mono text-muted-foreground uppercase">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 gap-1.5 text-xs"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code content */}
      <div
        className="overflow-x-auto rounded-b-lg [&>pre]:m-0 [&>pre]:p-4 [&>pre]:rounded-none [&>pre]:bg-transparent"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}

// Utility to escape HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
