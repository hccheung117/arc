import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SpeechInput } from "@/components/ai-elements/speech-input"
import { ImageIcon, PencilLine, Sparkles, SquareIcon, Wand2 } from "lucide-react"
import { cn } from "@/lib/shadcn"
import { useComposer, useComposerMode } from "@/hooks/use-composer"
import { isLLMBusy } from '@/hooks/use-llm-lock'
import { useRefine } from "@/hooks/use-refine"
import { useSession } from "@/contexts/SessionContext"
import { TiptapProvider, useTiptap } from "@/contexts/TiptapContext"
import { useAutogrowLock, ComposerAutogrowLockHandle } from "@/components/ComposerAutogrowLock"
import { useSubscription } from "@/hooks/use-subscription"
import { useAppStore, act } from "@/store/app-store"
import AgentSelectorButton from "@/components/AgentSelectorButton"
import ModelSelectorButton from "@/components/ModelSelectorButton"
import SkillSelectorButton from "@/components/SkillSelectorButton"
import ComposerEditor from "@/components/ComposerEditor"

const ToolButton = ({ tool }) => {
  const tiptap = useTiptap()
  switch (tool) {
    case "skill":
      return <SkillSelectorButton />
    case "agent":
      return <AgentSelectorButton />
    case "attach":
      return (
        <PromptInputButton onClick={() => tiptap?.openFileDialog?.()}>
          <ImageIcon className="size-4" />
        </PromptInputButton>
      )
    case "model":
      return <ModelSelectorButton />
    case "mic":
      return <MicButton />
  }
}

const MicButton = () => {
  const { text, setContent } = useComposer()

  const handleAudioRecorded = useCallback(async (audioBlob) => {
    const audio = await audioBlob.arrayBuffer()
    return await window.api.call('assist:transcribe-audio', { audio })
  }, [])

  const handleTranscriptionChange = useCallback((transcript) => {
    setContent(text ? `${text} ${transcript}` : transcript)
  }, [text, setContent])

  return (
    <SpeechInput
      variant="ghost"
      className="size-8 p-0"
      onAudioRecorded={handleAudioRecorded}
      onTranscriptionChange={handleTranscriptionChange}
    />
  )
}

const HeaderAction = ({ action, onCancel, onRefine, onPromote, isRefining }) => {
  switch (action) {
    case "refine":
      return (
        <Button type="button" variant="ghost" size="xs" onClick={onRefine}>
          {isRefining
            ? <><SquareIcon className="size-3" />Stop</>
            : <><Wand2 className="size-3" />Refine</>}
        </Button>
      )
    case "promote":
      return <Button type="button" variant="ghost" size="xs" onClick={onPromote}><Sparkles className="size-3" />Promote</Button>
    case "cancel":
      return <Button type="button" variant="ghost" size="xs" onClick={onCancel}>Cancel</Button>
  }
}

const ComposerSubmit = ({ status, onStop, text, isRefining, config, mode }) => {
  const hasContent = text.trim().length > 0
  const isLLMMode = mode === 'chat' || mode === 'edit:user'
  const effectiveStatus = isLLMMode ? status : 'ready'
  const busy = isLLMBusy(status)
  return (
    <PromptInputSubmit
      status={effectiveStatus}
      onStop={onStop}
      disabled={isLLMMode ? (!busy && !hasContent) || isRefining : !hasContent || isRefining}
      className="ml-1 rounded-full"
      variant={effectiveStatus !== 'ready' ? 'destructive' : 'default'}
    >
      {effectiveStatus === 'ready' ? <config.submitIcon className="size-4" /> : null}
    </PromptInputSubmit>
  )
}

function BaseComposer({ shadowClass, footerClass }) {
  const { mode, config, text, setContent, submit, setMode } = useComposer()
  const sid = useAppStore((s) => s.activeSessionId)
  const { status, stop } = useSession()
  const { containerRef, isLocked, manualMaxHeight, startResizing, toggleLock } = useAutogrowLock()
  const settings = useSubscription('settings:feed', { assignmentKeys: [] })
  const hasRefine = settings.assignmentKeys.includes('refine-prompt')
  const hasTranscribe = settings.assignmentKeys.includes('transcribe-audio')
  const { isRefining, handleRefine, abort: abortRefine } = useRefine(text, setContent)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoteName, setPromoteName] = useState("")
  const [tiptap, setTiptap] = useState(null)

  const handleSubmit = () => submit(text)
  const handleCancel = () => {
    abortRefine()
    setMode("chat")
  }
  const handlePromote = () => {
    setPromoteName("")
    setPromoteOpen(true)
  }
  const handlePromoteSave = async () => {
    const name = promoteName.trim()
    if (!name) return
    await window.api.call('prompt:commit', { name, content: text })
    await window.api.call('session:link-prompt', { id: sid, promptRef: name })
    act().workbench.update({ promptRef: name })
    setPromoteOpen(false)
    setContent("")
    setMode("chat")
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-col px-[var(--content-px)] pb-[var(--content-px)]">
      {/* Part of flex-column chain from App.jsx footerRef → here → form → InputGroup → editor.
          No top padding — the Handle's height acts as the top inset so all four
          edges of the card sit at equal distance from the viewport/header. */}
      <ComposerAutogrowLockHandle
        onResizeStart={startResizing}
        isLocked={isLocked}
        onToggleLock={toggleLock}
      />
      <TiptapProvider value={tiptap}>
        <PromptInput onSubmit={handleSubmit} className={cn("rounded-2xl bg-background/55 backdrop-blur-md transition-shadow", shadowClass)}>
          {/* pb-1.5 overrides the block-end variant's pb-3 so the header-to-textarea
              gap matches the textarea-to-footer gap (both 6px from base py-1.5). */}
          {config.header && (
            <PromptInputHeader className="justify-between pb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PencilLine className="size-3" />
                <span>{config.header.title}</span>
              </div>
              <div className="flex items-center gap-0.5">
                {config.header.actions
                  .filter((action) => action !== 'refine' || hasRefine)
                  .map((action) => (
                    <HeaderAction key={action} action={action} onCancel={handleCancel} onRefine={handleRefine} onPromote={handlePromote} isRefining={isRefining} />
                  ))}
              </div>
            </PromptInputHeader>
          )}
          <PromptInputBody>
            <ComposerEditor
              key={sid}
              placeholder={config.placeholder}
              readOnly={isRefining}
              onEditorReady={setTiptap}
              style={manualMaxHeight !== undefined ? { maxHeight: manualMaxHeight } : undefined}
              className="max-h-none"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {config.tools.filter((t) => t === "skill" || t === "agent" || t === "attach").map((t) => <ToolButton key={t} tool={t} />)}
            </PromptInputTools>
            <div className={cn("flex items-center gap-1", footerClass)}>
              {config.tools.filter((t) => t !== "attach" && t !== "skill" && t !== "agent" && (t !== "mic" || hasTranscribe)).map((t) => <ToolButton key={t} tool={t} />)}
              <ComposerSubmit status={status} onStop={stop} text={text} isRefining={isRefining} config={config} mode={mode} />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </TiptapProvider>
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Prompt</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Prompt name"
            value={promoteName}
            onChange={(e) => setPromoteName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handlePromoteSave() }}
          />
          <DialogFooter>
            <Button onClick={handlePromoteSave} disabled={!promoteName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
