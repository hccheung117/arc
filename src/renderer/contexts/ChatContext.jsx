import { createContext, use, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { IpcChatTransport } from "@/lib/ipc-chat-transport"

const ChatContext = createContext()

export const useChatContext = () => use(ChatContext)

export function ChatProvider({ children }) {
  const transport = useMemo(() => new IpcChatTransport(), [])
  const chat = useChat({ transport })

  return (
    <ChatContext value={chat}>
      {children}
    </ChatContext>
  )
}
