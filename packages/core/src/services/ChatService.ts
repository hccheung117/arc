import type { Chat } from "../domain/Chat.js";
import type { Message, MessageStatus } from "../domain/Message.js";
import type { ImageAttachment } from "../domain/ImageAttachment.js";
import type { IChatRepository } from "../repositories/IChatRepository.js";
import type { IMessageRepository } from "../repositories/IMessageRepository.js";
import type { OpenAIAdapter } from "../providers/openai/OpenAIAdapter.js";
import { ProviderError, ProviderErrorCode } from "../domain/ProviderError.js";
import { generateId } from "../utils/id.js";

/**
 * Update yielded during message streaming
 */
export interface MessageUpdate {
  messageId: string;
  content: string;
  status: MessageStatus;
}

/**
 * Result of a sendMessage operation
 */
export interface SendMessageResult {
  userMessageId: string;
  assistantMessageId: string;
}

/**
 * Search result with chat context
 */
export interface SearchResult {
  message: Message;
  chatTitle: string;
}

/**
 * ChatService orchestrates all chat-related operations
 *
 * Uses constructor injection for repositories to enable testing
 * and support different storage backends.
 */
export class ChatService {
  private chatRepo: IChatRepository;
  private messageRepo: IMessageRepository;
  private openAI: OpenAIAdapter;
  private model: string;
  private activeStreams = new Map<string, AbortController>();
  private runInTransaction: <T>(fn: () => Promise<T>) => Promise<T>;

  constructor(
    chatRepo: IChatRepository,
    messageRepo: IMessageRepository,
    openAI: OpenAIAdapter,
    model: string = "gpt-4-turbo-preview",
    runInTransaction?: <T>(fn: () => Promise<T>) => Promise<T>
  ) {
    this.chatRepo = chatRepo;
    this.messageRepo = messageRepo;
    this.openAI = openAI;
    this.model = model;
    this.runInTransaction = runInTransaction ?? ((fn) => fn());
  }

  // ============================================================================
  // Chat Operations
  // ============================================================================

  /**
   * Create a new chat
   * @returns The ID of the created chat
   */
  async createChat(title?: string): Promise<string> {
    const now = Date.now();
    const chat: Chat = {
      id: generateId(),
      title: title || "New Chat",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    };

    await this.runInTransaction(async () => {
      await this.chatRepo.create(chat);
    });
    return chat.id;
  }

  /**
   * Rename an existing chat
   */
  async renameChat(chatId: string, title: string): Promise<void> {
    await this.runInTransaction(async () => {
      const chat = await this.chatRepo.findById(chatId);
      if (!chat) {
        throw new Error(`Chat ${chatId} not found`);
      }

      chat.title = title;
      chat.updatedAt = Date.now();
      await this.chatRepo.update(chat);
    });
  }

  /**
   * Delete a chat and all its messages
   */
  async deleteChat(chatId: string): Promise<void> {
    // Stop any active stream for this chat
    const messages = await this.messageRepo.findByChatId(chatId);
    for (const msg of messages) {
      if (this.activeStreams.has(msg.id)) {
        const controller = this.activeStreams.get(msg.id);
        controller?.abort();
        this.activeStreams.delete(msg.id);
      }
    }

    // Delete all messages in the chat
    await this.runInTransaction(async () => {
      await this.messageRepo.deleteByChatId(chatId);
      // Delete the chat itself
      await this.chatRepo.delete(chatId);
    });
  }

  /**
   * Get all chats
   */
  async getChats(): Promise<Chat[]> {
    return this.chatRepo.findAll();
  }

