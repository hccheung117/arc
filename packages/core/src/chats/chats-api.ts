import type { Chat } from "./chat.js";
import type { ChatRepository } from "./chat-repository.type.js";
import type { MessageRepository } from "../messages/message-repository.type.js";
import type { Message } from "../messages/message.js";
import type { ImageAttachment } from "../shared/image-attachment.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { PlatformDatabase } from "@arc/platform";
import type { SettingsAPI } from "../settings/settings-api.js";
import { PendingChat } from "./pending-chat.js";
import { MessageStreamer } from "../messages/message-streamer.js";
import { RequestCancelledError } from "@arc/ai/errors.js";
import { generateId } from "../shared/id-generator.js";

/**
 * Options for creating a new chat
 */
export interface CreateChatOptions {
  title?: string;
}

/**
 * Parameters for sending a message to an existing chat
 */
export interface SendMessageParams {
  content: string;
  model: string;
  providerConnectionId: string;
  images?: ImageAttachment[];
  options?: {
    temperature?: number;
    systemPrompt?: string;
  };
}

/**
 * Update yielded during message streaming
 */
export interface MessageStreamUpdate {
  messageId: string;
  content: string;
  status: "pending" | "streaming" | "complete" | "error" | "stopped";
}

/**
 * Result returned after sending a message
 */
export interface SendMessageResult {
  userMessageId: string;
  assistantMessageId: string;
}

/**
 * Chat with its messages
 */
export interface ChatWithMessages {
  chat: Chat;
  messages: Message[];
}

/**
 * Public API for managing chat sessions
 */
export class ChatsAPI {
  private chatRepo: ChatRepository;
  private messageRepo: MessageRepository;
  private db: PlatformDatabase;
  private getProvider: (configId: string) => Promise<Provider>;
  private streamer: MessageStreamer;
  private settingsAPI?: SettingsAPI;

  constructor(
    chatRepo: ChatRepository,
    messageRepo: MessageRepository,
    db: PlatformDatabase,
    getProvider: (configId: string) => Promise<Provider>,
    streamer?: MessageStreamer,
    settingsAPI?: SettingsAPI
  ) {
    this.chatRepo = chatRepo;
    this.messageRepo = messageRepo;
    this.db = db;
    this.getProvider = getProvider;
    this.streamer = streamer ?? new MessageStreamer();
    // Conditionally assign to satisfy exactOptionalPropertyTypes
    if (settingsAPI !== undefined) {
      this.settingsAPI = settingsAPI;
    }
  }

  /**
   * Start a new chat flow
   *
   * Returns a PendingChat builder. The chat is not persisted until
   * the first message is sent via `pendingChat.send()`.
   */
  create(options?: CreateChatOptions): PendingChat {
    const title = options?.title || "New Chat";
    return new PendingChat(
      title,
      this.chatRepo,
      this.messageRepo,
      this.db,
      this.getProvider,
      this.streamer
    );
  }

  /**
   * Get a single chat with all its messages
   */
  async get(id: string): Promise<ChatWithMessages | null> {
    const chat = await this.chatRepo.findById(id);
    if (!chat) {
      return null;
    }

    const messages = await this.messageRepo.findByChatId(id);

    return {
      chat,
      messages,
    };
  }

  /**
   * Get all chat sessions (metadata only, no messages)
   */
  async list(): Promise<Chat[]> {
    return this.chatRepo.findAll();
  }

  /**
   * Rename an existing chat
   */
  async rename(id: string, title: string): Promise<void> {
    const chat = await this.chatRepo.findById(id);
    if (!chat) {
      throw new Error(`Chat ${id} not found`);
    }

    chat.title = title;
    chat.updatedAt = Date.now();
    await this.chatRepo.update(chat);
  }

  /**
   * Delete a chat and its associated messages
   */
  async delete(id: string): Promise<void> {
    // Delete messages first (foreign key constraint)
    await this.db.transaction(async () => {
      await this.messageRepo.deleteByChatId(id);
      const deleted = await this.chatRepo.delete(id);
      if (!deleted) {
        throw new Error(`Chat ${id} not found`);
      }
    });
  }

