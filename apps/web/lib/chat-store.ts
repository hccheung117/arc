import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chat, Message, ImageAttachment } from "./types";

interface ProviderSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
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

  // Provider settings
  providerSettings: ProviderSettings;

  // Error state
  lastError: ProviderErrorInfo | null;

  // Actions
  createChat: (title?: string) => string;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  sendMessage: (content: string, attachments?: ImageAttachment[]) => void;
  stopStreaming: () => void;
  regenerateMessage: (messageId: string) => void;
  deleteMessage: (id: string) => void;
  seedDemoChats: () => void;

  // Provider settings actions
  updateProviderSettings: (settings: Partial<ProviderSettings>) => void;

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

      // Provider settings with defaults
      providerSettings: {
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4-turbo-preview",
      },

      // Error state
      lastError: null,

  // Create a new chat
  createChat: (title?: string) => {
    const now = Date.now();
    const newChat: Chat = {
      id: generateId(),
      title: title || "New Chat",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    };

    set((state) => ({
      chats: [newChat, ...state.chats],
      activeChatId: newChat.id,
    }));

    return newChat.id;
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
  sendMessage: (content: string, attachments?: ImageAttachment[]) => {
    const { activeChatId, streamingChatId } = get();

    if (!activeChatId) {
      console.error("No active chat to send message to");
      return;
    }

    // Prevent concurrent streams
    if (streamingChatId) {
      console.warn("Already streaming in another chat");
      return;
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
    const { chats, activeChatId } = get();
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

  // Seed demo chats with example content
  seedDemoChats: () => {
    const baseTime = Date.now() - 3600000; // 1 hour ago
    const demoChats: Chat[] = [];
    const demoMessages: Message[] = [];

    // Chat 1: Code Examples
    const chat1Id = generateId();
    demoChats.push({
      id: chat1Id,
      title: "Code Examples",
      createdAt: baseTime,
      updatedAt: baseTime + 120000,
      lastMessageAt: baseTime + 120000,
    });

    demoMessages.push(
      {
        id: generateId(),
        chatId: chat1Id,
        role: "user",
        content: "Show me some code examples",
        status: "complete",
        createdAt: baseTime,
        updatedAt: baseTime,
      },
      {
        id: generateId(),
        chatId: chat1Id,
        role: "assistant",
        content: `Here are some code examples in different languages:

**JavaScript:**
\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

**Python:**
\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))
\`\`\`

**TypeScript:**
\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
\`\`\`

Try hovering over any code block to see the copy button!`,
        status: "complete",
        createdAt: baseTime + 120000,
        updatedAt: baseTime + 120000,
      }
    );

    // Chat 2: Diagrams & Visualizations
    const chat2Id = generateId();
    demoChats.push({
      id: chat2Id,
      title: "Diagrams & Visualizations",
      createdAt: baseTime + 900000,
      updatedAt: baseTime + 1020000,
      lastMessageAt: baseTime + 1020000,
    });

    demoMessages.push(
      {
        id: generateId(),
        chatId: chat2Id,
        role: "user",
        content: "Can you create diagrams?",
        status: "complete",
        createdAt: baseTime + 900000,
        updatedAt: baseTime + 900000,
      },
      {
        id: generateId(),
        chatId: chat2Id,
        role: "assistant",
        content: `Absolutely! Here are some Mermaid diagram examples:

**Flowchart:**
\`\`\`mermaid
graph TD
    A[Start] --> B{Is data valid?}
    B -->|Yes| C[Process data]
    B -->|No| D[Show error]
    C --> E[Save to database]
    E --> F[Send confirmation]
    D --> G[Request retry]
    F --> H[End]
    G --> A
\`\`\`

**Sequence Diagram:**
\`\`\`mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant Database

    User->>Browser: Click submit
    Browser->>Server: POST /api/data
    Server->>Database: INSERT query
    Database-->>Server: Success
    Server-->>Browser: 200 OK
    Browser-->>User: Show success message
\`\`\`

These diagrams are fully interactive and theme-aware!`,
        status: "complete",
        createdAt: baseTime + 1020000,
        updatedAt: baseTime + 1020000,
      }
    );

    // Chat 3: Math & Formulas
    const chat3Id = generateId();
    demoChats.push({
      id: chat3Id,
      title: "Math & Formulas",
      createdAt: baseTime + 1800000,
      updatedAt: baseTime + 1920000,
      lastMessageAt: baseTime + 1920000,
    });

    demoMessages.push(
      {
        id: generateId(),
        chatId: chat3Id,
        role: "user",
        content: "Show me some math notation",
        status: "complete",
        createdAt: baseTime + 1800000,
        updatedAt: baseTime + 1800000,
      },
      {
        id: generateId(),
        chatId: chat3Id,
        role: "assistant",
        content: `Here are some mathematical formulas rendered with LaTeX:

**Famous Equations:**

Einstein's mass-energy equivalence: $E=mc^2$

Pythagorean theorem: $a^2 + b^2 = c^2$

Euler's identity: $e^{i\\pi} + 1 = 0$

**Calculus:**

$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

**Linear Algebra:**

$$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} \\begin{bmatrix} x \\\\ y \\end{bmatrix} = \\begin{bmatrix} ax + by \\\\ cx + dy \\end{bmatrix}$$

**Statistics:**

Standard deviation: $\\sigma = \\sqrt{\\frac{1}{N}\\sum_{i=1}^N (x_i - \\mu)^2}$

All formulas are rendered beautifully with KaTeX!`,
        status: "complete",
        createdAt: baseTime + 1920000,
        updatedAt: baseTime + 1920000,
      }
    );

    // Chat 4: Rich Text Features
    const chat4Id = generateId();
    demoChats.push({
      id: chat4Id,
      title: "Rich Text Features",
      createdAt: baseTime + 2700000,
      updatedAt: baseTime + 2820000,
      lastMessageAt: baseTime + 2820000,
    });

    demoMessages.push(
      {
        id: generateId(),
        chatId: chat4Id,
        role: "user",
        content: "What formatting is supported?",
        status: "complete",
        createdAt: baseTime + 2700000,
        updatedAt: baseTime + 2700000,
      },
      {
        id: generateId(),
        chatId: chat4Id,
        role: "assistant",
        content: `# Rich Text Formatting

Arc supports full GitHub Flavored Markdown with many features:

## Text Styling

**Bold text** and *italic text* and ~~strikethrough~~

Inline code like \`useState\` and \`const\` are highlighted.

## Lists

**Ordered:**
1. First item
2. Second item
3. Third item

**Unordered:**
- React
- Vue
- Svelte

## Links

Check out [Claude AI](https://claude.ai) and [GitHub](https://github.com)

## Tables

| Feature | Supported | Details |
|---------|-----------|---------|
| Code blocks | ✅ | Syntax highlighting |
| Mermaid | ✅ | Diagrams & charts |
| LaTeX | ✅ | Math formulas |
| Tables | ✅ | GFM tables |

## Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

## Horizontal Rules

---

All of this is rendered in real-time with full theme support!`,
        status: "complete",
        createdAt: baseTime + 2820000,
        updatedAt: baseTime + 2820000,
      }
    );

    // Set the state with all demo chats and messages
    set({
      chats: demoChats,
      messages: demoMessages,
      activeChatId: chat1Id, // Select the first demo chat
    });
  },

  // Update provider settings
  updateProviderSettings: (settings: Partial<ProviderSettings>) => {
    set((state) => ({
      providerSettings: { ...state.providerSettings, ...settings },
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
        providerSettings: state.providerSettings,
        // Don't persist runtime state like streamIntervalId
      }),
    }
  )
);
