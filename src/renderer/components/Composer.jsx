import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input"
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
import { Button } from "@/components/ui/button"
import { BrainIcon, ImageIcon, MicIcon, PencilLine, Sparkles, Wand2 } from "lucide-react"
import { useCallback, useState } from "react"
import { cn } from "@/lib/shadcn"
import { useComposerMode } from "@/contexts/ComposerModeContext"
import { useChatContext } from "@/contexts/ChatContext"
import { useAutogrowLock, ComposerAutogrowLockHandle } from "@/components/ComposerAutogrowLock"
import { useSubscription } from "@/hooks/use-subscription"

const ToolButton = ({ tool, favorites, onToggleFavorite, models }) => {
  const attachments = usePromptInputAttachments()
  switch (tool) {
    case "attach":
      return (
        <PromptInputButton onClick={() => attachments.openFileDialog()}>
          <ImageIcon className="size-4" />
        </PromptInputButton>
      )
    case "model":
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
                        onClick={() => onToggleFavorite(model.id)}
                      />
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
              ))}
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      )
    case "mic":
      return (
        <PromptInputButton>
          <MicIcon className="size-5" />
        </PromptInputButton>
      )
  }
}

const HeaderAction = ({ action, setMode }) => {
  switch (action) {
    case "refine":
      return <Button variant="ghost" size="xs"><Wand2 className="size-3" />Refine</Button>
    case "promote":
      return <Button variant="ghost" size="xs"><Sparkles className="size-3" />Promote</Button>
    case "cancel":
      return <Button variant="ghost" size="xs" onClick={() => setMode("chat")}>Cancel</Button>
  }
}

export default function Composer() {
  const { mode, setMode } = useComposerMode()
  const { sendMessage, status, stop } = useChatContext()
  const { containerRef, isLocked, manualMaxHeight, startResizing, toggleLock } = useAutogrowLock()
  const [favorites, setFavorites] = useState(() => new Set())
  const models = useSubscription('models', [])

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSubmit = (message) => {
    sendMessage({ text: message.text })
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-col px-[var(--content-px)] pb-[var(--content-px)]">
      {/* Part of flex-column chain from App.jsx footerRef → here → form → InputGroup → textarea.
          No top padding — the Handle's height acts as the top inset so all four
          edges of the card sit at equal distance from the viewport/header. */}
      <ComposerAutogrowLockHandle
        onResizeStart={startResizing}
        isLocked={isLocked}
        onToggleLock={toggleLock}
      />
      <PromptInput onSubmit={handleSubmit} accept="image/*" className={cn("rounded-2xl bg-background/50 backdrop-blur transition-shadow", mode.composerShadowClass)}>
        {/* pb-1.5 overrides the block-end variant's pb-3 so the header-to-textarea
            gap matches the textarea-to-footer gap (both 6px from base py-1.5). */}
        {mode.header && (
          <PromptInputHeader className="justify-between pb-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PencilLine className="size-3" />
              <span>{mode.header.title}</span>
            </div>
            <div className="flex items-center gap-0.5">
              {mode.header.actions.map((action) => (
                <HeaderAction key={action} action={action} setMode={setMode} />
              ))}
            </div>
          </PromptInputHeader>
        )}
        <PromptInputBody>
          <PromptInputTextarea
            className="max-h-none"
            placeholder={mode.placeholder}
            style={manualMaxHeight !== undefined ? { maxHeight: manualMaxHeight } : undefined}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {mode.tools.filter((t) => t === "attach").map((t) => <ToolButton key={t} tool={t} favorites={favorites} onToggleFavorite={toggleFavorite} models={models} />)}
          </PromptInputTools>
          <div className={cn("flex items-center gap-1", mode.footerActionsClass)}>
            {mode.tools.filter((t) => t !== "attach").map((t) => <ToolButton key={t} tool={t} favorites={favorites} onToggleFavorite={toggleFavorite} models={models} />)}
            <PromptInputSubmit status={status} onStop={stop} className="ml-1 rounded-full">
              <mode.submitIcon className="size-4" />
            </PromptInputSubmit>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