  /**
   * Create a new chat by branching from an existing message
   *
   * Atomically creates a new chat and copies all messages up to
   * and including the branch point.
   *
   * @param chatId - Source chat ID
   * @param messageId - Branch point message ID
   * @returns The newly created chat
   */
  async branch(chatId: string, messageId: string): Promise<Chat> {
    const sourceChat = await this.chatRepo.findById(chatId);
    if (!sourceChat) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const branchMessage = await this.messageRepo.findById(messageId);
    if (!branchMessage || branchMessage.chatId !== chatId) {
      throw new Error(`Message ${messageId} not found in chat ${chatId}`);
    }

    const now = Date.now();
    const newChatId = generateId();

    // Get all messages up to and including branch point
    const allMessages = await this.messageRepo.findByChatId(chatId);
    const messagesToCopy = allMessages
      .filter((msg) => msg.createdAt <= branchMessage.createdAt)
      .sort((a, b) => a.createdAt - b.createdAt);

    await this.db.transaction(async () => {
      // 1. Create new chat with lineage
      const newChat: Chat = {
        id: newChatId,
        title: `${sourceChat.title} (Branch)`,
        parentChatId: chatId,
        parentMessageId: messageId,
        createdAt: now,
        updatedAt: now,
        lastMessageAt:
          messagesToCopy[messagesToCopy.length - 1]?.createdAt ?? now,
      };
      await this.chatRepo.create(newChat);

      // 2. Copy messages
      for (const msg of messagesToCopy) {
        const newMessage: Message = {
          ...msg,
          id: generateId(),
          chatId: newChatId,
          createdAt: now,
          updatedAt: now,
        };
        await this.messageRepo.create(newMessage);
      }
    });

    const createdChat = await this.chatRepo.findById(newChatId);
    if (!createdChat) {
      throw new Error("Failed to create branched chat");
    }

    return createdChat;
  }

