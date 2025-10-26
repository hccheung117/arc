import type { Message } from "./message.js";
import type { IMessageRepository } from "./message-repository.type.js";
import type { IChatRepository } from "../chats/chat-repository.type.js";
import type { Provider } from "@arc/ai/provider.js";
import type { IPlatformDatabase } from "@arc/platform";
import { MessageStreamer } from "./message-streamer.js";
import { RequestCancelledError } from "@arc/ai/errors.js";
import { generateId } from "../shared/id-generator.js";

/**
 * Update yielded during message regeneration
 */
export interface MessageStreamUpdate {
  messageId: string;
  content: string;
  status: "pending" | "streaming" | "complete" | "error" | "stopped";
}

/**
 * Result returned after regenerating a message
 */
export interface RegenerateResult {
  messageId: string;
}

/**
 * Public API for managing individual messages
 */
export class MessagesAPI {
  private messageRepo: IMessageRepository;
  private chatRepo: IChatRepository;
  private db: IPlatformDatabase;
  private getProvider: (configId: string) => Promise<Provider>;
  private streamer: MessageStreamer;

  constructor(
    messageRepo: IMessageRepository,
    chatRepo: IChatRepository,
    db: IPlatformDatabase,
    getProvider: (configId: string) => Promise<Provider>,
    streamer?: MessageStreamer
  ) {
    this.messageRepo = messageRepo;
    this.chatRepo = chatRepo;
    this.db = db;
    this.getProvider = getProvider;
    this.streamer = streamer ?? new MessageStreamer();
  }

