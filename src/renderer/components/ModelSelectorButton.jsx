import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorFavorite,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector"
import { PromptInputButton } from "@/components/ai-elements/prompt-input"
import { useActiveWorkbench, act } from "@/store/app-store"
import { BrainIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useSubscription } from "@/hooks/use-subscription"

export default function ModelSelectorButton() {
  const [open, setOpen] = useState(false)
  const [favorites, setFavorites] = useState(() => new Set())
  const models = useSubscription('model:feed', {})
  const state = useSubscription('state:feed', {})
  const { modelId } = useActiveWorkbench()
  const effectiveModelId = modelId ?? state.lastUsedModel

  const selectedName = useMemo(() => {
    for (const group of Object.values(models)) {
      const found = group.models.find((m) => m.id === effectiveModelId)
      if (found) return found.name
    }
    return null
  }, [models, effectiveModelId])

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectModel = useCallback((providerId, id) => {
    act().workbench.update({ providerId, modelId: id })
    window.api.call('state:set', { lastUsedProvider: providerId, lastUsedModel: id })
    setOpen(false)
  }, [])

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <PromptInputButton>
          <BrainIcon className="size-4" />
          <span>{selectedName ?? "Model"}</span>
        </PromptInputButton>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList className="min-h-[300px]">
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {Object.entries(models).map(([providerId, group]) => (
            <ModelSelectorGroup key={providerId} heading={group.name}>
              {group.models.map((model) => (
                <ModelSelectorItem key={model.id} value={model.id} onSelect={() => selectModel(providerId, model.id)}>
                  <ModelSelectorLogo provider={providerId} />
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                  <ModelSelectorFavorite
                    active={favorites.has(model.id)}
                    onClick={() => toggleFavorite(model.id)}
                  />
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  )
}
