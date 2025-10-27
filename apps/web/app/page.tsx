"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MenuIcon, SettingsIcon, SendIcon, SearchIcon, Sparkles, ImageIcon, X, AlertCircle } from "lucide-react";
import { ModelSelector } from "@/components/model-selector";
import { ChatListItem } from "@/components/chat-list-item";
import { Message } from "@/components/message";
import { ModelSwitchDivider } from "@/components/model-switch-divider";
import { ImageAttachmentChip } from "@/components/image-attachment-chip";
import { SearchBar } from "@/components/search-bar";
import { PinnedMessagesBar } from "@/components/pinned-messages-bar";
import { AdvancedComposerControls } from "@/components/advanced-composer-controls";
import {
  NoProvidersState,
  NoMessagesState,
  NoGlobalSearchResultsState,
} from "@/components/empty-states";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCore } from "@/lib/core-provider";
import { useUIStore } from "@/lib/ui-store";
import { useModels } from "@/lib/use-models";
import { toast } from "sonner";
import { keyboardShortcuts } from "@/lib/keyboard-shortcuts";
import { classifyError, TOAST_DURATION } from "@/lib/error-handler";
import type { Chat, Message as CoreMessage, ImageAttachment, ProviderConfig, SearchResult } from "@arc/core/core.js";

