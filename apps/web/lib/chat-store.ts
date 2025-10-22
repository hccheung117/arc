import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chat, Message, ImageAttachment } from "./types";
import type { IChatAPI } from "./api/chat-api.interface";

export type Theme = "light" | "dark" | "system";

export interface ProviderConfig {
  id: string;
  provider: "openai" | "anthropic" | "google";
  apiKey?: string;  // Optional for proxies that don't need keys
  baseUrl?: string;
  defaultModel?: string;  // Renamed from "model" for clarity
}

interface ProviderErrorInfo {
  code: string;
  message: string;
  userMessage: string;
  isRetryable: boolean;
}

interface ChatState {
  // State
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
  streamingChatId: string | null;
  streamIntervalId: NodeJS.Timeout | null;
  transientChat: Chat | null; // Temporary chat not yet persisted
  api: IChatAPI | null; // API instance for persistence

  // App settings
  theme: Theme;
  fontSize: number;
  providerConfigs: ProviderConfig[];  // Changed from single to array
  isHydrated: boolean;

  // Error state
  lastError: ProviderErrorInfo | null;

  // Actions
  createChat: (title?: string, isTransient?: boolean) => string;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  sendMessage: (content: string, attachments?: ImageAttachment[], model?: string) => void;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => void;
  deleteMessage: (id: string) => void;
  seedLargeDataset: () => void;
  convertTransientToPersistent: () => string | null;
  setAPI: (api: IChatAPI) => void;

  // App settings actions
  setTheme: (theme: Theme) => void;
  setFontSize: (fontSize: number) => void;

  // Provider management actions
  addProvider: (config: Omit<ProviderConfig, "id">) => void;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => void;
  deleteProvider: (id: string) => void;

  // Error actions
  setError: (error: ProviderErrorInfo) => void;
  clearError: () => void;

  // Computed
  getActiveChat: () => Chat | null;
  getActiveChatMessages: () => Message[];
}

