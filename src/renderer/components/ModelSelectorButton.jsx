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
import { BrainIcon } from "lucide-react"
import { useCallback, useState } from "react"
import { useSubscription } from "@/hooks/use-subscription"

export default function ModelSelectorButton() {
  const [favorites, setFavorites] = useState(() => new Set())
  const models = useSubscription('model:listen', [])

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <ModelSelector>
      <ModelSelectorTrigger asChild>
        <PromptInputButton>
          <BrainIcon className="size-4" />
          <span>Model</span>
        </PromptInputButton>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList className="min-h-[300px]">
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {models.map((group) => (
            <ModelSelectorGroup key={group.provider} heading={group.provider}>
              {group.models.map((model) => (
                <ModelSelectorItem key={model.id} value={model.id}>
                  <ModelSelectorLogo provider={group.providerId} />
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
