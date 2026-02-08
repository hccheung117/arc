import { Download, Drama } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ModelSelector } from './model-selector'

/**
 * Chat header with model selector and export button
 */
export function Header({
  selectedModel,
  onModelSelect,
  models,
  onExport,
  canExport,
  onEditSystemPrompt,
  hasSystemPrompt,
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-sidebar-border px-6 shrink-0">
      <ModelSelector
        selectedModel={selectedModel}
        onModelSelect={onModelSelect}
        models={models}
      />
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEditSystemPrompt}
          title="Edit system prompt"
        >
          <Drama className={`h-4 w-4 ${hasSystemPrompt ? 'text-blue-500' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onExport}
          disabled={!canExport}
          title="Export chat to markdown"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
