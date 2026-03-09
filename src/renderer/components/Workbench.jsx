import { Drama, Download } from "lucide-react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useComposer, composerActions } from "@/hooks/use-composer"
import { useAppStore } from "@/store/app-store"
import { useSubscription } from "@/hooks/use-subscription"
import { useSession } from "@/contexts/SessionContext"
import { SidebarTrigger } from "@/components/ui/sidebar"
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
import {
  Reasoning, ReasoningContent, ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { cn } from "@/lib/shadcn"

const textFromParts = (msg) =>
  msg.parts.filter((p) => p.type === "text").map((p) => p.text).join("")

const reasoningFromParts = (msg) =>
  msg.parts.filter((p) => p.type === "reasoning").map((p) => p.text).join("\n\n")

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

export default function Workbench() {
  const { mode, config, setMode } = useComposer()
  const { messages, id: sessionId, branches, switchBranch, prompt, status, flags } = useSession()
  const isDraft = useAppStore((s) => s.draftSessionId === s.activeSessionId)
  const feed = useSubscription('session:feed', { sessions: [], folders: [] })
  const title = feed.sessions.find(s => s.id === sessionId)?.title
  const hasPrompt = !!prompt
  useEffect(() => window.api.on('message:edit:start', ({ id, role }) => {
    const sid = useAppStore.getState().activeSessionId
    composerActions.setMode(sid, role === 'assistant' ? 'edit:ai' : 'edit:user', { messageKey: id })
  }), [])

  const handleContextMenu = (e, msg) => {
    e.preventDefault()
    if (!flags.canEditMessages) return
    window.api.call('message:context-menu', { sessionId, id: msg.id, role: msg.role, text: textFromParts(msg) })
  }

  const handleDownload = useCallback(() => {
    window.api.call('session:export', { sessionId })
  }, [sessionId])

  return (
    <div className="relative h-full">
      <Conversation className="h-full">
        {/* Layout: see docs/ui-chat-viewport-layout.md
            min-h-full (not h-full) so ResizeObserver in StickToBottom fires. */}
        <ConversationContent className="gap-0 p-0 min-h-full">
          <header className="sticky top-0 z-10 flex shrink-0 h-(--header-h) items-center justify-between px-(--content-px) bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-semibold truncate">{title || "Arc"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={mode === "prompt" ? "default" : "ghost"}
                size="icon-sm"
                className="relative"
                onClick={() => setMode(mode === "chat" ? "prompt" : "chat")}
              >
                <Drama />
                {hasPrompt && mode !== "prompt" && (
                  <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-primary" />
                )}
              </Button>
              <Button disabled={messages.length === 0} onClick={handleDownload} variant="ghost" size="icon-sm"><Download /></Button>
            </div>
          </header>
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
              style={{ paddingBottom: "var(--footer-h)" }}
            >
              {messages.map((msg, index) => {
                const isLastMsg = index === messages.length - 1
                const reasoningText = msg.role === "assistant" ? reasoningFromParts(msg) : ""
                const isReasoningStreaming = isLastMsg && status === "streaming"
                  && msg.parts.at(-1)?.type === "reasoning"

                const assistantContent = (
                  <>
                    {reasoningText && (
                      <Reasoning isStreaming={isReasoningStreaming}>
                        <ReasoningTrigger />
                        <ReasoningContent>{reasoningText}</ReasoningContent>
                      </Reasoning>
                    )}
                    <MessageResponse>{textFromParts(msg)}</MessageResponse>
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
                        <MessageBranchPrevious disabled={!flags.canEditMessages} />
                        <MessageBranchPage />
                        <MessageBranchNext disabled={!flags.canEditMessages} />
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
