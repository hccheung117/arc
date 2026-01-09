import { Download } from 'lucide-react'
import type { Model } from '@arc-types/models'
import { Button } from '@renderer/components/ui/button'
import { ModelSelector } from '@renderer/features/workbench/model-selector'

interface HeaderProps {
  selectedModel: Model | null
  onModelSelect: (model: Model | null) => void
  models: Model[]
  onExport: () => void
  canExport: boolean
}

/**
 * Chat header with model selector and export button
 */
export function Header({ selectedModel, onModelSelect, models, onExport, canExport }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-sidebar-border px-6 shrink-0">
      <ModelSelector
        selectedModel={selectedModel}
        onModelSelect={onModelSelect}
        models={models}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onExport}
        disabled={!canExport}
        title="Export chat to markdown"
      >
        <Download className="h-4 w-4" />
      </Button>
    </header>
  )
}
