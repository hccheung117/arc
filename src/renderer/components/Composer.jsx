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
import { Button } from "@/components/ui/button"
import { ImageIcon, MicIcon, PencilLine, Sparkles, Wand2 } from "lucide-react"
import { cn } from "@/lib/shadcn"
import { useComposer, useComposerMode } from "@/hooks/use-composer"
import { useSession } from "@/contexts/SessionContext"
import { useAutogrowLock, ComposerAutogrowLockHandle } from "@/components/ComposerAutogrowLock"
import ModelSelectorButton from "@/components/ModelSelectorButton"

const ToolButton = ({ tool }) => {
  const attachments = usePromptInputAttachments()
  switch (tool) {
    case "attach":
      return (
        <PromptInputButton onClick={() => attachments.openFileDialog()}>
          <ImageIcon className="size-4" />
        </PromptInputButton>
      )
    case "model":
      return <ModelSelectorButton />
    case "mic":
      return (
        <PromptInputButton>
          <MicIcon className="size-5" />
        </PromptInputButton>
      )
  }
}

const HeaderAction = ({ action, onCancel }) => {
  switch (action) {
    case "refine":
      return <Button variant="ghost" size="xs"><Wand2 className="size-3" />Refine</Button>
    case "promote":
      return <Button variant="ghost" size="xs"><Sparkles className="size-3" />Promote</Button>
    case "cancel":
      return <Button variant="ghost" size="xs" onClick={onCancel}>Cancel</Button>
  }
}

function BaseComposer({ shadowClass, footerClass }) {
  const { mode, config, value, updateDraft, submit, setMode } = useComposer()
  const { status, stop } = useSession()
  const { containerRef, isLocked, manualMaxHeight, startResizing, toggleLock } = useAutogrowLock()

  const handleDraftChange = (e) => updateDraft(e.target.value)
  const handleSubmit = (message) => submit(message.text)
  const handleCancel = () => setMode("chat")

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
                <HeaderAction key={action} action={action} onCancel={handleCancel} />
              ))}
            </div>
          </PromptInputHeader>
        )}
        <PromptInputBody>
          <PromptInputTextarea
            className="max-h-none"
            placeholder={config.placeholder}
            value={value}
            onChange={handleDraftChange}
            style={manualMaxHeight !== undefined ? { maxHeight: manualMaxHeight } : undefined}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {config.tools.filter((t) => t === "attach").map((t) => <ToolButton key={t} tool={t} />)}
          </PromptInputTools>
          <div className={cn("flex items-center gap-1", footerClass)}>
            {config.tools.filter((t) => t !== "attach").map((t) => <ToolButton key={t} tool={t} />)}
            <PromptInputSubmit
              status={status}
              onStop={stop}
              disabled={status === "ready" && !value.trim()}
              className="ml-1 rounded-full"
              variant={status !== "ready" ? "destructive" : "default"}
            >
              {status === "ready" ? <config.submitIcon className="size-4" /> : null}
            </PromptInputSubmit>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

function ChatComposer() {
  return <BaseComposer shadowClass="shadow-[0_4px_30px_rgba(0,0,0,0.3)]" />
}

function PromptComposer() {
  return <BaseComposer shadowClass="shadow-[0_3px_20px_rgba(255,0,0,0.3)]" footerClass="ml-auto" />
}

export default function Composer() {
  const mode = useComposerMode()
  const Variant = mode === "prompt" ? PromptComposer : ChatComposer
  return <Variant />
}
