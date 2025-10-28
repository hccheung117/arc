import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
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
  chats,
  activeChatId,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  onSelectChat,
  onCreateChat,
  onRenameChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Filter chats based on sidebar search
  const filteredChats = sidebarSearchQuery.trim()
    ? chats.filter((chat) =>
        chat.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
      )
    : chats;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 p-2">
          <SidebarTrigger />
          {!isCollapsed && (
            <span className="text-sm font-semibold">Chats</span>
          )}
        </div>

        {!isCollapsed && (
          <div className="px-2 pb-2 space-y-3">
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
        )}

        {isCollapsed && (
          <div className="flex justify-center pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={onCreateChat}
                >
                  <Sparkles className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{keyboardShortcuts.newChat.description} ({keyboardShortcuts.newChat.label})</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1">
          <div className="p-2" role="list" aria-label="Chat history">
            {!isCollapsed && filteredChats.map((chat) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
