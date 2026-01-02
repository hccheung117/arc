import type { Model } from '@arc-types/models'
import { ModelSelector } from '@renderer/features/workbench/model-selector'

interface HeaderProps {
  selectedModel: Model | null
  onModelSelect: (model: Model | null) => void
  models: Model[]
}

/**
 * Chat header with model selector
 */
export function Header({ selectedModel, onModelSelect, models }: HeaderProps) {
  return (
    <header className="flex h-14 items-center border-b border-sidebar-border px-6 shrink-0">
      <ModelSelector
        selectedModel={selectedModel}
        onModelSelect={onModelSelect}
        models={models}
      />
    </header>
  )
}
