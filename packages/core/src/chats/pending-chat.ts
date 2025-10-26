import type { Chat } from "./chat.js";
import type { ChatRepository } from "./chat-repository.type.js";
import type { MessageRepository } from "../messages/message-repository.type.js";
import type { Message } from "../messages/message.js";
import type { ImageAttachment } from "../shared/image-attachment.js";
import type { Provider } from "@arc/ai/provider.js";
import type { PlatformDatabase } from "@arc/platform";
import { MessageStreamer } from "../messages/message-streamer.js";
import { RequestCancelledError } from "@arc/ai/errors.js";
import { generateId } from "../shared/id-generator.js";

/**
 * Parameters for sending the first message in a pending chat
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
  chatId: string;
  messageId: string;
  content: string;
  status: "pending" | "streaming" | "complete" | "error" | "stopped";
}

/**
 * Result returned after sending the first message
 */
export interface SendMessageResult {
  chatId: string;
  userMessageId: string;
  assistantMessageId: string;
}

/**
 * PendingChat builder - represents a chat that hasn't been persisted yet
 *
 * Usage:
 * ```typescript
 * const pendingChat = core.chats.create({ title: 'My Chat' });
 * const { stream } = await pendingChat.send({
 *   content: 'Hello',
 *   model: 'gpt-4',
 *   providerConnectionId: 'openai-1'
 * });
 * ```
 */
export class PendingChat {
  readonly id: string;
  readonly title: string;

  private chatRepo: ChatRepository;
  private messageRepo: MessageRepository;
  private db: PlatformDatabase;
  private getProvider: (configId: string) => Promise<Provider>;
  private streamer: MessageStreamer;

  constructor(
    title: string,
    chatRepo: ChatRepository,
    messageRepo: MessageRepository,
    db: PlatformDatabase,
    getProvider: (configId: string) => Promise<Provider>,
    streamer?: MessageStreamer
  ) {
    this.id = generateId();
    this.title = title;
    this.chatRepo = chatRepo;
    this.messageRepo = messageRepo;
    this.db = db;
    this.getProvider = getProvider;
    this.streamer = streamer ?? new MessageStreamer();
  }

  /**
   * Send the first message in this chat
   *
   * This operation:
   * 1. Creates the chat in the database
   * 2. Creates the user message
   * 3. Creates a pending assistant message
   * 4. Streams the AI response
   *
   * All database operations are atomic (wrapped in a transaction).
   *
   * @returns AsyncGenerator that yields stream updates and returns the final result
   */
  async *send(
    params: SendMessageParams
  ): AsyncGenerator<MessageStreamUpdate, SendMessageResult, void> {
    const now = Date.now();

    // Create chat and messages in a transaction
    let chat: Chat;
    let userMessage: Message;
    let assistantMessage: Message;

    await this.db.transaction(async () => {
      // 1. Create the chat
      chat = {
        id: this.id,
        title: this.title,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
      };
      await this.chatRepo.create(chat);

      // 2. Create user message
      userMessage = {
        id: generateId(),
        chatId: this.id,
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

      // 3. Create pending assistant message
      assistantMessage = {
        id: generateId(),
        chatId: this.id,
        role: "assistant",
        content: "",
        model: params.model,
        providerConnectionId: params.providerConnectionId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      await this.messageRepo.create(assistantMessage);
    });

    // 4. Stream AI response
    const provider = await this.getProvider(params.providerConnectionId);

    // Start streaming and get abort signal
    const signal = this.streamer.startStreaming(assistantMessage!.id);

    try {
      // Build chat message with conditional images property
      const userChatMessage: { role: "user"; content: string; images?: ImageAttachment[] } = {
        role: "user",
        content: params.content,
      };
      if (params.images) {
        userChatMessage.images = params.images;
      }

      const stream = provider.streamChatCompletion(
        [userChatMessage],
        params.model,
        { signal }
      );

      for await (const chunk of stream) {
        if (signal.aborted) {
          throw new RequestCancelledError("Request was cancelled");
        }
        assistantMessage!.content += chunk.content;
        assistantMessage!.status = "streaming";
        assistantMessage!.updatedAt = Date.now();
        await this.messageRepo.update(assistantMessage!);

        yield {
          chatId: this.id,
          messageId: assistantMessage!.id,
          content: assistantMessage!.content,
          status: "streaming",
        };
      }

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
        chatId: this.id,
        messageId: assistantMessage!.id,
        content: assistantMessage!.content,
        status: "complete",
      };

      return {
        chatId: this.id,
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
          chatId: this.id,
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
          chatId: this.id,
          messageId: assistantMessage!.id,
          content: assistantMessage!.content,
          status: "error",
        };

        throw error;
      }
    }
  }
}
