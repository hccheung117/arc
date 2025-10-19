"use client";

import { useEffect, useState } from "react";
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
import { MenuIcon, SettingsIcon, SendIcon, SearchIcon } from "lucide-react";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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

  // Placeholder chat list items
  const placeholderChats = [
    { id: 1, title: "Getting Started with Arc", timestamp: "2 hours ago" },
    { id: 2, title: "React Best Practices", timestamp: "Yesterday" },
    { id: 3, title: "TypeScript Tips", timestamp: "2 days ago" },
    { id: 4, title: "UI Design Discussion", timestamp: "1 week ago" },
  ];

  // Placeholder messages
  const placeholderMessages = [
    { id: 1, role: "user", content: "Hello! How do I get started?" },
    {
      id: 2,
      role: "assistant",
      content:
        "Welcome to Arc! You can start by asking me anything. I'm here to help with your questions and tasks.",
    },
    { id: 3, role: "user", content: "What can you help me with?" },
    {
      id: 4,
      role: "assistant",
      content:
        "I can assist with coding, writing, analysis, and much more. Try asking me a specific question or give me a task to work on.",
    },
  ];

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
          <div className="p-4 border-b border-sidebar-border">
            <h2 className="text-sm font-semibold text-sidebar-foreground">
              Chats
            </h2>
          </div>

          {/* Chat list */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {placeholderChats.map((chat) => (
                <button
                  key={chat.id}
                  className="w-full text-left p-3 rounded-md hover:bg-accent/50 transition-colors mb-1"
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="text-sm font-medium text-sidebar-foreground truncate">
                    {chat.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {chat.timestamp}
                  </div>
                </button>
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
          <Button variant="ghost" size="icon" aria-label="Settings">
            <SettingsIcon className="size-5" />
          </Button>
        </header>

        {/* Message panel */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
            {placeholderMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <div className="text-sm">{message.content}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Composer bar */}
        <div className="border-t p-4 bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                className="flex-1"
                aria-label="Message input"
              />
              <Button size="icon" aria-label="Send message">
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
    </div>
  );
}
