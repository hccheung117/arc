import type { Chat } from "./chat.js";
import type { IChatRepository } from "./chat-repository.type.js";
import type { IMessageRepository } from "../messages/message-repository.type.js";
import type { Message } from "../messages/message.js";
import type { ImageAttachment } from "../shared/image-attachment.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { IPlatformDatabase } from "@arc/platform";
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
  private chatRepo: IChatRepository;
  private messageRepo: IMessageRepository;
  private db: IPlatformDatabase;
  private getProvider: (configId: string) => Promise<Provider>;
  private streamer: MessageStreamer;

  constructor(
    chatRepo: IChatRepository,
    messageRepo: IMessageRepository,
    db: IPlatformDatabase,
    getProvider: (configId: string) => Promise<Provider>,
    streamer?: MessageStreamer
  ) {
    this.chatRepo = chatRepo;
    this.messageRepo = messageRepo;
    this.db = db;
    this.getProvider = getProvider;
    this.streamer = streamer ?? new MessageStreamer();
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
      const stream = provider.streamChatCompletion(
        conversationHistory,
        params.model,
        { signal }
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
}