export default function Home() {
  const core = useCore();

  // UI state from Zustand
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  // Data state from Core
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<CoreMessage[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Model loading
  const { groupedModels, isLoading: modelsLoading, errors: modelErrors, getErrorDetails, refetch: refetchModels } = useModels();

  // UI state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<{ modelId: string; providerId: string } | null>(null);
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search state
  const [searchActive, setSearchActive] = useState(false);
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[]>([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  // Pinned messages state
  const [pinnedMessages, setPinnedMessages] = useState<CoreMessage[]>([]);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);

  // Advanced composer controls state
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [systemPromptOverride, setSystemPromptOverride] = useState("");

  // Check if any provider is configured
  const hasProvider = providers.length > 0;

  // Filter chats based on sidebar search
  const filteredChats = sidebarSearchQuery.trim()
    ? chats.filter(chat =>
        chat.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
      )
    : chats;

  const isStreaming = streamingChatId === activeChatId;

  // Create synthetic error messages for model loading failures
  const modelErrorMessages: CoreMessage[] = Array.from(modelErrors.keys()).map((providerId) => {
    const errorDetails = getErrorDetails(providerId);
    const content = errorDetails
      ? `**Failed to load models from ${errorDetails.providerName}**\n\n${errorDetails.userMessage}`
      : `**Failed to load models**\n\nAn unexpected error occurred.`;

    return {
      id: `error-models-${providerId}`,
      chatId: activeChatId || "",
      role: "assistant" as const,
      content,
      status: "error" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  // Combine real messages with error messages (errors at the end)
  const allMessages = [...messages, ...modelErrorMessages];

  // Handlers - defined early to avoid dependency issues
  const handleCreateChat = useCallback(async () => {
    try {
      // Create pending chat (will be persisted on first message)
      core.chats.create({ title: "New Chat" });

      // For now, we'll just refresh the chat list
      // The actual chat will be created when the first message is sent
      const chatList = await core.chats.list();
      setChats(chatList);

      setSidebarOpen(false);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  }, [core]);

  // Build enhanced display list with model switch dividers
  type DisplayItem =
    | { type: "message"; message: CoreMessage; index: number }
    | { type: "divider"; model: string | undefined; providerConnectionId: string | undefined; index: number };

  const displayItems: DisplayItem[] = [];
  let lastModel: string | undefined;
  let lastProviderId: string | undefined;

  allMessages.forEach((message, index) => {
    // Check if model changed (only for assistant messages)
    const currentModel = message.model;
    const currentProviderId = message.providerConnectionId;
    const isModelChange =
      message.role === "assistant" &&
      index > 0 && // Not the first message
      (currentModel !== lastModel || currentProviderId !== lastProviderId) &&
      (currentModel || currentProviderId); // Has model info

    // Insert divider if model changed
    if (isModelChange) {
      displayItems.push({
        type: "divider",
        model: currentModel,
        providerConnectionId: currentProviderId,
        index: displayItems.length,
      });
    }

    // Add the message
    displayItems.push({
      type: "message",
      message,
      index: displayItems.length,
    });

    // Update last model tracking (only for assistant messages with model info)
    if (message.role === "assistant" && (currentModel || currentProviderId)) {
      lastModel = currentModel;
      lastProviderId = currentProviderId;
    }
  });

  const displayMessages = displayItems;

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [chatList, providerList] = await Promise.all([
          core.chats.list(),
          core.providers.list(),
        ]);

        setChats(chatList);
        setProviders(providerList);

        // Auto-select first chat if available
        if (chatList.length > 0 && !activeChatId) {
          setActiveChatId(chatList[0]!.id);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };

    void loadData();
  }, [core]);

  // Subscribe to title-updated events for reactive auto-titling
  useEffect(() => {
    const handleTitleUpdated = (event: { chatId: string; title: string }) => {
      // Update the chat title in the UI state
      setChats(prevChats =>
        prevChats.map(chat =>
          chat.id === event.chatId
            ? { ...chat, title: event.title }
            : chat
        )
      );
    };

    // Subscribe to the event
    core.chats.on("title-updated", handleTitleUpdated);

    // Cleanup: unsubscribe when component unmounts
    return () => {
      core.chats.off("title-updated", handleTitleUpdated);
    };
  }, [core]);

  // Set default model when models load
  useEffect(() => {
    if (!selectedModel && groupedModels.length > 0) {
      const firstGroup = groupedModels[0];
      if (firstGroup && firstGroup.models.length > 0) {
        const firstModel = firstGroup.models[0];
        if (firstModel) {
          setSelectedModel({
            modelId: firstModel.id,
            providerId: firstGroup.providerId,
          });
        }
      }
    }
  }, [groupedModels, selectedModel]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setPinnedMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const chatData = await core.chats.get(activeChatId);
        if (chatData) {
          setMessages(chatData.messages);
        }

        // Load pinned messages
        const pinned = await core.messages.getPinnedMessages(activeChatId);
        setPinnedMessages(pinned);

        // Auto-focus message input for better keyboard navigation
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    void loadMessages();
  }, [activeChatId, core]);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (displayMessages.length > 0 && isStreaming) {
      virtualizer.scrollToIndex(displayMessages.length - 1, { align: "end", behavior: "smooth" });
    }
  }, [displayMessages.length, isStreaming, virtualizer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette (Cmd+K)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // In-chat Search (Cmd+F)
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchActive((prev) => !prev);
        if (searchActive) {
          setSearchMatches([]);
          setCurrentMatchIndex(0);
        }
      }

      // New Chat (Cmd+N)
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        void handleCreateChat();
      }

      // Settings (Cmd+,)
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        window.location.href = "/settings";
      }

      // Attach Image (Cmd+U)
      if ((e.metaKey || e.ctrlKey) && e.key === "u") {
        e.preventDefault();
        if (hasProvider && !isStreaming && fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchActive, hasProvider, isStreaming, handleCreateChat]);

  // Global search
  useEffect(() => {
    if (!globalSearchQuery.trim()) {
      setGlobalSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await core.search.messages(globalSearchQuery);
        setGlobalSearchResults(results);
      } catch (error) {
        console.error("Global search error:", error);
        setGlobalSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [globalSearchQuery, core]);

  // More handlers
  const handleSelectChat = async (chatId: string) => {
    try {
      // Stop any ongoing streaming
      if (streamingChatId && streamingMessageId) {
        await core.messages.stop(streamingMessageId);
        setStreamingChatId(null);
        setStreamingMessageId(null);
      }

      setActiveChatId(chatId);
      setSidebarOpen(false);
    } catch (error) {
      console.error("Failed to select chat:", error);
    }
  };

  const handleRenameChat = async (chatId: string, newTitle: string) => {
    // Optimistic update: Update UI immediately
    const previousChats = [...chats];
    const updatedChats = chats.map(chat =>
      chat.id === chatId ? { ...chat, title: newTitle } : chat
    );
    setChats(updatedChats);

    try {
      await core.chats.rename(chatId, newTitle);
      // Sync with server to get accurate data
      const chatList = await core.chats.list();
      setChats(chatList);
      toast.success("Chat renamed successfully", {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      // Rollback optimistic update
      setChats(previousChats);
      console.error("Failed to rename chat:", error);

      const errorDetails = classifyError(error);
      if (errorDetails.isRetryable) {
        toast.error("Failed to rename chat", {
          description: errorDetails.message,
          action: {
            label: "Retry",
            onClick: () => handleRenameChat(chatId, newTitle),
          },
        });
      } else {
        toast.error("Failed to rename chat", {
          description: errorDetails.message,
        });
      }
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    // Optimistic update: Remove from UI immediately
    const previousChats = [...chats];
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);

    // Clear active chat if it was deleted
    const wasActive = activeChatId === chatId;
    if (wasActive) {
      setActiveChatId(null);
      setMessages([]);
    }

    try {
      await core.chats.delete(chatId);
      // Sync with server
      const chatList = await core.chats.list();
      setChats(chatList);
      toast.success("Chat deleted successfully", {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      // Rollback optimistic update
      setChats(previousChats);
      if (wasActive) {
        setActiveChatId(chatId);
        // Reload messages
        const chatData = await core.chats.get(chatId);
        if (chatData) {
          setMessages(chatData.messages);
        }
      }
      console.error("Failed to delete chat:", error);

      const errorDetails = classifyError(error);
      if (errorDetails.isRetryable) {
        toast.error("Failed to delete chat", {
          description: errorDetails.message,
          action: {
            label: "Retry",
            onClick: () => handleDeleteChat(chatId),
          },
        });
      } else {
        toast.error("Failed to delete chat", {
          description: errorDetails.message,
        });
      }
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Optimistic update: Update UI immediately
    const previousMessages = [...messages];
    const updatedMessages = messages.map(msg =>
      msg.id === messageId ? { ...msg, content: newContent } : msg
    );
    setMessages(updatedMessages);

    try {
      await core.messages.edit(messageId, newContent);

      // Reload messages to sync with server
      if (activeChatId) {
        const chatData = await core.chats.get(activeChatId);
        if (chatData) {
          setMessages(chatData.messages);
        }
      }

      toast.success("Message edited successfully", {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      // Rollback optimistic update
      setMessages(previousMessages);
      console.error("Failed to edit message:", error);

      const errorDetails = classifyError(error);
      if (errorDetails.isRetryable) {
        toast.error("Failed to edit message", {
          description: errorDetails.message,
          action: {
            label: "Retry",
            onClick: () => handleEditMessage(messageId, newContent),
          },
        });
      } else {
        toast.error("Failed to edit message", {
          description: errorDetails.message,
        });
      }
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Optimistic update: Remove from UI immediately
    const previousMessages = [...messages];
    const updatedMessages = messages.filter(msg => msg.id !== messageId);
    setMessages(updatedMessages);

    try {
      await core.messages.delete(messageId);

      // Reload messages to sync with server
      if (activeChatId) {
        const chatData = await core.chats.get(activeChatId);
        if (chatData) {
          setMessages(chatData.messages);
        }
      }

      toast.success("Message deleted successfully", {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      // Rollback optimistic update
      setMessages(previousMessages);
      console.error("Failed to delete message:", error);

      const errorDetails = classifyError(error);
      if (errorDetails.isRetryable) {
        toast.error("Failed to delete message", {
          description: errorDetails.message,
          action: {
            label: "Retry",
            onClick: () => handleDeleteMessage(messageId),
          },
        });
      } else {
        toast.error("Failed to delete message", {
          description: errorDetails.message,
        });
      }
    }
  };

  const handlePinMessage = async (messageId: string, shouldPin: boolean) => {
    // Optimistic update: Update UI immediately
    const previousMessages = [...messages];
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        if (shouldPin) {
          return { ...msg, isPinned: true, pinnedAt: Date.now() };
        } else {
          const { pinnedAt, ...rest } = msg;
          return { ...rest, isPinned: false };
        }
      }
      return msg;
    });
    setMessages(updatedMessages);

    try {
      if (shouldPin) {
        await core.messages.pin(messageId);
      } else {
        await core.messages.unpin(messageId);
      }

      // Reload messages to sync with server
      if (activeChatId) {
        const chatData = await core.chats.get(activeChatId);
        if (chatData) {
          setMessages(chatData.messages);
        }
        // Reload pinned messages
        const pinned = await core.messages.getPinnedMessages(activeChatId);
        setPinnedMessages(pinned);
      }

      toast.success(shouldPin ? "Message pinned" : "Message unpinned", {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      // Rollback optimistic update
      setMessages(previousMessages);
      console.error("Failed to pin/unpin message:", error);

      const errorDetails = classifyError(error);
      if (errorDetails.isRetryable) {
        toast.error(shouldPin ? "Failed to pin message" : "Failed to unpin message", {
          description: errorDetails.message,
          action: {
            label: "Retry",
            onClick: () => handlePinMessage(messageId, shouldPin),
          },
        });
      } else {
        toast.error(shouldPin ? "Failed to pin message" : "Failed to unpin message", {
          description: errorDetails.message,
        });
      }
    }
  };

  const handlePinClick = (messageId: string) => {
    // Save current scroll position
    setSavedScrollPosition(virtualizer.scrollOffset);

    // Find message index in the display messages array
    const messageIndex = displayMessages.findIndex(item =>
      item.type === "message" && item.message.id === messageId
    );

    if (messageIndex !== -1) {
      virtualizer.scrollToIndex(messageIndex, { align: "center", behavior: "smooth" });
    }
  };

  const handleReturnToPosition = () => {
    if (savedScrollPosition !== null) {
      virtualizer.scrollToOffset(savedScrollPosition, { behavior: "smooth" });
      setSavedScrollPosition(null);
    }
  };

  const handleBranchOff = async (messageId: string) => {
    if (!activeChatId) return;

    try {
      // Create a branched chat
      const newChat = await core.chats.branch(activeChatId, messageId);

      // Reload chat list to include the new branched chat
      const chatList = await core.chats.list();
      setChats(chatList);

      // Switch to the new branched chat
      setActiveChatId(newChat.id);

      toast.success("Conversation branched successfully", {
        description: `Created "${newChat.title}"`,
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      console.error("Failed to branch conversation:", error);

      const errorDetails = classifyError(error);
      if (errorDetails.isRetryable) {
        toast.error("Failed to branch conversation", {
          description: errorDetails.message,
          action: {
            label: "Retry",
            onClick: () => handleBranchOff(messageId),
          },
        });
      } else {
        toast.error("Failed to branch conversation", {
          description: errorDetails.message,
        });
      }
    }
  };

  const handleRegenerateMessage = async () => {
    if (!activeChatId) return;

    try {
      setStreamingChatId(activeChatId);

      const stream = core.messages.regenerate(activeChatId);

      // Consume the stream
      for await (const update of stream) {
        setStreamingMessageId(update.messageId);

        // Reload messages to show updates
        const chatData = await core.chats.get(activeChatId);
        if (chatData) {
          setMessages(chatData.messages);
        }
      }

      // Stream complete - reload chats to update lastMessageAt
      const chatList = await core.chats.list();
      setChats(chatList);

      setStreamingChatId(null);
      setStreamingMessageId(null);
    } catch (error) {
      console.error("Failed to regenerate message:", error);

      const errorDetails = classifyError(error);
      toast.error("Failed to regenerate message", {
        description: errorDetails.message,
        duration: errorDetails.isRetryable ? TOAST_DURATION.indefinite : TOAST_DURATION.long,
        ...(errorDetails.isRetryable && {
          action: {
            label: "Retry",
            onClick: () => handleRegenerateMessage(),
          },
        }),
      });

      setStreamingChatId(null);
      setStreamingMessageId(null);
    }
  };

  const handleStopMessage = async () => {
    if (streamingMessageId) {
      try {
        await core.messages.stop(streamingMessageId);
        setStreamingChatId(null);
        setStreamingMessageId(null);
        toast.info("Response stopped", {
          duration: TOAST_DURATION.short,
        });
      } catch (error) {
        console.error("Failed to stop message:", error);
      }
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if ((!trimmedMessage && attachedImages.length === 0) || !hasProvider || isStreaming) {
      return;
    }

    if (!activeChatId) {
      console.error("No active chat");
      return;
    }

    // Ensure a model is selected
    if (!selectedModel) {
      console.error("No model selected");
      return;
    }

    try {
      setStreamingChatId(activeChatId);

      const params = {
        content: trimmedMessage || " ",
        model: selectedModel.modelId,
        providerConnectionId: selectedModel.providerId,
        ...(attachedImages.length > 0 && { images: attachedImages }),
        temperature,
        maxTokens,
        ...(systemPromptOverride.trim() && { systemPrompt: systemPromptOverride.trim() }),
      };
      const stream = core.chats.sendMessage(activeChatId, params);

      // Clear input immediately
      setMessageInput("");
      setAttachedImages([]);
      setAttachmentError("");

      // Consume the stream
      for await (const update of stream) {
        // Track the streaming message ID
        setStreamingMessageId(update.messageId);
        
        // Reload messages to show updates
        const chatData = await core.chats.get(activeChatId);
        if (chatData) {
          setMessages(chatData.messages);
        }
      }

      // Stream complete - reload chats to update lastMessageAt
      const chatList = await core.chats.list();
      setChats(chatList);

      setStreamingChatId(null);
      setStreamingMessageId(null);
    } catch (error) {
      console.error("Failed to send message:", error);
      setStreamingChatId(null);
      setStreamingMessageId(null);
    }
  };

  // Stopping is handled by Message component's onStop callback

  const handleSearch = async (query: string) => {
    if (!query.trim() || !activeChatId) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    try {
      const results = await core.search.messagesInChat(activeChatId, query);
      const messageIds = results.map((result) => result.message.id);
      setSearchMatches(messageIds);
      setCurrentMatchIndex(messageIds.length > 0 ? 1 : 0);

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

  const handleGlobalSearchResultClick = async (result: SearchResult) => {
    setCommandPaletteOpen(false);
    setGlobalSearchQuery("");
    setGlobalSearchResults([]);

    if (result.message.chatId !== activeChatId) {
      await handleSelectChat(result.message.chatId);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const messageIndex = messages.findIndex(msg => msg.id === result.message.id);
    if (messageIndex !== -1) {
      virtualizer.scrollToIndex(messageIndex, { align: "center", behavior: "smooth" });
    }
  };

  // Image attachment handlers
  const validateImage = (file: File): string | null => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return `Invalid file type. Only PNG, JPEG, and WebP images are supported.`;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size exceeds 10MB limit. "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
    }

    return null;
  };

  const addImageAttachment = async (file: File) => {
    const error = validateImage(file);
    if (error) {
      setAttachmentError(error);
      return;
    }

    setAttachmentError("");

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const attachment: ImageAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: base64,
        mimeType: file.type,
        size: file.size,
        name: file.name,
      };

      setAttachedImages((prev) => [...prev, attachment]);
    };
    reader.readAsDataURL(file);
  };

  const removeImageAttachment = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(addImageAttachment);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 10;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [messageInput]);

  const lastAssistantMessage = messages
    .filter((msg) => msg.role === "assistant")
    .pop();

  return (
    <TooltipProvider>
      <div className="flex h-screen">
        {/* Mobile menu button */}
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
                  onClick={handleCreateChat}
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
                  onClick={() => handleSelectChat(chat.id)}
                  onRename={handleRenameChat}
                  onDelete={handleDeleteChat}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="border-b h-14 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3 ml-10 md:ml-0">
            <h1 className="text-lg font-semibold">Arc</h1>
            <div aria-label="Model selector">
              <ModelSelector
                value={selectedModel?.modelId || ""}
                onValueChange={(modelId, providerId) => {
                  setSelectedModel({ modelId, providerId });
                }}
                disabled={!hasProvider || isStreaming}
                groupedModels={groupedModels}
                isLoading={modelsLoading}
              />
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/settings">
                <Button variant="ghost" size="icon">
                  <SettingsIcon className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{keyboardShortcuts.openSettings.description} ({keyboardShortcuts.openSettings.label})</p>
            </TooltipContent>
          </Tooltip>
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

        {/* Pinned Messages Bar */}
        <PinnedMessagesBar
          pinnedMessages={pinnedMessages}
          onPinClick={handlePinClick}
          {...(savedScrollPosition !== null && { onReturnToPosition: handleReturnToPosition })}
        />

        {/* Message panel */}
        <div
          ref={parentRef}
          className="flex-1 overflow-auto"
          style={{ position: 'relative' }}
          tabIndex={-1}
          role="log"
          aria-label="Message history"
          aria-live="polite"
        >
          {displayMessages.length > 0 ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = displayMessages[virtualItem.index];
                if (!item) return null;

                // Handle divider items
                if (item.type === "divider") {
                  return (
                    <div
                      key={`divider-${virtualItem.key}`}
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
                      <div className="max-w-3xl mx-auto px-4 md:px-6">
                        <ModelSwitchDivider
                          model={item.model}
                          providerConnectionId={item.providerConnectionId}
                          providers={providers}
                        />
                      </div>
                    </div>
                  );
                }

                // Handle message items
                const message = item.message;

                // Check if this is a model loading error message
                const isModelError = message.id.startsWith('error-models-');
                const providerId = isModelError ? message.id.replace('error-models-', '') : null;
                const errorDetails = providerId ? getErrorDetails(providerId) : null;

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
                        providers={providers}
                        onStop={handleStopMessage}
                        onRegenerate={handleRegenerateMessage}
                        onDelete={handleDeleteMessage}
                        onEdit={handleEditMessage}
                        onPin={handlePinMessage}
                        onBranchOff={handleBranchOff}
                        {...(isModelError ? { onRetry: refetchModels } : {})}
                        {...(errorDetails ? { errorMetadata: { isRetryable: errorDetails.isRetryable } } : {})}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !hasProvider ? (
            <NoProvidersState
              action={{
                label: "Open Settings",
                onClick: () => (window.location.href = "/settings"),
              }}
            />
          ) : (
            <NoMessagesState />
          )}
        </div>

        {/* Advanced Composer Controls */}
        <AdvancedComposerControls
          temperature={temperature}
          maxTokens={maxTokens}
          systemPrompt={systemPromptOverride}
          onTemperatureChange={setTemperature}
          onMaxTokensChange={setMaxTokens}
          onSystemPromptChange={setSystemPromptOverride}
        />

        {/* Composer bar */}
        <div
          className="border-t p-4 bg-background"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="space-y-3 px-2 md:px-4">
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

            {attachedImages.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {attachedImages.map((attachment, index) => (
                  <ImageAttachmentChip
                    key={index}
                    attachment={attachment}
                    onRemove={() => removeImageAttachment(index)}
                  />
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              aria-hidden="true"
            />

            <div className="border rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring transition-shadow">
              <div className="px-4 pt-3 pb-2">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder={
                    !hasProvider
                      ? "Configure a provider in settings first..."
                      : isStreaming
                        ? "Waiting for response..."
                        : "Ask anything"
                  }
                  className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-y-auto"
                  aria-label="Message input"
                  tabIndex={0}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={!hasProvider || isStreaming}
                />
              </div>

              <div className="px-3 pb-2 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 hover:bg-accent"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!hasProvider || isStreaming}
                      aria-label="Attach image"
                    >
                      <ImageIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{keyboardShortcuts.attachImage.description} ({keyboardShortcuts.attachImage.label})</p>
                  </TooltipContent>
                </Tooltip>

                <div className="flex-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 hover:bg-accent disabled:opacity-30"
                      aria-label="Send message"
                      onClick={handleSendMessage}
                      disabled={
                        !hasProvider ||
                        isStreaming ||
                        (!messageInput.trim() && attachedImages.length === 0)
                      }
                    >
                      <SendIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{keyboardShortcuts.sendMessage.description} ({keyboardShortcuts.sendMessage.label})</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
        <DialogContent
          className="max-w-2xl"
          onOpenAutoFocus={(e) => {
            // Ensure search input gets focus when dialog opens
            if (e.currentTarget instanceof HTMLElement) {
              const input = e.currentTarget.querySelector('input');
              if (input) {
                e.preventDefault();
                setTimeout(() => input.focus(), 0);
              }
            }
          }}
        >
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
              aria-label="Search messages across all chats"
            />
          </div>

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

          {globalSearchQuery && globalSearchResults.length === 0 && (
            <NoGlobalSearchResultsState query={globalSearchQuery} />
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

      </div>
    </TooltipProvider>
  );
}
