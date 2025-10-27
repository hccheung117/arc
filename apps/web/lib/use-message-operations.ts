import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Message, ImageAttachment, Core } from "@arc/core/core.js";
import { classifyError, TOAST_DURATION } from "./error-handler";

interface SendMessageParams {
  content: string;
  model: string;
  providerConnectionId: string;
  images?: ImageAttachment[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface UseMessageOperationsOptions {
  onMessageInputFocus?: () => void;
}

export function useMessageOperations(
  core: Core,
  activeChatId: string | null,
  options: UseMessageOperationsOptions = {}
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const isStreaming = streamingChatId === activeChatId;

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

        // Auto-focus message input
        options.onMessageInputFocus?.();
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    void loadMessages();
  }, [activeChatId, core, options]);

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      // Optimistic update
      const previousMessages = [...messages];
      const updatedMessages = messages.map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      );
      setMessages(updatedMessages);

      try {
        await core.messages.edit(messageId, newContent);

        // Reload messages
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
        // Rollback
        setMessages(previousMessages);
        console.error("Failed to edit message:", error);

        const errorDetails = classifyError(error);
        if (errorDetails.isRetryable) {
          toast.error("Failed to edit message", {
            description: errorDetails.message,
            action: {
              label: "Retry",
              onClick: () => editMessage(messageId, newContent),
            },
          });
        } else {
          toast.error("Failed to edit message", {
            description: errorDetails.message,
          });
        }
      }
    },
    [messages, activeChatId, core]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      // Optimistic update
      const previousMessages = [...messages];
      const updatedMessages = messages.filter((msg) => msg.id !== messageId);
      setMessages(updatedMessages);

      try {
        await core.messages.delete(messageId);

        // Reload messages
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
        // Rollback
        setMessages(previousMessages);
        console.error("Failed to delete message:", error);

        const errorDetails = classifyError(error);
        if (errorDetails.isRetryable) {
          toast.error("Failed to delete message", {
            description: errorDetails.message,
            action: {
              label: "Retry",
              onClick: () => deleteMessage(messageId),
            },
          });
        } else {
          toast.error("Failed to delete message", {
            description: errorDetails.message,
          });
        }
      }
    },
    [messages, activeChatId, core]
  );

  const pinMessage = useCallback(
    async (messageId: string, shouldPin: boolean) => {
      // Optimistic update
      const previousMessages = [...messages];
      const updatedMessages = messages.map((msg) => {
        if (msg.id === messageId) {
          if (shouldPin) {
            return { ...msg, isPinned: true, pinnedAt: Date.now() };
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        // Reload messages
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
        // Rollback
        setMessages(previousMessages);
        console.error("Failed to pin/unpin message:", error);

        const errorDetails = classifyError(error);
        if (errorDetails.isRetryable) {
          toast.error(shouldPin ? "Failed to pin message" : "Failed to unpin message", {
            description: errorDetails.message,
            action: {
              label: "Retry",
              onClick: () => pinMessage(messageId, shouldPin),
            },
          });
        } else {
          toast.error(shouldPin ? "Failed to pin message" : "Failed to unpin message", {
            description: errorDetails.message,
          });
        }
      }
    },
    [messages, activeChatId, core]
  );

  const branchOff = useCallback(
    async (messageId: string) => {
      if (!activeChatId) return null;

      try {
        // Create a branched chat
        const newChat = await core.chats.branch(activeChatId, messageId);

        toast.success("Conversation branched successfully", {
          description: `Created "${newChat.title}"`,
          duration: TOAST_DURATION.short,
        });

        return newChat;
      } catch (error) {
        console.error("Failed to branch conversation:", error);

        const errorDetails = classifyError(error);
        if (errorDetails.isRetryable) {
          toast.error("Failed to branch conversation", {
            description: errorDetails.message,
            action: {
              label: "Retry",
              onClick: () => branchOff(messageId),
            },
          });
        } else {
          toast.error("Failed to branch conversation", {
            description: errorDetails.message,
          });
        }

        return null;
      }
    },
    [activeChatId, core]
  );

  const regenerateMessage = useCallback(async () => {
    if (!activeChatId) return;

    try {
      setStreamingChatId(activeChatId);

      const stream = core.messages.regenerate(activeChatId);

      // Consume the stream
      for await (const update of stream) {
        setStreamingMessageId(update.messageId);

        // Reload messages
        const chatData = await core.chats.get(activeChatId);
        if (chatData) {
          setMessages(chatData.messages);
        }
      }

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
            onClick: () => regenerateMessage(),
          },
        }),
      });

      setStreamingChatId(null);
      setStreamingMessageId(null);
    }
  }, [activeChatId, core]);

  const stopMessage = useCallback(async () => {
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
  }, [streamingMessageId, core]);

  const sendMessage = useCallback(
    async (params: SendMessageParams) => {
      if (!activeChatId) {
        console.error("No active chat");
        return;
      }

      try {
        setStreamingChatId(activeChatId);

        const stream = core.chats.sendMessage(activeChatId, params);

        // Consume the stream
        for await (const update of stream) {
          setStreamingMessageId(update.messageId);

          // Reload messages
          const chatData = await core.chats.get(activeChatId);
          if (chatData) {
            setMessages(chatData.messages);
          }
        }

        setStreamingChatId(null);
        setStreamingMessageId(null);
      } catch (error) {
        console.error("Failed to send message:", error);
        setStreamingChatId(null);
        setStreamingMessageId(null);
      }
    },
    [activeChatId, core]
  );

  const stopStreaming = useCallback(async () => {
    if (streamingChatId && streamingMessageId) {
      await core.messages.stop(streamingMessageId);
      setStreamingChatId(null);
      setStreamingMessageId(null);
    }
  }, [streamingChatId, streamingMessageId, core]);

  return {
    messages,
    pinnedMessages,
    isStreaming,
    streamingChatId,
    streamingMessageId,
    editMessage,
    deleteMessage,
    pinMessage,
    branchOff,
    regenerateMessage,
    stopMessage,
    sendMessage,
    stopStreaming,
  };
}