// Helper to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Helper to generate echo-based fake response
const generateEchoResponse = (userMessage: string): string => {
  const responses = [
    `You said: "${userMessage}". That's an interesting point! Let me expand on that. `,
    `I understand you mentioned: "${userMessage}". Here's my perspective on this topic. `,
    `Thanks for sharing "${userMessage}". Based on your input, I'd like to add that `,
  ];

  const intro = responses[Math.floor(Math.random() * responses.length)];
  const body = "This is a simulated streaming response to demonstrate the chat functionality. In a real implementation, this would be replaced with actual AI responses from your configured provider. The streaming effect helps create a natural conversation flow.";

  return intro + body;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      chats: [],
      messages: [],
      activeChatId: null,
      streamingChatId: null,
      streamIntervalId: null,
      transientChat: null,
      api: null,

      // App settings with defaults
      theme: "system",
      fontSize: 16,
      providerConfigs: [],
      isHydrated: false,

      // Error state
      lastError: null,

  // Create a new chat
  createChat: (title?: string, isTransient = false) => {
    const now = Date.now();
    const newChat: Chat = {
      id: generateId(),
      title: title || (isTransient ? "" : "New Chat"),
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      ...(isTransient && { isTransient: true }),
    };

    if (isTransient) {
      // Transient chat: store separately, don't add to chats array
      set({
        transientChat: newChat,
        activeChatId: newChat.id,
      });
    } else {
      // Regular chat: add to chats array
      set((state) => ({
        chats: [newChat, ...state.chats],
        activeChatId: newChat.id,
        transientChat: null, // Clear any existing transient chat
      }));
    }

    return newChat.id;
  },

  // Convert transient chat to persistent
  convertTransientToPersistent: () => {
    const { transientChat, api } = get();

    if (!transientChat) {
      return null;
    }

    // Remove isTransient flag and add to chats array
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isTransient, ...chatWithoutTransient } = transientChat;
    const persistentChat: Chat = {
      ...chatWithoutTransient,
      title: chatWithoutTransient.title || "New Chat",
    };

    set((state) => ({
      chats: [persistentChat, ...state.chats],
      transientChat: null,
    }));

    // Persist to SQLite database if API is available
    if (api) {
      api.createChat(persistentChat.title).catch((error) => {
        console.error("Failed to persist chat to database:", error);
      });
    }

    return persistentChat.id;
  },

  // Select a different chat
  selectChat: (id: string) => {
    // Stop any ongoing streaming when switching chats
    const { streamIntervalId } = get();
    if (streamIntervalId) {
      clearInterval(streamIntervalId);
    }

    set({
      activeChatId: id,
      streamingChatId: null,
      streamIntervalId: null,
    });
  },

  // Rename a chat
  renameChat: (id: string, title: string) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id
          ? { ...chat, title, updatedAt: Date.now() }
          : chat
      ),
    }));
  },

  // Delete a chat and its messages
  deleteChat: (id: string) => {
    const { chats, activeChatId, streamIntervalId } = get();

    // Clear streaming if deleting active chat
    if (id === activeChatId && streamIntervalId) {
      clearInterval(streamIntervalId);
    }

    const remainingChats = chats.filter((chat) => chat.id !== id);

    set((state) => ({
      chats: remainingChats,
      messages: state.messages.filter((msg) => msg.chatId !== id),
      activeChatId: id === activeChatId
        ? (remainingChats[0]?.id || null)
        : activeChatId,
      streamingChatId: id === state.streamingChatId ? null : state.streamingChatId,
      streamIntervalId: id === activeChatId ? null : streamIntervalId,
    }));
  },

  // Send a message and trigger fake streaming
  sendMessage: (content: string, attachments?: ImageAttachment[], model = "gpt-4-turbo-preview") => {
    const { streamingChatId, transientChat, api } = get();
    let { activeChatId } = get();

    if (!activeChatId) {
      console.error("No active chat to send message to");
      return;
    }

    // Convert transient chat to persistent before sending first message
    if (transientChat && activeChatId === transientChat.id) {
      const convertedChatId = get().convertTransientToPersistent();
      if (!convertedChatId) {
        console.error("Failed to convert transient chat to persistent");
        return;
      }
      activeChatId = convertedChatId;
    }

    // Prevent concurrent streams
    if (streamingChatId) {
      console.warn("Already streaming in another chat");
      return;
    }

    // Persist message to SQLite database if API is available
    if (api) {
      api.sendMessage(activeChatId, content, model, attachments).catch((error) => {
        console.error("Failed to persist message to database:", error);
      });
    }

    const now = Date.now();

    // 1. Add user message
    const userMessage: Message = {
      id: generateId(),
      chatId: activeChatId,
      role: "user",
      content,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      status: "complete",
      createdAt: now,
      updatedAt: now,
    };

    // 2. Create pending assistant message
    const assistantMessage: Message = {
      id: generateId(),
      chatId: activeChatId,
      role: "assistant",
      content: "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      chats: state.chats.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, lastMessageAt: now, updatedAt: now }
          : chat
      ),
      streamingChatId: activeChatId,
    }));

    // 3. Start fake streaming
    const fullResponse = generateEchoResponse(content);
    let currentIndex = 0;

    const intervalId = setInterval(() => {
      const state = get();

      // Safety check: stop if chat changed or was cleared
      if (state.activeChatId !== activeChatId || state.streamingChatId !== activeChatId) {
        clearInterval(intervalId);
        return;
      }

      currentIndex++;

      if (currentIndex <= fullResponse.length) {
        // Stream next character
        const currentContent = fullResponse.slice(0, currentIndex);

        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  content: currentContent,
                  status: "streaming",
                  updatedAt: Date.now(),
                }
              : msg
          ),
        }));
      } else {
        // Streaming complete
        clearInterval(intervalId);

        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  status: "complete",
                  updatedAt: Date.now(),
                }
              : msg
          ),
          streamingChatId: null,
          streamIntervalId: null,
        }));
      }
    }, 50); // Stream at ~20 characters per second

    set({ streamIntervalId: intervalId });
  },

  // Stop the current streaming
  stopStreaming: () => {
    const { streamIntervalId, streamingChatId } = get();

    if (!streamIntervalId || !streamingChatId) {
      return;
    }

    clearInterval(streamIntervalId);

    // Mark the streaming message as stopped
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.chatId === streamingChatId && msg.status === "streaming"
          ? { ...msg, status: "stopped", updatedAt: Date.now() }
          : msg
      ),
      streamingChatId: null,
      streamIntervalId: null,
    }));
  },

  // Regenerate the last assistant message
  regenerateMessage: (messageId: string) => {
    const { messages } = get();
    const messageToRegenerate = messages.find((msg) => msg.id === messageId);

    if (!messageToRegenerate || messageToRegenerate.role !== "assistant") {
      console.error("Invalid message to regenerate");
      return;
    }

    // Find the previous user message
    const chatMessages = messages
      .filter((msg) => msg.chatId === messageToRegenerate.chatId)
      .sort((a, b) => a.createdAt - b.createdAt);

    const messageIndex = chatMessages.findIndex((msg) => msg.id === messageId);
    const previousUserMessage = chatMessages
      .slice(0, messageIndex)
      .reverse()
      .find((msg) => msg.role === "user");

    if (!previousUserMessage) {
      console.error("No user message found to regenerate from");
      return;
    }

    // Delete the current assistant message
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId),
    }));

    // Resend the user message to trigger new response
    get().sendMessage(previousUserMessage.content);
  },

  // Delete a specific message
  deleteMessage: (id: string) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    }));
  },

  // Get the active chat
  getActiveChat: () => {
    const { chats, activeChatId, transientChat } = get();
    // Check transient chat first, then regular chats
    if (transientChat && activeChatId === transientChat.id) {
      return transientChat;
    }
    return chats.find((chat) => chat.id === activeChatId) || null;
  },

  // Get messages for the active chat
  getActiveChatMessages: () => {
    const { messages, activeChatId } = get();
    if (!activeChatId) return [];

    return messages
      .filter((msg) => msg.chatId === activeChatId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  // Seed large dataset for performance testing
  seedLargeDataset: () => {
    const baseTime = Date.now() - 86400000; // 24 hours ago
    const largeChats: Chat[] = [];
    const largeMessages: Message[] = [];

    const topics = [
      "React Performance Optimization",
      "TypeScript Best Practices",
      "Database Design Patterns",
      "API Security",
      "Frontend Architecture",
      "Testing Strategies",
      "DevOps Workflows",
      "Code Review Process",
      "System Design",
      "Mobile Development",
    ];

    const sampleQuestions = [
      "How can I improve performance?",
      "What are the best practices?",
      "Can you explain this concept?",
      "Show me an example",
      "What's the recommended approach?",
      "Help me debug this issue",
      "How does this work?",
      "Compare these two options",
      "What are the trade-offs?",
      "Explain in detail",
    ];

    const sampleResponses = [
      "Here's a comprehensive explanation. ",
      "Let me break this down for you. ",
      "Great question! Let's explore this. ",
      "I'll provide several examples. ",
      "Here are the key points to consider. ",
    ];

    // Create 10 chats
    for (let i = 0; i < 10; i++) {
      const chatId = generateId();
      const chatBaseTime = baseTime + i * 3600000; // Space chats 1 hour apart

      largeChats.push({
        id: chatId,
        title: topics[i] || `Chat ${i + 1}`,
        createdAt: chatBaseTime,
        updatedAt: chatBaseTime + 7200000,
        lastMessageAt: chatBaseTime + 7200000,
      });

      // Create 100+ messages per chat
      for (let j = 0; j < 110; j++) {
        const messageTime = chatBaseTime + j * 60000; // 1 minute apart

        // User message
        largeMessages.push({
          id: generateId(),
          chatId,
          role: "user",
          content: `${sampleQuestions[j % sampleQuestions.length]} (Message ${j + 1} in ${topics[i] || `Chat ${i + 1}`})`,
          status: "complete",
          createdAt: messageTime,
          updatedAt: messageTime,
        });

        // Assistant response
        const responseContent = `${sampleResponses[j % sampleResponses.length]}This is message ${j + 1} of 110 in the "${topics[i] || `Chat ${i + 1}`}" conversation. ${
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(3)
        }Here's some code:\n\n\`\`\`typescript\nconst example${j} = () => {\n  return "Example ${j}";\n};\n\`\`\`\n\nSearchable keyword: item${j}`;

        largeMessages.push({
          id: generateId(),
          chatId,
          role: "assistant",
          content: responseContent,
          status: "complete",
          createdAt: messageTime + 30000, // 30 seconds after user message
          updatedAt: messageTime + 30000,
        });
      }
    }

    console.log(
      `Seeded ${largeChats.length} chats with ${largeMessages.length} messages total (avg ${Math.floor(largeMessages.length / largeChats.length)} per chat)`
    );

    // Set the state with all large dataset
    set({
      chats: largeChats,
      messages: largeMessages,
      activeChatId: largeChats[0]?.id || null,
    });
  },

  // Set API instance for persistence
  setAPI: (api: IChatAPI) => {
    set({ api });
  },

  // Update app settings
  setTheme: (theme: Theme) => {
    set({ theme });
  },

  setFontSize: (fontSize: number) => {
    set({ fontSize });
  },

  // Provider management actions
  addProvider: (config: Omit<ProviderConfig, "id">) => {
    set((state) => {
      // Check if provider type already exists
      const exists = state.providerConfigs.some((p) => p.provider === config.provider);
      if (exists) {
        console.warn(`Provider ${config.provider} already exists. Use updateProvider instead.`);
        return state;
      }
      // Generate unique ID
      const id = generateId();
      const newConfig: ProviderConfig = { ...config, id };
      return {
        providerConfigs: [...state.providerConfigs, newConfig],
      };
    });
  },

  updateProvider: (id: string, updates: Partial<ProviderConfig>) => {
    set((state) => {
      // If updating provider type, check for duplicates
      if (updates.provider) {
        const duplicate = state.providerConfigs.some(
          (p) => p.id !== id && p.provider === updates.provider
        );
        if (duplicate) {
          console.warn(`Provider ${updates.provider} already exists.`);
          return state;
        }
      }
      return {
        providerConfigs: state.providerConfigs.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      };
    });
  },

  deleteProvider: (id: string) => {
    set((state) => ({
      providerConfigs: state.providerConfigs.filter((p) => p.id !== id),
    }));
  },

  // Set error
  setError: (error: ProviderErrorInfo) => {
    set({ lastError: error });
  },

  // Clear error
  clearError: () => {
    set({ lastError: null });
  },
}),
    {
      name: "arc-chat-storage",
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        providerConfigs: state.providerConfigs,  // Changed from providerConfig to providerConfigs
        chats: state.chats,
        messages: state.messages,
        // Don't persist runtime state like streamIntervalId, activeChatId, streamingChatId, isHydrated, transientChat
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // Data migration: Convert old single providerConfig to array providerConfigs
            // @ts-expect-error - Old data structure might have providerConfig instead of providerConfigs
            if (state.providerConfig && !state.providerConfigs) {
              // @ts-expect-error - Accessing old property for migration
              const oldConfig = state.providerConfig;

              // Convert old config to new array structure
              state.providerConfigs = [
                {
                  id: generateId(),
                  provider: oldConfig.provider,
                  apiKey: oldConfig.apiKey,
                  ...(oldConfig.baseUrl && { baseUrl: oldConfig.baseUrl }),
                  ...(oldConfig.model && { defaultModel: oldConfig.model }),
                },
              ];

              // Remove old property
              // @ts-expect-error - Removing old property
              delete state.providerConfig;

              console.log("Migrated provider configuration from old format to new array format");
            }

            // Add IDs to existing configs that don't have them, remove enabled field
            if (state.providerConfigs) {
              state.providerConfigs = state.providerConfigs.map((config) => {
                // @ts-expect-error - Removing old enabled property if it exists
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { enabled, ...rest } = config;
                return {
                  ...rest,
                  id: config.id || generateId(),
                };
              });
            }

            state.isHydrated = true;
          }
        };
      },
    }
  )
);
