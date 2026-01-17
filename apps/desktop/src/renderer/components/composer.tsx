import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Textarea } from '@renderer/components/ui/textarea'
import { ImagePlus, Send, Square, Pencil, Sparkles, Wand2, Save, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { AttachmentInput } from '@contracts/messages'
import { useComposerStore } from '@renderer/hooks/use-composer-store'
import { startRefine, stopAIChat, onAIEvent } from '@renderer/lib/messages'
import { AttachmentGrid } from './composer-attachments'

/*
  UX Decision: Always-Enabled Composer

  This component does NOT accept a `disabled` prop. The composer remains interactive at all
  times, allowing users to type freely without artificial blocking states.

  Protection is a behavior, not a disability. When editing a protected system prompt:
  - Visual overlay indicates read-only status
  - Input and send are blocked
  - The composer still renders; it simply prevents modification
*/

/*
  ComposerMode: What is the composer for right now?

  Mode determines UI behavior (tool buttons, action icon). Streaming is orthogonal—
  it overlays any mode with a stop button while AI responds.
*/
export type ComposerMode =
  | { type: 'chat' }
  | { type: 'edit-message' }
  | { type: 'edit-system-prompt'; protected: boolean }

export interface ComposerProps {
  threadId: string
  mode?: ComposerMode
  onSend?: (message: string, attachments?: AttachmentInput[]) => void | Promise<void>
  onStop?: () => void
  isStreaming?: boolean
  isEditing?: boolean
  onCancelEdit?: () => void
  editingLabel?: string
  allowEmptySubmit?: boolean
  onPromote?: () => void
  refineModel?: string
}

type RefineState =
  | { status: 'idle' }
  | { status: 'refining'; streamId: string; original: string }

export interface ComposerRef {
  setMessage: (message: string) => void
  focus: () => void
}

const DEFAULT_MODE: ComposerMode = { type: 'chat' }

const MASK_PATTERN = Array.from({ length: 120 }, (_, i) => '•'.repeat((i % 7) + 5))

function ProtectedPromptOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md overflow-hidden bg-background/20">
      <div className="absolute inset-0 p-4 text-xs leading-loose text-muted-foreground select-none blur-[4px] opacity-60 break-all pointer-events-none flex flex-wrap content-start gap-1">
        {MASK_PATTERN.map((text, i) => (
          <span key={i}>{text}</span>
        ))}
      </div>
      <span className="relative z-20 text-sm font-medium text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] select-none">
        Protected Persona
      </span>
    </div>
  )
}

export const Composer = forwardRef<ComposerRef, ComposerProps>(
  ({ threadId, mode = DEFAULT_MODE, onSend, onStop, isStreaming, isEditing, onCancelEdit, editingLabel, allowEmptySubmit, onPromote, refineModel }, ref) => {
    const [isDragging, setIsDragging] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [refineState, setRefineState] = useState<RefineState>({ status: 'idle' })

    const isSystemPromptProtected = mode.type === 'edit-system-prompt' && mode.protected
    const isRefining = refineState.status === 'refining'

    const {
      draft: message,
      attachments,
      hasAttachments,
      setDraft: setMessage,
      addFiles,
      removeAttachment,
      clear,
      toAttachmentInputs,
    } = useComposerStore(threadId)

    useImperativeHandle(ref, () => ({
      setMessage: (text: string) => {
        setMessage(text)
      },
      focus: () => {
        textareaRef.current?.focus()
      },
    }))

    // Auto-resize textarea - grows naturally without cap (flex container constrains)
    useEffect(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [message])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files)
        e.target.value = ''
      }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      const imageFiles: File[] = []

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        addFiles(imageFiles)
      }
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files)
      }
    }

    const handleSend = async () => {
      const hasContent = message.trim() || hasAttachments
      if (!hasContent && !allowEmptySubmit) return
      if (!onSend || isStreaming) return

      const messageToSend = message.trim()
      const attachmentInputs = hasAttachments ? await toAttachmentInputs() : undefined

      await onSend(messageToSend, attachmentInputs)
      setMessage('')
      clear()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (canSend) handleSend()
      }
    }

    // Refine handlers
    const handleRefine = async () => {
      if (!refineModel || isRefining || !message.trim()) return

      const original = message
      setMessage('')

      try {
        const { streamId } = await startRefine(original, refineModel)
        setRefineState({ status: 'refining', streamId, original })
      } catch {
        setMessage(original)
        setRefineState({ status: 'idle' })
      }
    }

    const handleRefineCancel = () => {
      if (refineState.status !== 'refining') return

      stopAIChat(refineState.streamId)
      setMessage(refineState.original)
      setRefineState({ status: 'idle' })
    }

    // Refine stream subscription
    const refineBufferRef = useRef('')
    useEffect(() => {
      if (refineState.status !== 'refining') return

      refineBufferRef.current = ''
      const unsubscribe = onAIEvent((event) => {
        if (event.streamId !== refineState.streamId) return

        switch (event.type) {
          case 'delta':
            refineBufferRef.current += event.chunk
            setMessage(refineBufferRef.current)
            break
          case 'complete':
            setRefineState({ status: 'idle' })
            break
          case 'error':
            setMessage(refineState.original)
            setRefineState({ status: 'idle' })
            break
        }
      })

      return unsubscribe
    }, [refineState, setMessage])

    const canSend = (message.trim() || hasAttachments || allowEmptySubmit) && !isStreaming && !isSystemPromptProtected && !isRefining

    return (
      <Card
        className={`flex flex-col min-h-0 p-3 border transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : isEditing
              ? 'border-primary ring-1 ring-primary'
              : 'border-sidebar-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isEditing && (
          <div className="flex items-center justify-between mb-0 px-1 shrink-0">
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              <Pencil className="h-3 w-3" />
              {editingLabel ?? 'Editing message'}
            </span>
            <div className="flex items-center gap-2">
              {refineModel && !isSystemPromptProtected && (
                <button
                  onClick={isRefining ? handleRefineCancel : handleRefine}
                  disabled={!isRefining && !message.trim()}
                  className="text-xs font-medium text-purple-500 hover:text-purple-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefining ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3 w-3" />
                      Refine
                    </>
                  )}
                </button>
              )}
              {onPromote && !isSystemPromptProtected && (
                <button
                  onClick={onPromote}
                  disabled={isRefining}
                  className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  Promote
                </button>
              )}
              <button
                onClick={onCancelEdit}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col min-h-0 gap-2 relative">
          {isSystemPromptProtected && <ProtectedPromptOverlay />}
          <AttachmentGrid attachments={attachments} onRemove={removeAttachment} />

          <Textarea
            ref={textareaRef}
            value={isSystemPromptProtected ? '' : message}
            disabled={isSystemPromptProtected}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isSystemPromptProtected ? '' : 'Enter here, press ↵ to send'}
            className={`min-h-0 resize-none border-0 p-0 text-body focus-visible:ring-0 focus-visible:ring-offset-0 outline-none shadow-none overflow-y-auto ${
              isSystemPromptProtected ? 'opacity-0' : ''
            }`}
            rows={isSystemPromptProtected ? 3 : 1}
          />

          <div className="flex items-center justify-between shrink-0">
            {/* Tool buttons: mode-aware rendering */}
            <div className="flex gap-1">
              {mode.type !== 'edit-system-prompt' && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {/* Action button: streaming overlays any mode with stop */}
            {isStreaming ? (
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8 rounded-full"
                onClick={onStop}
              >
                <Square className="h-3 w-3 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleSend}
                disabled={!canSend}
              >
                {mode.type === 'edit-system-prompt' ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  },
)
Composer.displayName = 'Composer'
