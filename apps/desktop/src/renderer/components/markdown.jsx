import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './markdown-code-block'

/**
 * Renders markdown content with GitHub Flavored Markdown support.
 *
 * Typography: Uses prose with body size (16px/24px) for readable markdown content.
 * The prose plugin configuration is defined in tailwind.config.js with semantic
 * color tokens and the body font size. AI-generated responses and formatted content
 * benefit from slightly larger, more comfortable reading text.
 *
 * @see tailwind.config.js - Typography scale and prose configuration
 */
export const Markdown = memo(function Markdown({ children }) {
  return (
    <div className="prose max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: CodeBlock,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
