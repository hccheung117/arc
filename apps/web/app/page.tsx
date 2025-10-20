"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MenuIcon, SettingsIcon, SendIcon, SearchIcon, Sparkles } from "lucide-react";
import { ConnectProviderModal } from "@/components/connect-provider-modal";
import { useApp } from "@/lib/app-context";
import { useChatStore } from "@/lib/chat-store";
import { ChatListItem } from "@/components/chat-list-item";
import { Message } from "@/components/message";

export default function Home() {
  const { providerConfig, hasCompletedFirstRun, isHydrated } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");

  // Chat store
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const streamingChatId = useChatStore((state) => state.streamingChatId);
  const createChat = useChatStore((state) => state.createChat);
  const selectChat = useChatStore((state) => state.selectChat);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const seedDemoChats = useChatStore((state) => state.seedDemoChats);
  const getActiveChatMessages = useChatStore((state) => state.getActiveChatMessages);

  const messages = getActiveChatMessages();
  const isStreaming = streamingChatId === activeChatId;

  // Initialize with demo chats whenever empty (development)
  useEffect(() => {
    if (isHydrated && chats.length === 0) {
      seedDemoChats();
    }
  }, [isHydrated, chats.length, seedDemoChats]);

  // Auto-open provider modal on first run
  useEffect(() => {
    if (isHydrated && !hasCompletedFirstRun && !providerConfig) {
      setProviderModalOpen(true);
    }
  }, [isHydrated, hasCompletedFirstRun, providerConfig]);

  // Keyboard shortcut: Cmd/Ctrl+K to open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSendMessage = () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || !providerConfig || isStreaming) {
      return;
    }

    sendMessage(trimmedMessage);
    setMessageInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Find the last assistant message for regenerate detection
  const lastAssistantMessage = messages
    .filter((msg) => msg.role === "assistant")
    .pop();

  return (
    <div className="flex h-screen">
      {/* Mobile menu button - visible only on <md */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-background border hover:bg-accent"
        aria-label="Toggle sidebar"
      >
        <MenuIcon className="size-5" />
      </button>

      {/* Sidebar */}
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
          {/* Sidebar header */}
          <div className="p-4 border-b border-sidebar-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-sidebar-foreground">
                Chats
              </h2>
            </div>
            <Link href="/new" className="block" onClick={() => setSidebarOpen(false)}>
              <Button variant="outline" className="w-full" size="sm">
                <Sparkles className="size-4 mr-2" />
                New Chat
              </Button>
            </Link>
          </div>

          {/* Chat list */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {chats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === activeChatId}
                  onClick={() => {
                    selectChat(chat.id);
                    setSidebarOpen(false);
                  }}
                />
              ))}
            </div>
          </ScrollArea>

          {/* Sidebar footer */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-mono text-xs">
                ⌘K
              </kbd>{" "}
              to search
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="border-b h-14 flex items-center justify-between px-4 md:px-6">
          <h1 className="text-lg font-semibold ml-10 md:ml-0">Arc</h1>
          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="Settings">
              <SettingsIcon className="size-5" />
            </Button>
          </Link>
        </header>

        {/* Message panel */}
        <ScrollArea className="flex-1 overflow-hidden">
          {messages.length > 0 ? (
            // Show messages if they exist (demo chats or real conversations)
            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8">
              {messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  isLatestAssistant={message.id === lastAssistantMessage?.id}
                />
              ))}
            </div>
          ) : !providerConfig ? (
            // Empty state when no provider is configured
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold">Welcome to Arc</h2>
                <p className="text-muted-foreground">
                  To get started, connect an AI provider. Your API key is stored locally and never leaves your device.
                </p>
                <Button onClick={() => setProviderModalOpen(true)}>
                  Connect Provider
                </Button>
              </div>
            </div>
          ) : (
            // Empty state when chat has no messages but provider is configured
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md text-center space-y-2">
                <p className="text-muted-foreground">No messages yet</p>
                <p className="text-sm text-muted-foreground">
                  Start a conversation below
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Composer bar */}
        <div className="border-t p-4 bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Input
                placeholder={
                  !providerConfig
                    ? "Connect a provider first..."
                    : isStreaming
                      ? "Waiting for response..."
                      : "Type a message..."
                }
                className="flex-1"
                aria-label="Message input"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!providerConfig || isStreaming}
              />
              <Button
                size="icon"
                aria-label="Send message"
                onClick={handleSendMessage}
                disabled={!providerConfig || isStreaming || !messageInput.trim()}
              >
                <SendIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Command Palette */}
      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Command Palette</DialogTitle>
            <DialogDescription>
              Quick search and navigation (placeholder)
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
            <SearchIcon className="size-4 text-muted-foreground" />
            <Input
              placeholder="Search chats, commands..."
              className="border-0 shadow-none focus-visible:ring-0 px-0"
              autoFocus
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-xs">
              Esc
            </kbd>{" "}
            to close
          </div>
        </DialogContent>
      </Dialog>

      {/* Connect Provider Modal */}
      <ConnectProviderModal
        open={providerModalOpen}
        onOpenChange={setProviderModalOpen}
      />
    </div>
  );
}
