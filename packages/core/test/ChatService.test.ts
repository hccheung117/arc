import { describe, it, expect, beforeEach } from "vitest";
import { ChatService } from "../src/services/ChatService.js";
import { InMemoryChatRepository } from "../src/repositories/InMemoryChatRepository.js";
import { InMemoryMessageRepository } from "../src/repositories/InMemoryMessageRepository.js";

describe("ChatService", () => {
  let chatService: ChatService;
  let chatRepo: InMemoryChatRepository;
  let messageRepo: InMemoryMessageRepository;

  beforeEach(() => {
    chatRepo = new InMemoryChatRepository();
    messageRepo = new InMemoryMessageRepository();
    chatService = new ChatService(chatRepo, messageRepo);
  });

  describe("Chat Operations", () => {
    it("should create a new chat", async () => {
      const chatId = await chatService.createChat("Test Chat");

      expect(chatId).toBeDefined();
      expect(typeof chatId).toBe("string");

      const chat = await chatService.getChat(chatId);
      expect(chat).toBeDefined();
      expect(chat?.title).toBe("Test Chat");
    });

    it("should create a chat with default title", async () => {
      const chatId = await chatService.createChat();

      const chat = await chatService.getChat(chatId);
      expect(chat?.title).toBe("New Chat");
    });

    it("should rename a chat", async () => {
      const chatId = await chatService.createChat("Old Title");
      await chatService.renameChat(chatId, "New Title");

      const chat = await chatService.getChat(chatId);
      expect(chat?.title).toBe("New Title");
    });

    it("should delete a chat and its messages", async () => {
      const chatId = await chatService.createChat("Test Chat");

      // Send a message
      const stream = chatService.sendMessage(chatId, "Hello");
      for await (const _update of stream) {
        // Consume stream
      }

      // Verify messages exist
      const messagesBefore = await chatService.getMessages(chatId);
      expect(messagesBefore.length).toBe(2); // user + assistant

      // Delete chat
      await chatService.deleteChat(chatId);

      // Verify chat is deleted
      const chat = await chatService.getChat(chatId);
      expect(chat).toBeNull();

      // Verify messages are deleted
      const messagesAfter = await chatService.getMessages(chatId);
      expect(messagesAfter.length).toBe(0);
    });

    it("should get all chats sorted by lastMessageAt", async () => {
      const chatId1 = await chatService.createChat("Chat 1");
      await new Promise((resolve) => setTimeout(resolve, 10));
      const chatId2 = await chatService.createChat("Chat 2");

      const chats = await chatService.getChats();
      expect(chats.length).toBe(2);
      expect(chats[0]?.id).toBe(chatId2); // Most recent first
      expect(chats[1]?.id).toBe(chatId1);
    });
  });

  describe("Message Operations", () => {
    it("should send a message with streaming", async () => {
      const chatId = await chatService.createChat("Test Chat");

      const updates: string[] = [];
      const stream = chatService.sendMessage(chatId, "Hello");

      for await (const update of stream) {
        updates.push(update.content);
        expect(update.messageId).toBeDefined();
        expect(["pending", "streaming", "complete"]).toContain(update.status);
      }

      // Should have received multiple updates (streaming)
      expect(updates.length).toBeGreaterThan(1);

      // Last update should be the complete message
      const lastUpdate = updates[updates.length - 1];
      expect(lastUpdate).toBeDefined();
      expect(lastUpdate?.length).toBeGreaterThan(0);

      // Verify messages were persisted
      const messages = await chatService.getMessages(chatId);
      expect(messages.length).toBe(2); // user + assistant
      expect(messages[0]?.role).toBe("user");
      expect(messages[0]?.content).toBe("Hello");
      expect(messages[1]?.role).toBe("assistant");
      expect(messages[1]?.status).toBe("complete");
    });

    it("should send a message with attachments", async () => {
      const chatId = await chatService.createChat("Test Chat");

      const attachment = {
        id: "attach-1",
        data: "data:image/png;base64,iVBORw0KGgo=",
        mimeType: "image/png",
        size: 1024,
      };

      const stream = chatService.sendMessage(chatId, "Check this out", [
        attachment,
      ]);

      // Consume stream
      for await (const _update of stream) {
        // Just consume
      }

      const messages = await chatService.getMessages(chatId);
      const userMessage = messages.find((m) => m.role === "user");
      expect(userMessage?.attachments).toBeDefined();
      expect(userMessage?.attachments?.length).toBe(1);
      expect(userMessage?.attachments?.[0]?.id).toBe("attach-1");
    });

    it("should stop streaming mid-stream", async () => {
      const chatId = await chatService.createChat("Test Chat");

      const updates: string[] = [];
      const stream = chatService.sendMessage(chatId, "Hello");

      let messageId = "";
      let count = 0;
      for await (const update of stream) {
        messageId = update.messageId;
        updates.push(update.content);
        count++;

        // Stop after a few updates
        if (count === 3) {
          await chatService.stopStreaming(messageId);
        }
      }

      // Should have stopped early
      expect(count).toBeLessThan(50); // Full stream would be much longer

      // Verify message is marked as stopped
      const messages = await chatService.getMessages(chatId);
      const assistantMessage = messages.find((m) => m.role === "assistant");
      expect(assistantMessage?.status).toBe("stopped");
    });

    it.skip("should regenerate an assistant message", async () => {
      const chatId = await chatService.createChat("Test Chat");

      // Send original message
      const stream1 = chatService.sendMessage(chatId, "Original");
      let assistantMessageId = "";
      for await (const update of stream1) {
        assistantMessageId = update.messageId;
      }

      // Verify 2 messages (user + assistant)
      const messagesBefore = await chatService.getMessages(chatId);
      expect(messagesBefore.length).toBe(2);

      // Regenerate
      const stream2 = chatService.regenerateMessage(assistantMessageId);
      for await (const _update of stream2) {
        // Consume stream
      }

      // Should still have 2 messages (old assistant deleted, new one created)
      const messagesAfter = await chatService.getMessages(chatId);
      expect(messagesAfter.length).toBe(2);

      // User message should be the same
      expect(messagesAfter[0]?.content).toBe("Original");

      // Assistant message should be regenerated (different ID)
      expect(messagesAfter[1]?.id).not.toBe(assistantMessageId);
    });

    it("should delete a message", async () => {
      const chatId = await chatService.createChat("Test Chat");

      const stream = chatService.sendMessage(chatId, "Hello");
      let userMessageId = "";
      for await (const result of stream) {
        // Get the result
        userMessageId = result.messageId;
      }

      // Verify 2 messages
      const messagesBefore = await chatService.getMessages(chatId);
      expect(messagesBefore.length).toBe(2);

      // Delete user message
      await chatService.deleteMessage(messagesBefore[0]!.id);

      // Should have 1 message left
      const messagesAfter = await chatService.getMessages(chatId);
      expect(messagesAfter.length).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should throw error when renaming non-existent chat", async () => {
      await expect(
        chatService.renameChat("invalid-id", "New Title")
      ).rejects.toThrow("not found");
    });

    it("should throw error when sending message to non-existent chat", async () => {
      const stream = chatService.sendMessage("invalid-id", "Hello");

      await expect(async () => {
        for await (const _update of stream) {
          // Should throw before any updates
        }
      }).rejects.toThrow("not found");
    });

    it("should throw error when regenerating user message", async () => {
      const chatId = await chatService.createChat("Test Chat");

      const stream = chatService.sendMessage(chatId, "Hello");
      for await (const _update of stream) {
        // Consume
      }

      const messages = await chatService.getMessages(chatId);
      const userMessage = messages.find((m) => m.role === "user");

      await expect(async () => {
        const regenStream = chatService.regenerateMessage(userMessage!.id);
        for await (const _update of regenStream) {
          // Should throw
        }
      }).rejects.toThrow("Can only regenerate assistant messages");
    });
  });
});