  /**
   * Send a message to an existing chat
   *
   * @returns AsyncGenerator that yields stream updates
   */
  async *sendMessage(
    id: string,
    params: SendMessageParams
  ): AsyncGenerator<MessageStreamUpdate, SendMessageResult, void> {
    const chat = await this.chatRepo.findById(id);
    if (!chat) {
      throw new Error(`Chat ${id} not found`);
    }

    const now = Date.now();
    let userMessage: Message;
    let assistantMessage: Message;

    // Create messages in a transaction
    await this.db.transaction(async () => {
      // 1. Create user message
      userMessage = {
        id: generateId(),
        chatId: id,
        role: "user",
        content: params.content,
        status: "complete",
        createdAt: now,
        updatedAt: now,
      };
      // Conditionally add attachments to satisfy exactOptionalPropertyTypes
      if (params.images) {
        userMessage.attachments = params.images;
      }
      await this.messageRepo.create(userMessage);

      // 2. Create pending assistant message
      assistantMessage = {
        id: generateId(),
        chatId: id,
        role: "assistant",
        content: "",
        model: params.model,
        providerConnectionId: params.providerConnectionId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      // Conditionally add optional parameters to satisfy exactOptionalPropertyTypes
      if (params.options?.temperature !== undefined) {
        assistantMessage.temperature = params.options.temperature;
      }
      if (params.options?.systemPrompt !== undefined) {
        assistantMessage.systemPrompt = params.options.systemPrompt;
      }
      await this.messageRepo.create(assistantMessage);

      // 3. Update chat timestamps
      chat.lastMessageAt = now;
      chat.updatedAt = now;
      await this.chatRepo.update(chat);
    });

    // 4. Get conversation history
    const allMessages = await this.messageRepo.findByChatId(id);
    const conversationHistory = allMessages
      .filter((msg) => msg.role !== "assistant" || msg.status === "complete")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((msg) => {
        const chatMsg: { role: typeof msg.role; content: string; images?: ImageAttachment[] } = {
          role: msg.role,
          content: msg.content,
        };
        if (msg.attachments) {
          chatMsg.images = msg.attachments;
        }
        return chatMsg;
      });

    // 5. Stream AI response
    const provider = await this.getProvider(params.providerConnectionId);

    // Start streaming and get abort signal
    const signal = this.streamer.startStreaming(assistantMessage!.id);

    try {
      // Build options object conditionally to satisfy exactOptionalPropertyTypes
      const streamOptions: {
        signal: AbortSignal;
        temperature?: number;
        systemPrompt?: string;
      } = { signal };
      if (params.options?.temperature !== undefined) {
        streamOptions.temperature = params.options.temperature;
      }
      if (params.options?.systemPrompt !== undefined) {
        streamOptions.systemPrompt = params.options.systemPrompt;
      }

      const stream = provider.streamChatCompletion(
        conversationHistory,
        params.model,
        streamOptions
      );

      for await (const chunk of stream) {
        // Proactive cancellation: if provider didn't throw yet, respect aborted signal
        if (signal.aborted) {
          throw new RequestCancelledError("Request was cancelled");
        }
        assistantMessage!.content += chunk.content;
        assistantMessage!.status = "streaming";
        assistantMessage!.updatedAt = Date.now();
        await this.messageRepo.update(assistantMessage!);

        yield {
          messageId: assistantMessage!.id,
          content: assistantMessage!.content,
          status: "streaming",
        };
      }

      // If aborted during or right after streaming, treat as cancelled
      if (signal.aborted) {
        throw new RequestCancelledError("Request was cancelled");
      }

      // Mark as complete
      assistantMessage!.status = "complete";
      assistantMessage!.updatedAt = Date.now();
      await this.messageRepo.update(assistantMessage!);

      // Clean up streamer
      this.streamer.completeStreaming(assistantMessage!.id);

      yield {
        messageId: assistantMessage!.id,
        content: assistantMessage!.content,
        status: "complete",
      };

      // Trigger auto-titling in the background (fire-and-forget)
      this.autoGenerateTitle(id).catch(() => {
        // Silently ignore errors
      });

      return {
        userMessageId: userMessage!.id,
        assistantMessageId: assistantMessage!.id,
      };
    } catch (error) {
      // Handle cancellation vs error
      if (error instanceof RequestCancelledError || (error as any)?.name === 'RequestCancelledError') {
        assistantMessage!.status = "stopped";
        assistantMessage!.updatedAt = Date.now();
        await this.messageRepo.update(assistantMessage!);

        // Clean up streamer
        this.streamer.completeStreaming(assistantMessage!.id);

        yield {
          messageId: assistantMessage!.id,
          content: assistantMessage!.content,
          status: "stopped",
        };

        throw error;
      } else {
        // Mark as error
        assistantMessage!.status = "error";
        assistantMessage!.content = "An error occurred while generating the response.";
        assistantMessage!.updatedAt = Date.now();
        await this.messageRepo.update(assistantMessage!);

        // Clean up streamer
        this.streamer.completeStreaming(assistantMessage!.id);

        yield {
          messageId: assistantMessage!.id,
          content: assistantMessage!.content,
          status: "error",
        };

        throw error;
      }
    }
  }

  /**
   * Automatically generate a title for a chat based on its conversation
   *
   * This is a background operation that silently fails if it encounters errors.
   * Only generates title if:
   * - Auto-titling is enabled in settings
   * - Chat title is still "New Chat"
   * - Chat has at least 2 messages (one exchange)
   *
   * @param chatId - ID of the chat to title
   */
  private async autoGenerateTitle(chatId: string): Promise<void> {
    try {
      // Check if auto-titling is enabled
      if (this.settingsAPI) {
        const settings = await this.settingsAPI.get();
        if (!settings.autoTitleChats) return;
      }

      const chat = await this.chatRepo.findById(chatId);
      if (!chat || chat.title !== "New Chat") return;

      const messages = await this.messageRepo.findByChatId(chatId);
      if (messages.length < 2) return; // Need at least one exchange

      // Get first few messages for context
      const conversationStart = messages
        .slice(0, 4)
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const titlePrompt: { role: "user" | "assistant" | "system"; content: string }[] = [
        {
          role: "user",
          content: `Generate a concise 2-5 word title for this conversation:\n\n${conversationStart}\n\nTitle:`,
        },
      ];

      // Use the same provider as the last message
      const lastAssistant = messages
        .reverse()
        .find((m) => m.role === "assistant");
      if (!lastAssistant?.providerConnectionId || !lastAssistant?.model)
        return;

      const provider = await this.getProvider(
        lastAssistant.providerConnectionId
      );
      const result = await provider.generateChatCompletion(
        titlePrompt,
        lastAssistant.model
      );

      // Clean up title (remove quotes, trim, limit length)
      const title = result.content
        .trim()
        .replace(/^["']|["']$/g, "")
        .slice(0, 60);

      chat.title = title;
      chat.updatedAt = Date.now();
      await this.chatRepo.update(chat);
    } catch (error) {
      // Silent failure - title generation is a nice-to-have
      // console.warn("Auto-title generation failed:", error);
    }
  }
}
