import { SquareArrowOutUpRight } from "lucide-react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useComposer, composerActions } from "@/hooks/use-composer"
import { useAppStore } from "@/store/app-store"
import { useSubscription } from "@/hooks/use-subscription"
import { useSession } from "@/contexts/SessionContext"
import { useLLMLock } from '@/hooks/use-llm-lock'
import { SidebarTrigger } from "@/components/ui/sidebar"
import WorkbenchHeader from "@/components/WorkbenchHeader"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message, MessageContent, MessageResponse,
  MessageBranch, MessageBranchSelector,
  MessageBranchPrevious, MessageBranchNext, MessageBranchPage,
  useMessageBranch,
} from "@/components/ai-elements/message"
import { ThinkingNarrative } from "@/components/ThinkingNarrative"
import { narrativeFromParts, isToolPart } from "@/lib/narrative"
import { WaitingShimmer } from "@/components/WaitingShimmer"
import { cn } from "@/lib/shadcn"

const textFromParts = (msg) => {
  const parts = msg.parts
  let lastToolIdx = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isToolPart(parts[i])) { lastToolIdx = i; break }
  }
  return parts.slice(lastToolIdx + 1)
    .filter(p => p.type === 'text')
    .map(p => p.text).join('')
}


const UserMessageContent = ({ msg }) => (
  <MessageContent>
    {msg.parts.some(p => p.type === 'file' && p.mediaType?.startsWith('image/')) && (
      <div className="flex flex-wrap gap-2">
        {msg.parts.filter(p => p.type === 'file' && p.mediaType?.startsWith('image/')).map((p, i) => (
          <img key={i} src={p.url} alt={p.filename || 'Image'} className="max-h-48 rounded-lg object-cover cursor-pointer" onClick={() => window.api.call('message:open-file', { url: p.url })} />
        ))}
      </div>
    )}
    <span className="whitespace-pre-wrap">{textFromParts(msg)}</span>
  </MessageContent>
)

const BranchInit = ({ total }) => {
  const { setBranches } = useMessageBranch()
  useEffect(() => { setBranches(Array(total).fill(null)) }, [total, setBranches])
  return null
}

