import { BotMessageSquare } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <BotMessageSquare
        className="text-muted-foreground opacity-20"
        size={128}
        strokeWidth={1.5}
        aria-label="No chat selected"
      />
    </div>
  )
}
