"use client";

import { useEffect, useState, useRef } from "react";
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
import { MenuIcon, SettingsIcon, SendIcon, SearchIcon, Sparkles, ImageIcon, X, AlertCircle } from "lucide-react";
import { ConnectProviderModal } from "@/components/connect-provider-modal";
import { ModelSelector } from "@/components/model-selector";
import { useChatStore } from "@/lib/chat-store";
import { ChatListItem } from "@/components/chat-list-item";
import { Message } from "@/components/message";
import { ImageAttachmentChip } from "@/components/image-attachment-chip";
import { ErrorBanner } from "@/components/error-banner";
import { SearchBar } from "@/components/search-bar";
import type { ImageAttachment } from "@/lib/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useChatAPI } from "@/lib/api/chat-api-provider";

export default function Home() {
  const providerConfigs = useChatStore((state) => state.providerConfigs);
  const { api } = useChatAPI();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4-turbo-preview"); // Default model
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if any provider is enabled
  const hasEnabledProvider = providerConfigs.some((config) => config.enabled);

  // Per-chat search state
  const [searchActive, setSearchActive] = useState(false);
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Global search state (command palette)
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Array<{ message: { id: string; chatId: string; content: string; role: string; createdAt: number }; chatTitle: string }>>([]);

  // Sidebar search state
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  // Chat store
  const chats = useChatStore((state) => state.chats);
  
  // Filter chats based on sidebar search
  const filteredChats = sidebarSearchQuery.trim()
    ? chats.filter(chat => 
        chat.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
      )
    : chats;
  const activeChatId = useChatStore((state) => state.activeChatId);
  const streamingChatId = useChatStore((state) => state.streamingChatId);
  const createChat = useChatStore((state) => state.createChat);
  const selectChat = useChatStore((state) => state.selectChat);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const getActiveChatMessages = useChatStore((state) => state.getActiveChatMessages);

  const messages = getActiveChatMessages();
  const isStreaming = streamingChatId === activeChatId;

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimate average message height
    overscan: 5, // Render 5 extra items above/below viewport
  });

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    if (messages.length > 0 && isStreaming) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "smooth" });
    }
  }, [messages.length, isStreaming, virtualizer]);


  // Keyboard shortcuts: Cmd/Ctrl+K for command palette, Cmd/Ctrl+F for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchActive((prev) => !prev);
        // Clear search when closing
        if (searchActive) {
          setSearchMatches([]);
          setCurrentMatchIndex(0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchActive]);

  // Image attachment handlers
  const validateImage = (file: File): string | null => {
    // Check file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return `Invalid file type. Only PNG, JPEG, and WebP images are supported.`;
    }

    // Check file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return `File size exceeds 10MB limit. "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
    }

    return null;
  };

  const addImageAttachment = (file: File) => {
    const error = validateImage(file);
    if (error) {
      setAttachmentError(error);
      return;
    }

    // Clear any previous errors
    setAttachmentError("");

    // Create object URL for preview
    const objectUrl = URL.createObjectURL(file);
    const attachment: ImageAttachment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      objectUrl,
      size: file.size,
      type: file.type,
    };

    setAttachedImages((prev) => [...prev, attachment]);
  };

  const removeImageAttachment = (id: string) => {
    setAttachedImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) {
        // Revoke object URL to prevent memory leak
        URL.revokeObjectURL(removed.objectUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(addImageAttachment);

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    files.filter((file) => file.type.startsWith("image/")).forEach(addImageAttachment);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          addImageAttachment(file);
        }
      }
    }
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachedImages.forEach((img) => {
        URL.revokeObjectURL(img.objectUrl);
      });
    };
  }, [attachedImages]);

  // Search handlers
  const handleSearch = async (query: string) => {
    if (!query.trim() || !activeChatId) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    try {
      const results = await api.search(query, activeChatId);
      const messageIds = results.map((result) => result.message.id);
      setSearchMatches(messageIds);
      setCurrentMatchIndex(messageIds.length > 0 ? 1 : 0);

      // Scroll to first match
      if (messageIds.length > 0) {
        const firstMatchIndex = messages.findIndex((msg) => msg.id === messageIds[0]);
        if (firstMatchIndex !== -1) {
          virtualizer.scrollToIndex(firstMatchIndex, { align: "center", behavior: "smooth" });
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchMatches([]);
      setCurrentMatchIndex(0);
    }
  };

  const handleSearchNext = () => {
    if (searchMatches.length === 0) return;

    const nextIndex = currentMatchIndex % searchMatches.length;
    setCurrentMatchIndex(nextIndex + 1);

    const messageId = searchMatches[nextIndex];
    if (messageId) {
      const msgIndex = messages.findIndex((msg) => msg.id === messageId);
      if (msgIndex !== -1) {
        virtualizer.scrollToIndex(msgIndex, { align: "center", behavior: "smooth" });
      }
    }
  };

  const handleSearchPrevious = () => {
    if (searchMatches.length === 0) return;

    const prevIndex = currentMatchIndex - 2;
    const wrappedIndex = prevIndex < 0 ? searchMatches.length - 1 : prevIndex;
    setCurrentMatchIndex(wrappedIndex + 1);

    const messageId = searchMatches[wrappedIndex];
    if (messageId) {
      const msgIndex = messages.findIndex((msg) => msg.id === messageId);
      if (msgIndex !== -1) {
        virtualizer.scrollToIndex(msgIndex, { align: "center", behavior: "smooth" });
      }
    }
  };

  const handleSearchClose = () => {
    setSearchActive(false);
    setSearchMatches([]);
    setCurrentMatchIndex(0);
  };

  // Global search handler (for command palette)
  useEffect(() => {
    if (!globalSearchQuery.trim()) {
      setGlobalSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await api.search(globalSearchQuery); // No chatId = global search
        setGlobalSearchResults(results);
      } catch (error) {
        console.error("Global search error:", error);
        setGlobalSearchResults([]);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [globalSearchQuery, api]);

  const handleGlobalSearchResultClick = async (result: typeof globalSearchResults[0]) => {
    // Close command palette
    setCommandPaletteOpen(false);
    setGlobalSearchQuery("");
    setGlobalSearchResults([]);

    // Switch to the chat containing this message
    if (result.message.chatId !== activeChatId) {
      selectChat(result.message.chatId);
      // Wait for chat to load
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Scroll to the message
    const messageIndex = messages.findIndex(msg => msg.id === result.message.id);
    if (messageIndex !== -1) {
      virtualizer.scrollToIndex(messageIndex, { align: "center", behavior: "smooth" });
    }
  };

  const handleSendMessage = () => {
    const trimmedMessage = messageInput.trim();
    if ((!trimmedMessage && attachedImages.length === 0) || !hasEnabledProvider || isStreaming) {
      return;
    }

    // Send message with attachments (if any)
    // TODO: Update to use selectedModel once API integration is complete
    sendMessage(trimmedMessage || " ", attachedImages);

    // Clear input and attachments
    setMessageInput("");
    setAttachedImages([]);
    setAttachmentError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to get accurate scrollHeight
    textarea.style.height = "auto";
    
    // Calculate new height (max 10 lines)
    const lineHeight = 20; // approximate line height in pixels
    const maxHeight = lineHeight * 10;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    
    textarea.style.height = `${newHeight}px`;
  }, [messageInput]);

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
            {/* Search input */}
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search chats..."
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
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
              {filteredChats.map((chat) => (
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
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="border-b h-14 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3 ml-10 md:ml-0">
            <h1 className="text-lg font-semibold">Arc</h1>
            <ModelSelector
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={!hasEnabledProvider || isStreaming}
            />
          </div>
          <Link href="/settings">
            <Button variant="ghost" size="icon" title="Settings">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </Link>
        </header>

        {/* Search Bar */}
        {searchActive && (
          <SearchBar
            onSearch={handleSearch}
            matchCount={searchMatches.length}
            currentMatch={currentMatchIndex}
            onNext={handleSearchNext}
            onPrevious={handleSearchPrevious}
            onClose={handleSearchClose}
          />
        )}

        {/* Message panel */}
        <div
          ref={parentRef}
          className="flex-1 overflow-auto"
          style={{ position: 'relative' }}
        >
          {messages.length > 0 ? (
            // Virtualized message list
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              <div className="max-w-3xl mx-auto p-4 md:p-6">
                <ErrorBanner />
              </div>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const message = messages[virtualItem.index];
                if (!message) return null;

                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
                      <Message
                        message={message}
                        isLatestAssistant={message.id === lastAssistantMessage?.id}
                        isHighlighted={searchMatches.includes(message.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !hasEnabledProvider ? (
            // Empty state when no provider is configured
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold">Welcome to Arc</h2>
                <p className="text-muted-foreground">
                  To get started, configure an AI provider in settings. Your API key is stored locally and never leaves your device.
                </p>
                <Link href="/settings">
                  <Button>Open Settings</Button>
                </Link>
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
        </div>

        {/* Composer bar */}
        <div
          className="border-t p-4 bg-background"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="space-y-3 px-2 md:px-4">
            {/* Error banner */}
            {attachmentError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
                <AlertCircle className="size-4 text-destructive flex-shrink-0" />
                <p className="text-destructive flex-1">{attachmentError}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAttachmentError("")}
                  className="size-5 p-0 hover:bg-destructive/20"
                  aria-label="Dismiss error"
                >
                  <X className="size-3" />
                </Button>
              </div>
            )}

            {/* Preview chips */}
            {attachedImages.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {attachedImages.map((attachment) => (
                  <ImageAttachmentChip
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() => removeImageAttachment(attachment.id)}
                  />
                ))}
              </div>
            )}

            {/* Input area */}
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              aria-hidden="true"
            />

            {/* Unified input container with inline buttons - full width */}
            <div className="flex items-end gap-1 px-3 py-2 border rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring transition-shadow">
                {/* Attachment button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 hover:bg-accent"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!hasEnabledProvider || isStreaming}
                  aria-label="Attach image"
                >
                  <ImageIcon className="size-4" />
                </Button>

                {/* Message input - multiline textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder={
                    !hasEnabledProvider
                      ? "Configure a provider in settings first..."
                      : isStreaming
                        ? "Waiting for response..."
                        : "Type a message..."
                  }
                  className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-y-auto py-1"
                  aria-label="Message input"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={!hasEnabledProvider || isStreaming}
                />

                {/* Send button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 hover:bg-accent disabled:opacity-30"
                  aria-label="Send message"
                  onClick={handleSendMessage}
                  disabled={
                    !hasEnabledProvider ||
                    isStreaming ||
                    (!messageInput.trim() && attachedImages.length === 0)
                  }
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search Across All Chats</DialogTitle>
            <DialogDescription>
              Find messages in any conversation
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
            <SearchIcon className="size-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              className="border-0 shadow-none focus-visible:ring-0 px-0"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Search Results */}
          {globalSearchResults.length > 0 && (
            <ScrollArea className="max-h-96">
              <div className="space-y-2 pr-4">
                {globalSearchResults.map((result) => {
                  const preview = result.message.content.slice(0, 100);
                  const timestamp = new Date(result.message.createdAt).toLocaleString();

                  return (
                    <button
                      key={result.message.id}
                      onClick={() => handleGlobalSearchResultClick(result)}
                      className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {result.chatTitle}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {timestamp}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2 text-foreground">
                        {preview}{result.message.content.length > 100 ? "..." : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Empty state */}
          {globalSearchQuery && globalSearchResults.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No messages found matching &quot;{globalSearchQuery}&quot;
            </div>
          )}

          {!globalSearchQuery && (
            <div className="text-sm text-muted-foreground">
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-xs">
                Esc
              </kbd>{" "}
              to close
            </div>
          )}
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
