import { Drama, Download } from "lucide-react"
import { MessageSquareIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  messagesToMarkdown,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"

const messages = [
  { content: "Hello, how are you?", key: nanoid(), role: "user" },
  { content: "I'm good, thank you! How can I assist you today?", key: nanoid(), role: "assistant" },
  { content: "I'm looking for information about your services.", key: nanoid(), role: "user" },
  { content: "Sure! We offer a variety of AI solutions. What are you interested in?", key: nanoid(), role: "assistant" },
  { content: "I'm interested in natural language processing tools.", key: nanoid(), role: "user" },
  { content: "Great choice! We have several NLP APIs. Would you like a demo?", key: nanoid(), role: "assistant" },
  { content: "Yes, a demo would be helpful.", key: nanoid(), role: "user" },
  { content: "Alright, I can show you a sentiment analysis example. Ready?", key: nanoid(), role: "assistant" },
  { content: "Yes, please proceed.", key: nanoid(), role: "user" },
  { content: "Here is a sample: 'I love this product!' → Positive sentiment.", key: nanoid(), role: "assistant" },
  { content: "Impressive! Can it handle multiple languages?", key: nanoid(), role: "user" },
  { content: "Absolutely, our models support over 20 languages.", key: nanoid(), role: "assistant" },
  { content: "How do I get started with the API?", key: nanoid(), role: "user" },
  { content: "You can sign up on our website and get an API key instantly.", key: nanoid(), role: "assistant" },
  { content: "Is there a free trial available?", key: nanoid(), role: "user" },
  { content: "Yes, we offer a 14-day free trial with full access.", key: nanoid(), role: "assistant" },
  { content: "What kind of support do you provide?", key: nanoid(), role: "user" },
  { content: "We provide 24/7 chat and email support for all users.", key: nanoid(), role: "assistant" },
  { content: "Thank you for the information!", key: nanoid(), role: "user" },
  { content: "You're welcome! Let me know if you have any more questions.", key: nanoid(), role: "assistant" },
]

export default function Workbench() {
  const [visibleMessages, setVisibleMessages] = useState([])

  const handleDownload = useCallback(() => {
    const markdown = messagesToMarkdown(visibleMessages)
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "conversation.md"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [visibleMessages])

  useEffect(() => {
    let currentIndex = 0
    let interval
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        if (currentIndex < messages.length && messages[currentIndex]) {
          const msg = messages[currentIndex]
          setVisibleMessages((prev) => [...prev, { content: msg.content, key: msg.key, role: msg.role }])
          currentIndex += 1
        } else {
          clearInterval(interval)
        }
      }, 1000)
    }, 3000)
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [])

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
              <Button variant="ghost" size="icon-sm"><Drama /></Button>
              <Button disabled={visibleMessages.length === 0} onClick={handleDownload} variant="ghost" size="icon-sm"><Download /></Button>
            </div>
          </header>
          <div className="flex flex-col gap-6 px-[var(--content-px)] pt-4" style={{ paddingBottom: "var(--footer-h)" }}>
            {visibleMessages.length === 0 ? (
              <ConversationEmptyState
                description="Messages will appear here as the conversation progresses."
                icon={<MessageSquareIcon className="size-6" />}
                title="Start a conversation"
              />
            ) : (
              visibleMessages.map(({ key, content, role }) => (
                <Message from={role} key={key}>
                  <MessageContent>{content}</MessageContent>
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
