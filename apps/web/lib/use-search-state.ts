import { useState, useEffect, useCallback } from "react";
import type { SearchResult } from "@arc/core/core.js";
import type { Core } from "@arc/core/core.js";

export function useSearchState(core: Core, activeChatId: string | null) {
  // In-chat search state
  const [searchActive, setSearchActive] = useState(false);
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Global search state
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[]>([]);

  // Sidebar search state
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  // Global search effect (debounced)
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

  // In-chat search handler
  const handleSearch = useCallback(
    async (query: string, onMatch?: (messageId: string, isFirst: boolean) => void) => {
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

        if (messageIds.length > 0 && messageIds[0] && onMatch) {
          onMatch(messageIds[0], true);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchMatches([]);
        setCurrentMatchIndex(0);
      }
    },
    [activeChatId, core]
  );

  const handleSearchNext = useCallback(
    (onMatch?: (messageId: string) => void) => {
      if (searchMatches.length === 0) return;

      const nextIndex = currentMatchIndex % searchMatches.length;
      setCurrentMatchIndex(nextIndex + 1);

      const messageId = searchMatches[nextIndex];
      if (messageId && onMatch) {
        onMatch(messageId);
      }
    },
    [searchMatches, currentMatchIndex]
  );

  const handleSearchPrevious = useCallback(
    (onMatch?: (messageId: string) => void) => {
      if (searchMatches.length === 0) return;

      const prevIndex = currentMatchIndex - 2;
      const wrappedIndex = prevIndex < 0 ? searchMatches.length - 1 : prevIndex;
      setCurrentMatchIndex(wrappedIndex + 1);

      const messageId = searchMatches[wrappedIndex];
      if (messageId && onMatch) {
        onMatch(messageId);
      }
    },
    [searchMatches, currentMatchIndex]
  );

  const handleSearchClose = useCallback(() => {
    setSearchActive(false);
    setSearchMatches([]);
    setCurrentMatchIndex(0);
  }, []);

  return {
    // In-chat search
    searchActive,
    setSearchActive,
    searchMatches,
    currentMatchIndex,
    handleSearch,
    handleSearchNext,
    handleSearchPrevious,
    handleSearchClose,

    // Global search
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchResults,

    // Sidebar search
    sidebarSearchQuery,
    setSidebarSearchQuery,
  };
}
