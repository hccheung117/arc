"use client";

import { useEffect, useState, useRef } from "react";
import { MenuIcon } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdvancedComposerControls } from "@/components/advanced-composer-controls";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatHeader } from "@/components/chat-header";
import { MessageList } from "@/components/message-list";
import { MessageComposer } from "@/components/message-composer";
import { CommandPalette } from "@/components/command-palette";
import { useCore } from "@/lib/core-provider";
import { useUIStore } from "@/lib/ui-store";
import { useModels } from "@/lib/use-models";
import { useChatManagement } from "@/lib/use-chat-management";
import { useMessageOperations } from "@/lib/use-message-operations";
import { useSearchState } from "@/lib/use-search-state";
import { useImageAttachments } from "@/lib/use-image-attachments";
import { useDisplayItems } from "@/lib/use-display-items";
import type { ProviderConfig, SearchResult, Message as CoreMessage } from "@arc/core/core.js";

export default function Home() {
  const core = useCore();

  // UI state from Zustand
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  // Provider state
  const [providers, setProviders] = useState<ProviderConfig[]>([]);

  // Model selection state
  const [selectedModel, setSelectedModel] = useState<{ modelId: string; providerId: string } | null>(null);

  // Model loading
  const { groupedModels, isLoading: modelsLoading, errors: modelErrors, getErrorDetails, refetch: refetchModels } = useModels();

  // Advanced composer controls state
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [systemPromptOverride, setSystemPromptOverride] = useState("");

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Ref for message input focus
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Custom hooks
  const chatManagement = useChatManagement(core, {
    onChatSelected: () => setSidebarOpen(false),
  });

  const messageOperations = useMessageOperations(core, chatManagement.activeChatId, {
    onMessageInputFocus: () => textareaRef.current?.focus(),
  });

  const searchState = useSearchState(core, chatManagement.activeChatId);
  const imageAttachments = useImageAttachments();

  // Create synthetic error messages for model loading failures
  const modelErrorMessages: CoreMessage[] = Array.from(modelErrors.keys()).map((providerId) => {
    const errorDetails = getErrorDetails(providerId);
    const content = errorDetails
      ? `**Failed to load models from ${errorDetails.providerName}**\n\n${errorDetails.userMessage}`
      : `**Failed to load models**\n\nAn unexpected error occurred.`;

    return {
      id: `error-models-${providerId}`,
      chatId: chatManagement.activeChatId || "",
      role: "assistant" as const,
      content,
      status: "error" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  // Combine real messages with error messages (errors at the end)
  const allMessages = [...messageOperations.messages, ...modelErrorMessages];

  // Build display items with model switch dividers
  const displayItems = useDisplayItems(allMessages);

  // Check if any provider is configured
  const hasProvider = providers.length > 0;

  // Message input state
  const [messageInput, setMessageInput] = useState("");

  // Load providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providerList = await core.providers.list();
        setProviders(providerList);
      } catch (error) {
        console.error("Failed to load providers:", error);
      }
    };

    void loadProviders();
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
        searchState.setSearchActive((prev) => !prev);
        if (searchState.searchActive) {
          searchState.handleSearchClose();
        }
      }

      // New Chat (Cmd+N)
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        void chatManagement.createChat();
      }

      // Settings (Cmd+,)
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        window.location.href = "/settings";
      }

      // Attach Image (Cmd+U)
      if ((e.metaKey || e.ctrlKey) && e.key === "u") {
        e.preventDefault();
        if (hasProvider && !messageOperations.isStreaming && imageAttachments.fileInputRef.current) {
          imageAttachments.fileInputRef.current.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchState, hasProvider, messageOperations.isStreaming, chatManagement, imageAttachments.fileInputRef]);

  // Handle select chat
  const handleSelectChat = async (chatId: string) => {
    // Stop any ongoing streaming before switching
    await messageOperations.stopStreaming();
    await chatManagement.selectChat(chatId);
  };

  // Handle send message
  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if ((!trimmedMessage && imageAttachments.attachedImages.length === 0) || !hasProvider || messageOperations.isStreaming) {
      return;
    }

    if (!chatManagement.activeChatId) {
      console.error("No active chat");
      return;
    }

    // Ensure a model is selected
    if (!selectedModel) {
      console.error("No model selected");
      return;
    }

    const params = {
      content: trimmedMessage || " ",
      model: selectedModel.modelId,
      providerConnectionId: selectedModel.providerId,
      ...(imageAttachments.attachedImages.length > 0 && { images: imageAttachments.attachedImages }),
      temperature,
      maxTokens,
      ...(systemPromptOverride.trim() && { systemPrompt: systemPromptOverride.trim() }),
    };

    // Clear input immediately
    setMessageInput("");
    imageAttachments.clearAttachments();

    await messageOperations.sendMessage(params);

    // Reload chats to update lastMessageAt
    await chatManagement.refreshChats();
  };

  // Handle global search result click
  const handleGlobalSearchResultClick = async (result: SearchResult) => {
    setCommandPaletteOpen(false);
    searchState.setGlobalSearchQuery("");

    if (result.message.chatId !== chatManagement.activeChatId) {
      await handleSelectChat(result.message.chatId);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  // Handle branch off
  const handleBranchOff = async (messageId: string) => {
    const newChat = await messageOperations.branchOff(messageId);
    if (newChat) {
      // Reload chat list to include the new branched chat
      await chatManagement.refreshChats();
      // Switch to the new branched chat
      chatManagement.setActiveChatId(newChat.id);
    }
  };

  // Handle delete chat
  const handleDeleteChat = async (chatId: string) => {
    await chatManagement.deleteChat(chatId);
  };

  const lastAssistantMessage = messageOperations.messages
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
        <ChatSidebar
          sidebarOpen={sidebarOpen}
          chats={chatManagement.chats}
          activeChatId={chatManagement.activeChatId}
          sidebarSearchQuery={searchState.sidebarSearchQuery}
          setSidebarSearchQuery={searchState.setSidebarSearchQuery}
          onSelectChat={handleSelectChat}
          onCreateChat={chatManagement.createChat}
          onRenameChat={chatManagement.renameChat}
          onDeleteChat={handleDeleteChat}
        />

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <ChatHeader
            selectedModel={selectedModel}
            onModelChange={(modelId, providerId) => {
              setSelectedModel({ modelId, providerId });
            }}
            hasProvider={hasProvider}
            isStreaming={messageOperations.isStreaming}
            groupedModels={groupedModels}
            isLoading={modelsLoading}
          />

          {/* Message List */}
          <MessageList
            displayItems={displayItems}
            searchActive={searchState.searchActive}
            searchMatches={searchState.searchMatches}
            currentMatchIndex={searchState.currentMatchIndex}
            onSearch={(query) => searchState.handleSearch(query)}
            onSearchNext={searchState.handleSearchNext}
            onSearchPrevious={searchState.handleSearchPrevious}
            onSearchClose={searchState.handleSearchClose}
            pinnedMessages={messageOperations.pinnedMessages}
            onPinClick={() => {}}
            onReturnToPosition={() => {}}
            lastAssistantMessage={lastAssistantMessage}
            providers={providers}
            getErrorDetails={getErrorDetails}
            onStopMessage={messageOperations.stopMessage}
            onRegenerateMessage={messageOperations.regenerateMessage}
            onDeleteMessage={messageOperations.deleteMessage}
            onEditMessage={messageOperations.editMessage}
            onPinMessage={messageOperations.pinMessage}
            onBranchOff={handleBranchOff}
            refetchModels={refetchModels}
            hasProvider={hasProvider}
            isStreaming={messageOperations.isStreaming}
          />

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
          <MessageComposer
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            attachedImages={imageAttachments.attachedImages}
            attachmentError={imageAttachments.attachmentError}
            clearAttachmentError={imageAttachments.clearAttachmentError}
            removeImageAttachment={imageAttachments.removeImageAttachment}
            hasProvider={hasProvider}
            isStreaming={messageOperations.isStreaming}
            onSendMessage={handleSendMessage}
            onDrop={imageAttachments.handleDrop}
            onDragOver={imageAttachments.handleDragOver}
            onPaste={imageAttachments.handlePaste}
            fileInputRef={imageAttachments.fileInputRef}
            onFileInputChange={imageAttachments.handleFileInputChange}
          />
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
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          globalSearchQuery={searchState.globalSearchQuery}
          setGlobalSearchQuery={searchState.setGlobalSearchQuery}
          globalSearchResults={searchState.globalSearchResults}
          onResultClick={handleGlobalSearchResultClick}
        />
      </div>
    </TooltipProvider>
  );
}