export default function Workbench({ isPopout }) {
  const { mode, config, setMode } = useComposer()
  const { messages, id: sessionId, branches, switchBranch, prompt, status } = useSession()
  const isDraft = useAppStore((s) => s.draftSessionId === s.activeSessionId)
  const busy = useLLMLock()
  const feed = useSubscription('session:feed', { sessions: [], folders: [] })
  const title = feed.sessions.find(s => s.id === sessionId)?.title
  const popouts = useSubscription('session:popout:feed', [])
  const isPoppedOut = !isPopout && popouts.includes(sessionId)
  const typographySettings = useSubscription('settings:typography', { lineHeight: null })
  const hasPrompt = !!prompt
  useEffect(() => window.api.on('message:edit:start', ({ id, role }) => {
    const sid = useAppStore.getState().activeSessionId
    composerActions.setMode(sid, role === 'assistant' ? 'edit:ai' : 'edit:user', { messageKey: id })
  }), [])

  const handleContextMenu = (e, msg) => {
    e.preventDefault()
    const selection = window.getSelection()?.toString() || ''
    window.api.call('message:context-menu', { sessionId, id: msg.id, role: msg.role, text: textFromParts(msg), selection })
  }

  const handleOpenWorkspace = useCallback(() => {
    window.api.call('session:open-workspace', { sessionId })
  }, [sessionId])

  const handleDownload = useCallback(() => {
    window.api.call('session:export', { sessionId })
  }, [sessionId])

  const handlePopout = useCallback(() => {
    window.api.call('session:popout', { sessionId })
  }, [sessionId])

  if (isPoppedOut) {
    return (
      <div className="relative h-full">
        <header className="sticky top-0 z-10 flex shrink-0 h-(--header-h) items-center px-(--content-px) bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            {!isPopout && <SidebarTrigger />}
            <span className="text-sm font-semibold truncate">{title || "Arc"}</span>
          </div>
        </header>
        <div className="flex items-center justify-center" style={{ height: "calc(100% - var(--header-h))" }}>
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <SquareArrowOutUpRight className="size-8" />
            <p className="text-sm">This chat is open in a separate window</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.api.call('session:popout:focus', { sessionId })}
            >
              Show Window
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <Conversation className="h-full">
        {/* Layout: see docs/ui-chat-viewport-layout.md
            min-h-full (not h-full) so ResizeObserver in StickToBottom fires. */}
        <ConversationContent className="gap-0 p-0 min-h-full">
          <WorkbenchHeader
            isPopout={isPopout}
            title={title}
            mode={mode}
            hasPrompt={hasPrompt}
            onOpenWorkspace={handleOpenWorkspace}
            onPopout={handlePopout}
            onDownload={handleDownload}
            onTogglePrompt={() => setMode(mode === "chat" ? "prompt" : "chat")}
            hasMessages={messages.length > 0}
          />
          {messages.length === 0 && isDraft ? (
            /* Empty-state contract — see docs/ui-chat-viewport-layout.md */
            <div className="flex flex-1 min-h-0 px-(--content-px)">
              <div
                className="grid flex-1 place-items-center"
                style={{
                  paddingTop: "var(--content-px)",
                  paddingBottom: "calc(var(--footer-h) + var(--content-px))",
                }}
              >
                <ConversationEmptyState
                  className="h-auto w-full max-w-lg"
                  description="Messages will appear here as the conversation progresses."
                  icon={<MessageSquareIcon className="size-6" />}
                  title="Start a conversation"
                />
              </div>
            </div>
          ) : (
            /* Message-flow contract — see docs/ui-chat-viewport-layout.md */
            <div
              className="flex flex-1 min-h-0 flex-col gap-6 px-(--content-px) pt-4"
              style={{ paddingBottom: "var(--footer-h)", ...(typographySettings.lineHeight && { lineHeight: 1 + Number(typographySettings.lineHeight) }), ...(typographySettings.fontFamily === "noto-serif" && { fontFamily: '"Noto Serif Variable", "Noto Serif SC Variable", "Noto Serif TC Variable", serif' }) }}
            >
              {(() => {
                const lastMsg = messages.at(-1)
                const waitingForFirstDelta =
                  status === "submitted" ||
                  (status === "streaming" && lastMsg?.role === "assistant"
                    && !textFromParts(lastMsg) && !narrativeFromParts(lastMsg).length)
                const displayMessages = waitingForFirstDelta && status === "streaming"
                  ? messages.slice(0, -1)
                  : messages
                return (<>
                  {displayMessages.map((msg, index) => {
                    const isLastMsg = index === displayMessages.length - 1
                    const msgText = textFromParts(msg)
                    const narrative = msg.role === "assistant" ? narrativeFromParts(msg) : []
                    const isStreaming = isLastMsg && status === "streaming"

                    const assistantContent = (
                      <>
                        {narrative.length > 0 && (
                          <ThinkingNarrative
                            narrative={narrative}
                            isStreaming={isStreaming}
                            hasResponseText={!!msgText}
                          />
                        )}
                        <MessageResponse>{msgText}</MessageResponse>
                      </>
                    )

                    const branch = branches[msg.id]
                    if (branch) {
                      return (
                        <MessageBranch key={msg.id} defaultBranch={branch.index}
                          onBranchChange={(i) => switchBranch(branch.siblings[i])}>
                          <BranchInit total={branch.total} />
                          <Message from={msg.role}
                            onContextMenu={(e) => handleContextMenu(e, msg)}
                            className={cn(msg.id === config.messageKey && "blur-[2px]")}>
                            {msg.role === "assistant"
                              ? assistantContent
                              : <UserMessageContent msg={msg} />
                            }
                          </Message>
                          <MessageBranchSelector className={cn(msg.role === "user" && "ml-auto")}>
                            <MessageBranchPrevious disabled={busy} />
                            <MessageBranchPage />
                            <MessageBranchNext disabled={busy} />
                          </MessageBranchSelector>
                        </MessageBranch>
                      )
                    }
                    return (
                      <Message
                        from={msg.role} key={msg.id}
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                        className={cn(msg.id === config.messageKey && "blur-[2px]")}>
                        {msg.role === "assistant"
                          ? assistantContent
                          : <UserMessageContent msg={msg} />
                        }
                      </Message>
                    )
                  })}
                  {waitingForFirstDelta && (
                    <Message from="assistant">
                      <WaitingShimmer>Waiting...</WaitingShimmer>
                    </Message>
                  )}
                </>)
              })()}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton
          style={{ bottom: "calc(var(--footer-h) + 1rem)" }}
        />
      </Conversation>
    </div>
  )
}