  /**
   * Get a single chat by ID
   */
  async getChat(chatId: string): Promise<Chat | null> {
    return this.chatRepo.findById(chatId);
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * Get all messages for a chat
   */
  async getMessages(chatId: string): Promise<Message[]> {
    return this.messageRepo.findByChatId(chatId);
  }

  /**
   * Send a message and stream the assistant's response
   *
   * @param model Optional model override for this specific message
   * @returns AsyncGenerator that yields message updates, returns final result
   */
  async *sendMessage(
    chatId: string,
    content: string,
    attachments?: ImageAttachment[],
    model?: string
  ): AsyncGenerator<MessageUpdate, SendMessageResult, void> {
    const now = Date.now();
    let chat: Chat | null = null;
    let userMessage!: Message;
    let assistantMessage!: Message;

    await this.runInTransaction(async () => {
      const existingChat = await this.chatRepo.findById(chatId);
      if (!existingChat) {
        throw new Error(`Chat ${chatId} not found`);
      }

      chat = existingChat;

      // 1. Create and persist user message
      userMessage = {
        id: generateId(),
        chatId,
        role: "user",
        content,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
        status: "complete",
        createdAt: now,
        updatedAt: now,
      };
      await this.messageRepo.create(userMessage);

      // 2. Create pending assistant message
      assistantMessage = {
        id: generateId(),
        chatId,
        role: "assistant",
        content: "",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      await this.messageRepo.create(assistantMessage);

      // 3. Update chat timestamps
      chat.lastMessageAt = now;
      chat.updatedAt = now;
      await this.chatRepo.update(chat);
    });

    if (!chat) {
      throw new Error(`Chat ${chatId} not found`);
    }

    // 4. Build conversation history (all previous messages + current)
    const allMessages = await this.messageRepo.findByChatId(chatId);
    const conversationHistory = allMessages
      .filter((msg) => msg.role !== "assistant" || msg.status === "complete")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    // 5. Stream response from OpenAI
    const abortController = new AbortController();
    this.activeStreams.set(assistantMessage.id, abortController);

    try {
      const effectiveModel = model ?? this.model;
      const stream = this.openAI.streamChatCompletion(
        conversationHistory,
        effectiveModel,
        attachments,
        abortController.signal
      );

      for await (const chunk of stream) {
        // Check if streaming was aborted
        if (abortController.signal.aborted) {
          assistantMessage.status = "stopped";
          assistantMessage.updatedAt = Date.now();
          await this.messageRepo.update(assistantMessage);

          yield {
            messageId: assistantMessage.id,
            content: assistantMessage.content,
            status: "stopped",
          };

          return {
            userMessageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
          };
        }

        // Accumulate content
        assistantMessage.content += chunk;
        assistantMessage.status = "streaming";
        assistantMessage.updatedAt = Date.now();
        await this.messageRepo.update(assistantMessage);

        yield {
          messageId: assistantMessage.id,
          content: assistantMessage.content,
          status: "streaming",
        };
      }

      // 6. Mark as complete
      assistantMessage.status = "complete";
      assistantMessage.updatedAt = Date.now();
      await this.messageRepo.update(assistantMessage);

      yield {
        messageId: assistantMessage.id,
        content: assistantMessage.content,
        status: "complete",
      };

      return {
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      };
    } catch (error) {
      // Handle provider errors
      if (error instanceof ProviderError) {
        assistantMessage.status = "error";
        assistantMessage.content = error.getUserMessage();
        assistantMessage.updatedAt = Date.now();
        await this.messageRepo.update(assistantMessage);

        yield {
          messageId: assistantMessage.id,
          content: assistantMessage.content,
          status: "error",
        };

        // Re-throw to let caller handle if needed
        throw error;
      }

      // Handle unexpected errors
      assistantMessage.status = "error";
      assistantMessage.content = "An unexpected error occurred. Please try again.";
      assistantMessage.updatedAt = Date.now();
      await this.messageRepo.update(assistantMessage);

      yield {
        messageId: assistantMessage.id,
        content: assistantMessage.content,
        status: "error",
      };

      throw error;
    } finally {
      // Cleanup
      this.activeStreams.delete(assistantMessage.id);
    }
  }

  /**
   * Stop streaming for a specific message
   */
  async stopStreaming(messageId: string): Promise<void> {
    const controller = this.activeStreams.get(messageId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(messageId);
    }
  }

  /**
   * Regenerate an assistant message
   *
   * Finds the previous user message and generates a new response
   */
  async *regenerateMessage(
    messageId: string
  ): AsyncGenerator<MessageUpdate, SendMessageResult, void> {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (message.role !== "assistant") {
      throw new Error("Can only regenerate assistant messages");
    }

    // Find the previous user message in this chat
    const chatMessages = await this.messageRepo.findByChatId(message.chatId);
    const sortedMessages = chatMessages.sort((a, b) => a.createdAt - b.createdAt);
    const messageIndex = sortedMessages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      throw new Error("Message not found in chat");
    }

    const previousUserMessage = sortedMessages
      .slice(0, messageIndex)
      .reverse()
      .find((msg) => msg.role === "user");

    if (!previousUserMessage) {
      throw new Error("No user message found to regenerate from");
    }

    // Delete the current assistant message
    await this.runInTransaction(async () => {
      await this.messageRepo.delete(messageId);
    });

    // Send a new message with the user's content
    return yield* this.sendMessage(
      message.chatId,
      previousUserMessage.content,
      previousUserMessage.attachments
    );
  }

  /**
   * Delete a specific message
   */
  async deleteMessage(messageId: string): Promise<void> {
    // Stop streaming if this message is being generated
    if (this.activeStreams.has(messageId)) {
      await this.stopStreaming(messageId);
    }

    await this.runInTransaction(async () => {
      await this.messageRepo.delete(messageId);
    });
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search messages across all chats or within a specific chat
   * @param query Search query string
   * @param chatId Optional chat ID to scope search to a specific chat
   * @returns Search results with chat context, sorted by createdAt descending
   */
  async searchMessages(query: string, chatId?: string): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const messages = await this.messageRepo.search(query, chatId);

    // Enrich with chat titles
    const results: SearchResult[] = [];
    for (const message of messages) {
      const chat = await this.chatRepo.findById(message.chatId);
      if (chat) {
        results.push({
          message,
          chatTitle: chat.title,
        });
      }
    }

    return results;
  }

}
