import { Drama, Download } from "lucide-react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useComposerMode } from "@/contexts/ComposerModeContext"
import { useChatContext } from "@/contexts/ChatContext"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  messagesToMarkdown,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { cn } from "@/lib/shadcn"

const textFromParts = (msg) =>
  msg.parts.filter((p) => p.type === "text").map((p) => p.text).join("")

export default function Workbench() {
  const { modeType, mode, setMode } = useComposerMode()
  const { messages } = useChatContext()

  const handleDownload = useCallback(() => {
    const adapted = messages.map((m) => ({ role: m.role, content: textFromParts(m) }))
    const markdown = messagesToMarkdown(adapted)
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "conversation.md"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [messages])

  return (
    <div className="relative h-full">
      <Conversation className="h-full">
        <ConversationContent className="gap-0 p-0">
          <header className="sticky top-0 z-10 flex h-[var(--header-h)] items-center justify-between px-[var(--content-px)] bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-semibold">Arc AI</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant={modeType === "prompt" ? "default" : "ghost"} size="icon-sm" onClick={() => setMode((prev) => prev === "chat" ? "prompt" : "chat")}><Drama /></Button>
              <Button disabled={messages.length === 0} onClick={handleDownload} variant="ghost" size="icon-sm"><Download /></Button>
            </div>
          </header>
          <div className="flex flex-col gap-6 px-[var(--content-px)] pt-4" style={{ paddingBottom: "var(--footer-h)" }}>
            {messages.length === 0 ? (
              <ConversationEmptyState
                description="Messages will appear here as the conversation progresses."
                icon={<MessageSquareIcon className="size-6" />}
                title="Start a conversation"
              />
            ) : (
              messages.map((msg) => (
                <Message from={msg.role} key={msg.id} onClick={() => setMode(msg.role === "assistant" ? "edit:ai" : "edit:user", { messageKey: msg.id })} className={cn("cursor-pointer", msg.id === mode.messageKey && "blur-[2px]")}>
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
