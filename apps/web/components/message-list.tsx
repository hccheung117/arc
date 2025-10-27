import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Message } from "@/components/message";
import { ModelSwitchDivider } from "@/components/model-switch-divider";
import { SearchBar } from "@/components/search-bar";
import { PinnedMessagesBar } from "@/components/pinned-messages-bar";
import { NoProvidersState, NoMessagesState } from "@/components/empty-states";
import type { Message as CoreMessage, ProviderConfig } from "@arc/core/core.js";
import type { DisplayItem } from "@/lib/use-display-items";

interface MessageListProps {
  displayItems: DisplayItem[];
  searchActive: boolean;
  searchMatches: string[];
  currentMatchIndex: number;
  onSearch: (query: string) => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onSearchClose: () => void;
  pinnedMessages: CoreMessage[];
  onPinClick: (messageId: string) => void;
  onReturnToPosition: () => void;
  lastAssistantMessage: CoreMessage | undefined;
  providers: ProviderConfig[];
  getErrorDetails: (providerId: string) => { providerName: string; userMessage: string; isRetryable: boolean } | null;
  onStopMessage: () => void;
  onRegenerateMessage: () => void;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onPinMessage: (messageId: string, shouldPin: boolean) => void;
  onBranchOff: (messageId: string) => void;
  refetchModels: () => void;
  hasProvider: boolean;
  isStreaming: boolean;
}

export function MessageList({
  displayItems,
  searchActive,
  searchMatches,
  currentMatchIndex,
  onSearch,
  onSearchNext,
  onSearchPrevious,
  onSearchClose,
  pinnedMessages,
  onPinClick,
  onReturnToPosition,
  lastAssistantMessage,
  providers,
  getErrorDetails,
  onStopMessage,
  onRegenerateMessage,
  onDeleteMessage,
  onEditMessage,
  onPinMessage,
  onBranchOff,
  refetchModels,
  hasProvider,
  isStreaming,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (displayItems.length > 0 && isStreaming) {
      virtualizer.scrollToIndex(displayItems.length - 1, { align: "end", behavior: "smooth" });
    }
  }, [displayItems.length, isStreaming, virtualizer]);

  // Handle pin click with scroll position saving
  const handlePinClick = (messageId: string) => {
    onPinClick(messageId);

    const messageIndex = displayItems.findIndex((item) =>
      item.type === "message" && item.message.id === messageId
    );

    if (messageIndex !== -1) {
      virtualizer.scrollToIndex(messageIndex, { align: "center", behavior: "smooth" });
    }
  };

  // Handle return to position
  const handleReturnToPosition = () => {
    onReturnToPosition();
  };

  // Handle search with virtualizer scrolling
  const handleSearch = (query: string) => {
    onSearch(query);
  };

  const handleSearchNext = () => {
    onSearchNext();
    // Scroll to match if available
    if (searchMatches.length > 0) {
      const nextIndex = currentMatchIndex % searchMatches.length;
      const messageId = searchMatches[nextIndex];
      if (messageId) {
        const msgIndex = displayItems.findIndex((item) =>
          item.type === "message" && item.message.id === messageId
        );
        if (msgIndex !== -1) {
          virtualizer.scrollToIndex(msgIndex, { align: "center", behavior: "smooth" });
        }
      }
    }
  };

  const handleSearchPrevious = () => {
    onSearchPrevious();
    // Scroll to match if available
    if (searchMatches.length > 0) {
      const prevIndex = currentMatchIndex - 2;
      const wrappedIndex = prevIndex < 0 ? searchMatches.length - 1 : prevIndex;
      const messageId = searchMatches[wrappedIndex];
      if (messageId) {
        const msgIndex = displayItems.findIndex((item) =>
          item.type === "message" && item.message.id === messageId
        );
        if (msgIndex !== -1) {
          virtualizer.scrollToIndex(msgIndex, { align: "center", behavior: "smooth" });
        }
      }
    }
  };

  return (
    <>
      {/* Search Bar */}
      {searchActive && (
        <SearchBar
          onSearch={handleSearch}
          matchCount={searchMatches.length}
          currentMatch={currentMatchIndex}
          onNext={handleSearchNext}
          onPrevious={handleSearchPrevious}
          onClose={onSearchClose}
        />
      )}

      {/* Pinned Messages Bar */}
      <PinnedMessagesBar
        pinnedMessages={pinnedMessages}
        onPinClick={handlePinClick}
        onReturnToPosition={handleReturnToPosition}
      />

      {/* Message panel */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ position: "relative" }}
        tabIndex={-1}
        role="log"
        aria-label="Message history"
        aria-live="polite"
      >
        {displayItems.length > 0 ? (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = displayItems[virtualItem.index];
              if (!item) return null;

              // Handle divider items
              if (item.type === "divider") {
                return (
                  <div
                    key={`divider-${virtualItem.key}`}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
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
              const isModelError = message.id.startsWith("error-models-");
              const providerId = isModelError ? message.id.replace("error-models-", "") : null;
              const errorDetails = providerId ? getErrorDetails(providerId) : null;

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
                    <Message
                      message={message}
                      isLatestAssistant={message.id === lastAssistantMessage?.id}
                      isHighlighted={searchMatches.includes(message.id)}
                      providers={providers}
                      onStop={onStopMessage}
                      onRegenerate={onRegenerateMessage}
                      onDelete={onDeleteMessage}
                      onEdit={onEditMessage}
                      onPin={onPinMessage}
                      onBranchOff={onBranchOff}
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
    </>
  );
}
