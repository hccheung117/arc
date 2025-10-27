import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchIcon, Sparkles } from "lucide-react";
import { ChatListItem } from "@/components/chat-list-item";
import { keyboardShortcuts } from "@/lib/keyboard-shortcuts";
import type { Chat } from "@arc/core/core.js";

interface ChatSidebarProps {
  sidebarOpen: boolean;
  chats: Chat[];
  activeChatId: string | null;
  sidebarSearchQuery: string;
  setSidebarSearchQuery: (query: string) => void;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatSidebar({
  sidebarOpen,
  chats,
  activeChatId,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  onSelectChat,
  onCreateChat,
  onRenameChat,
  onDeleteChat,
}: ChatSidebarProps) {
  // Filter chats based on sidebar search
  const filteredChats = sidebarSearchQuery.trim()
    ? chats.filter((chat) =>
        chat.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
      )
    : chats;

  return (
    <aside
      className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 border-r bg-sidebar border-sidebar-border
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-sidebar-border space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search chats..."
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              className="pl-8 h-9"
              aria-label="Search chats"
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={onCreateChat}
              >
                <Sparkles className="size-4 mr-2" />
                New Chat
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{keyboardShortcuts.newChat.description} ({keyboardShortcuts.newChat.label})</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2" role="list" aria-label="Chat history">
            {filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
                onClick={() => onSelectChat(chat.id)}
                onRename={onRenameChat}
                onDelete={onDeleteChat}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
