import { BotMessageSquare } from 'lucide-react'

/**
 * EmptyState: Visual indicator for empty chat
 *
 * Simple visual-only component shown when a chat has no messages.
 * Used inside ChatView's empty messages case.
 */
export function EmptyState() {
  return (
    <BotMessageSquare
      className="text-muted-foreground opacity-20"
      size={128}
      strokeWidth={1.5}
      aria-label="Start a new chat"
    />
  )
}
