import { Drama, Download } from "lucide-react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useComposer, composerActions } from "@/hooks/use-composer"
import { useAppStore } from "@/store/app-store"
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
import { cn } from "@/lib/shadcn"

const textFromParts = (msg) =>
  msg.parts.filter((p) => p.type === "text").map((p) => p.text).join("")

const BranchInit = ({ total }) => {
  const { setBranches } = useMessageBranch()
  useEffect(() => { setBranches(Array(total).fill(null)) }, [total, setBranches])
  return null
}

export default function Workbench() {
  const { mode, config, setMode } = useComposer()
  const { messages, id: sessionId, branches, switchBranch, prompt, status } = useSession()
  const hasPrompt = !!prompt
  useEffect(() => window.api.on('message:edit-start', ({ id, role }) => {
    const sid = useAppStore.getState().activeSessionId
    composerActions.setMode(sid, role === 'assistant' ? 'edit:ai' : 'edit:user', { messageKey: id })
  }), [])

  const handleContextMenu = (e, msg) => {
    e.preventDefault()
    if (status !== 'ready') return
    window.api.call('message:context-menu', { id: msg.id, role: msg.role, text: textFromParts(msg) })
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
              <span className="text-sm font-semibold">Arc AI</span>
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
          {messages.length === 0 ? (
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
              {messages.map((msg) => {
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
                          ? <MessageResponse>{textFromParts(msg)}</MessageResponse>
                          : <MessageContent>{textFromParts(msg)}</MessageContent>
                        }
                      </Message>
                      <MessageBranchSelector className={cn(msg.role === "user" && "ml-auto")}>
                        <MessageBranchPrevious disabled={status !== 'ready'} />
                        <MessageBranchPage />
                        <MessageBranchNext disabled={status !== 'ready'} />
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
                      ? <MessageResponse>{textFromParts(msg)}</MessageResponse>
                      : <MessageContent>{textFromParts(msg)}</MessageContent>
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