  /**
   * Regenerate the last response in a chat
   *
   * This deletes the last assistant message and generates a new one
   * using the same user message.
   *
   * @param chatId - ID of the chat
   * @returns AsyncGenerator yielding stream updates
   */
  async *regenerate(
    chatId: string
  ): AsyncGenerator<MessageStreamUpdate, RegenerateResult, void> {
    const messages = await this.messageRepo.findByChatId(chatId);
    if (messages.length === 0) {
      throw new Error("No messages in chat to regenerate");
    }

    // Find the last assistant message
    const lastAssistantMessage = messages
      .reverse()
      .find((msg) => msg.role === "assistant");

    if (!lastAssistantMessage) {
      throw new Error("No assistant message to regenerate");
    }

    // Find the user message before it
    const messageIndex = messages.indexOf(lastAssistantMessage);
    const previousUserMessage = messages
      .slice(messageIndex + 1)
      .reverse()
      .find((msg) => msg.role === "user");

    if (!previousUserMessage) {
      throw new Error("No user message found to regenerate from");
    }

    // Delete the old assistant message
    await this.messageRepo.delete(lastAssistantMessage.id);

    // Create a new assistant message
    const now = Date.now();
    const newAssistantMessage: Message = {
      id: generateId(),
      chatId,
      role: "assistant",
      content: "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    await this.messageRepo.create(newAssistantMessage);

    // Build conversation history up to this point
    const allMessages = await this.messageRepo.findByChatId(chatId);
    const conversationHistory = allMessages
      .filter((msg) => msg.role !== "assistant" || msg.status === "complete")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((msg) => {
        const chatMsg: { role: typeof msg.role; content: string; images?: typeof msg.attachments } = {
          role: msg.role,
          content: msg.content,
        };
        if (msg.attachments) {
          chatMsg.images = msg.attachments;
        }
        return chatMsg;
      });

    // Get provider configuration from the last assistant message
    if (!lastAssistantMessage.model) {
      throw new Error("Cannot regenerate: original message has no model information");
    }
    if (!lastAssistantMessage.providerConnectionId) {
      throw new Error("Cannot regenerate: original message has no provider information");
    }

    const provider = await this.getProvider(lastAssistantMessage.providerConnectionId);
    const signal = this.streamer.startStreaming(newAssistantMessage.id);

    // Store model and provider info in new message
    newAssistantMessage.model = lastAssistantMessage.model;
    newAssistantMessage.providerConnectionId = lastAssistantMessage.providerConnectionId;
    await this.messageRepo.update(newAssistantMessage);

    try {
      const stream = provider.streamChatCompletion(
        conversationHistory,
        lastAssistantMessage.model,
        { signal }
      );

      for await (const chunk of stream) {
        if (signal.aborted) {
          throw new RequestCancelledError("Request was cancelled");
        }
        newAssistantMessage.content += chunk.content;
        newAssistantMessage.status = "streaming";
        newAssistantMessage.updatedAt = Date.now();
        await this.messageRepo.update(newAssistantMessage);

        yield {
          messageId: newAssistantMessage.id,
          content: newAssistantMessage.content,
          status: "streaming",
        };
      }

      if (signal.aborted) {
        throw new RequestCancelledError("Request was cancelled");
      }

      newAssistantMessage.status = "complete";
      newAssistantMessage.updatedAt = Date.now();
      await this.messageRepo.update(newAssistantMessage);

      yield {
        messageId: newAssistantMessage.id,
        content: newAssistantMessage.content,
        status: "complete",
      };

      this.streamer.completeStreaming(newAssistantMessage.id);

      return { messageId: newAssistantMessage.id };
    } catch (error) {
      // Handle cancellation vs error
      if (error instanceof RequestCancelledError || (error as any)?.name === 'RequestCancelledError') {
        newAssistantMessage.status = "stopped";
        newAssistantMessage.updatedAt = Date.now();
        await this.messageRepo.update(newAssistantMessage);

        this.streamer.completeStreaming(newAssistantMessage.id);

        yield {
          messageId: newAssistantMessage.id,
          content: newAssistantMessage.content,
          status: "stopped",
        };

        throw error;
      } else {
        newAssistantMessage.status = "error";
        newAssistantMessage.content = "An error occurred while regenerating.";
        newAssistantMessage.updatedAt = Date.now();
        await this.messageRepo.update(newAssistantMessage);

        this.streamer.completeStreaming(newAssistantMessage.id);

        yield {
          messageId: newAssistantMessage.id,
          content: newAssistantMessage.content,
          status: "error",
        };

        throw error;
      }
    }
  }

  /**
   * Edit a user's message
   *
   * This updates the message content. The UI can orchestrate additional
   * behavior like deleting subsequent messages and regenerating responses.
   *
   * @param messageId - ID of the message to edit
   * @param content - New content for the message
   */
  async edit(messageId: string, content: string): Promise<void> {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (message.role !== "user") {
      throw new Error("Can only edit user messages");
    }

    // Update the message
    message.content = content;
    message.updatedAt = Date.now();
    await this.messageRepo.update(message);
  }

  /**
   * Find all messages created after a specific message
   *
   * Useful for implementing edit+regenerate workflows in the UI,
   * where you need to delete subsequent messages before regenerating.
   *
   * @param messageId - ID of the reference message
   * @returns Messages created after this message, sorted by creation time
   */
  async findAfter(messageId: string): Promise<Message[]> {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const allMessages = await this.messageRepo.findByChatId(message.chatId);
    return allMessages
      .filter((msg) => msg.createdAt > message.createdAt)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Delete a single message
   *
   * Note: This may leave the conversation in an inconsistent state
   * if you delete a message in the middle of a conversation.
   */
  async delete(messageId: string): Promise<void> {
    // Stop streaming if this message is being generated
    this.streamer.stopStreaming(messageId);

    const deleted = await this.messageRepo.delete(messageId);
    if (!deleted) {
      throw new Error(`Message ${messageId} not found`);
    }
  }

  /**
   * Stop a specific in-progress response generation
   *
   * @param messageId - ID of the message to stop streaming
   */
  async stop(messageId: string): Promise<void> {
    this.streamer.stopStreaming(messageId);
  }
}
