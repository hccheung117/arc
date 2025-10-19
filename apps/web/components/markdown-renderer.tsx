"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { CodeBlock } from "./code-block";
import { MermaidDiagram } from "./mermaid-diagram";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    // Code blocks
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      const language = (match?.[1] ?? "text") as string;
      const codeString = String(children).replace(/\n$/, "");
      const inline = !className;

      // Special handling for Mermaid diagrams
      if (language === "mermaid") {
        return <MermaidDiagram chart={codeString} />;
      }

      return <CodeBlock code={codeString} language={language} inline={inline} />;
    },

    // Links
    a({ children, href, ...props }) {
      return (
        <a
          href={href}
          className="text-primary underline hover:text-primary/80 transition-colors"
          target={href?.startsWith("http") ? "_blank" : undefined}
          rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },

    // Paragraphs
    p({ children, ...props }) {
      return (
        <p className="mb-4 last:mb-0 leading-relaxed" {...props}>
          {children}
        </p>
      );
    },

    // Headings
    h1({ children, ...props }) {
      return (
        <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0" {...props}>
          {children}
        </h1>
      );
    },
    h2({ children, ...props }) {
      return (
        <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0" {...props}>
          {children}
        </h2>
      );
    },
    h3({ children, ...props }) {
      return (
        <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0" {...props}>
          {children}
        </h3>
      );
    },
    h4({ children, ...props }) {
      return (
        <h4 className="text-base font-semibold mb-2 mt-3 first:mt-0" {...props}>
          {children}
        </h4>
      );
    },

    // Lists
    ul({ children, ...props }) {
      return (
        <ul className="list-disc list-inside mb-4 space-y-1" {...props}>
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal list-inside mb-4 space-y-1" {...props}>
          {children}
        </ol>
      );
    },
    li({ children, ...props }) {
      return (
        <li className="leading-relaxed" {...props}>
          {children}
        </li>
      );
    },

    // Blockquotes
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="border-l-4 border-primary/30 pl-4 py-2 my-4 italic text-muted-foreground"
          {...props}
        >
          {children}
        </blockquote>
      );
    },

    // Tables
    table({ children, ...props }) {
      return (
        <div className="my-4 overflow-x-auto">
          <table className="min-w-full border-collapse border border-border" {...props}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children, ...props }) {
      return (
        <thead className="bg-secondary" {...props}>
          {children}
        </thead>
      );
    },
    th({ children, ...props }) {
      return (
        <th className="border border-border px-4 py-2 text-left font-semibold" {...props}>
          {children}
        </th>
      );
    },
    td({ children, ...props }) {
      return (
        <td className="border border-border px-4 py-2" {...props}>
          {children}
        </td>
      );
    },

    // Horizontal rule
    hr(props) {
      return <hr className="my-6 border-border" {...props} />;
    },

    // Strikethrough (from GFM)
    del({ children, ...props }) {
      return (
        <del className="text-muted-foreground" {...props}>
          {children}
        </del>
      );
    },
  };

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
