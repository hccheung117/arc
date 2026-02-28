import { Drama, Download } from "lucide-react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useComposerMode, act } from "@/store/app-store"
import { useSession } from "@/contexts/SessionContext"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { cn } from "@/lib/shadcn"

const textFromParts = (msg) =>
  msg.parts.filter((p) => p.type === "text").map((p) => p.text).join("")

export default function Workbench() {
  const { mode, config } = useComposerMode()
  const { messages, id: sessionId } = useSession()
  useEffect(() => window.api.on('message:edit-start', ({ id, role }) => {
    act().composer.setMode(role === 'assistant' ? 'edit:ai' : 'edit:user', { messageKey: id })
  }), [])

  const handleContextMenu = (e, msg) => {
    e.preventDefault()
    window.api.call('message:context-menu', { id: msg.id, role: msg.role, text: textFromParts(msg) })
  }

  const handleDownload = useCallback(() => {
    window.api.call('session:export', { sessionId })
  }, [sessionId])

  return (
    <div className="relative h-full">
      <Conversation className="h-full">
        {/* min-h-full (not h-full): StickToBottom.Content wraps this in a
            scrollRef div and puts a ResizeObserver on the contentRef (this
            element). With h-full the element never changes size, so the
            observer never fires and auto-scroll-to-bottom breaks. min-h-full
            lets it grow with content while still providing a floor for
            empty-state centering.  See conversation.jsx for the wrapper. */}
        <ConversationContent className="gap-0 p-0 min-h-full">
          <header className="sticky top-0 z-10 flex shrink-0 h-[var(--header-h)] items-center justify-between px-[var(--content-px)] bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-semibold">Arc AI</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant={mode === "prompt" ? "default" : "ghost"} size="icon-sm" onClick={() => act().composer.setMode(mode === "chat" ? "prompt" : "chat")}><Drama /></Button>
              <Button disabled={messages.length === 0} onClick={handleDownload} variant="ghost" size="icon-sm"><Download /></Button>
            </div>
          </header>
          {/* flex-1: fills remaining space when content < viewport, so the
              empty state can center vertically.
              paddingBottom (--footer-h): clears the composer overlay; the
              var is set by the ResizeObserver in App.jsx. */}
          <div className="flex flex-1 min-h-0 flex-col gap-6 px-[var(--content-px)] pt-4" style={{ paddingBottom: "var(--footer-h)" }}>
            {messages.length === 0 ? (
              <ConversationEmptyState
                description="Messages will appear here as the conversation progresses."
                icon={<MessageSquareIcon className="size-6" />}
                title="Start a conversation"
              />
            ) : (
              messages.map((msg) => (
                <Message 
                from={msg.role} key={msg.id} 
                onClick={() => act().composer.setMode(msg.role === "assistant" ? "edit:ai" : "edit:user", { messageKey: msg.id })} 
                onContextMenu={(e) => handleContextMenu(e, msg)} 
                className={cn("cursor-pointer", msg.id === config.messageKey && "blur-[2px]")}>
                  {msg.role === "assistant"
                    ? <MessageResponse>{textFromParts(msg)}</MessageResponse>
                    : <MessageContent>{textFromParts(msg)}</MessageContent>
                  }
                </Message>
              ))
            )}
          </div>
        </ConversationContent>
        <ConversationScrollButton
          style={{ bottom: "calc(var(--footer-h) + 1rem)" }}
        />
      </Conversation>
    </div>
  )
}
