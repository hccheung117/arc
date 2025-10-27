import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Chat, Core } from "@arc/core/core.js";
import { classifyError, TOAST_DURATION } from "./error-handler";

interface UseChatManagementOptions {
  onChatSelected?: () => void;
}

export function useChatManagement(core: Core, options: UseChatManagementOptions = {}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Load initial chats
  useEffect(() => {
    const loadChats = async () => {
      try {
        const chatList = await core.chats.list();
        setChats(chatList);

        // Auto-select first chat if available and none is selected
        if (chatList.length > 0 && !activeChatId) {
          setActiveChatId(chatList[0]!.id);
        }
      } catch (error) {
        console.error("Failed to load chats:", error);
      }
    };

    void loadChats();
  }, [core, activeChatId]);

  // Subscribe to title-updated events
  useEffect(() => {
    const handleTitleUpdated = (event: { chatId: string; title: string }) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === event.chatId ? { ...chat, title: event.title } : chat
        )
      );
    };

    core.chats.on("title-updated", handleTitleUpdated);

    return () => {
      core.chats.off("title-updated", handleTitleUpdated);
    };
  }, [core]);

  const createChat = useCallback(async () => {
    try {
      // Create pending chat (will be persisted on first message)
      core.chats.create({ title: "New Chat" });

      // Refresh the chat list
      const chatList = await core.chats.list();
      setChats(chatList);

      options.onChatSelected?.();
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  }, [core, options]);

  const selectChat = useCallback(
    async (chatId: string) => {
      try {
        setActiveChatId(chatId);
        options.onChatSelected?.();
      } catch (error) {
        console.error("Failed to select chat:", error);
      }
    },
    [options]
  );

  const renameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      // Optimistic update
      const previousChats = [...chats];
      const updatedChats = chats.map((chat) =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      );
      setChats(updatedChats);

      try {
        await core.chats.rename(chatId, newTitle);
        // Sync with server
        const chatList = await core.chats.list();
        setChats(chatList);
        toast.success("Chat renamed successfully", {
          duration: TOAST_DURATION.short,
        });
      } catch (error) {
        // Rollback
        setChats(previousChats);
        console.error("Failed to rename chat:", error);

        const errorDetails = classifyError(error);
        if (errorDetails.isRetryable) {
          toast.error("Failed to rename chat", {
            description: errorDetails.message,
            action: {
              label: "Retry",
              onClick: () => renameChat(chatId, newTitle),
            },
          });
        } else {
          toast.error("Failed to rename chat", {
            description: errorDetails.message,
          });
        }
      }
    },
    [chats, core]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      // Optimistic update
      const previousChats = [...chats];
      const updatedChats = chats.filter((chat) => chat.id !== chatId);
      setChats(updatedChats);

      // Clear active chat if it was deleted
      const wasActive = activeChatId === chatId;
      if (wasActive) {
        setActiveChatId(null);
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
        // Rollback
        setChats(previousChats);
        if (wasActive) {
          setActiveChatId(chatId);
        }
        console.error("Failed to delete chat:", error);

        const errorDetails = classifyError(error);
        if (errorDetails.isRetryable) {
          toast.error("Failed to delete chat", {
            description: errorDetails.message,
            action: {
              label: "Retry",
              onClick: () => deleteChat(chatId),
            },
          });
        } else {
          toast.error("Failed to delete chat", {
            description: errorDetails.message,
          });
        }
      }
    },
    [chats, activeChatId, core]
  );

  const refreshChats = useCallback(async () => {
    try {
      const chatList = await core.chats.list();
      setChats(chatList);
    } catch (error) {
      console.error("Failed to refresh chats:", error);
    }
  }, [core]);

  return {
    chats,
    activeChatId,
    setActiveChatId,
    createChat,
    selectChat,
    renameChat,
    deleteChat,
    refreshChats,
  };
}
