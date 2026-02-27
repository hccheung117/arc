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
import { useComposerMode, act, useActiveWorkbench } from "@/store/app-store"
import { useSession } from "@/contexts/SessionContext"
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

const HeaderAction = ({ action }) => {
  switch (action) {
    case "refine":
      return <Button variant="ghost" size="xs"><Wand2 className="size-3" />Refine</Button>
    case "promote":
      return <Button variant="ghost" size="xs"><Sparkles className="size-3" />Promote</Button>
    case "cancel":
      return <Button variant="ghost" size="xs" onClick={() => act().composer.setMode("chat")}>Cancel</Button>
  }
}

function BaseComposer({ mode, config, shadowClass, footerClass }) {
  const { sendMessage, status, stop } = useSession()
  const { containerRef, isLocked, manualMaxHeight, startResizing, toggleLock } = useAutogrowLock()
  const [favorites, setFavorites] = useState(() => new Set())
  const models = useSubscription('model:listen', [])
  const workbench = useActiveWorkbench()
  const draft = workbench.composerDrafts[mode] ?? ""

  const handleDraftChange = useCallback((e) => {
    act().composer.setDraft(mode, e.target.value)
  }, [mode])

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
    // Submit protocol: clear draft text, then retire the draft session.
    act().composer.setDraft(mode, "")
    act().session.retireDraft()
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
      <PromptInput onSubmit={handleSubmit} accept="image/*" className={cn("rounded-2xl bg-background/50 backdrop-blur transition-shadow", shadowClass)}>
        {/* pb-1.5 overrides the block-end variant's pb-3 so the header-to-textarea
            gap matches the textarea-to-footer gap (both 6px from base py-1.5). */}
        {config.header && (
          <PromptInputHeader className="justify-between pb-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PencilLine className="size-3" />
              <span>{config.header.title}</span>
            </div>
            <div className="flex items-center gap-0.5">
              {config.header.actions.map((action) => (
                <HeaderAction key={action} action={action} />
              ))}
            </div>
          </PromptInputHeader>
        )}
        <PromptInputBody>
          <PromptInputTextarea
            className="max-h-none"
            placeholder={config.placeholder}
            value={draft}
            onChange={handleDraftChange}
            style={manualMaxHeight !== undefined ? { maxHeight: manualMaxHeight } : undefined}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {config.tools.filter((t) => t === "attach").map((t) => <ToolButton key={t} tool={t} favorites={favorites} onToggleFavorite={toggleFavorite} models={models} />)}
          </PromptInputTools>
          <div className={cn("flex items-center gap-1", footerClass)}>
            {config.tools.filter((t) => t !== "attach").map((t) => <ToolButton key={t} tool={t} favorites={favorites} onToggleFavorite={toggleFavorite} models={models} />)}
            <PromptInputSubmit status={status} onStop={stop} className="ml-1 rounded-full">
              <config.submitIcon className="size-4" />
            </PromptInputSubmit>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

function ChatComposer({ mode, config }) {
  return <BaseComposer mode={mode} config={config}
    shadowClass="shadow-[0_4px_30px_rgba(0,0,0,0.3)]" />
}

function PromptComposer({ mode, config }) {
  return <BaseComposer mode={mode} config={config}
    shadowClass="shadow-[0_3px_20px_rgba(255,0,0,0.3)]" footerClass="ml-auto" />
}

export default function Composer() {
  const { mode, config } = useComposerMode()
  const Variant = mode === "prompt" ? PromptComposer : ChatComposer
  return <Variant mode={mode} config={config} />
}
