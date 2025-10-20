// Domain models
export type { Chat } from "./domain/Chat.js";
export type { Message, MessageRole, MessageStatus } from "./domain/Message.js";
export type { ImageAttachment } from "./domain/ImageAttachment.js";

// Repository interfaces
export type { IChatRepository } from "./repositories/IChatRepository.js";
export type { IMessageRepository } from "./repositories/IMessageRepository.js";

// In-memory repository implementations
export { InMemoryChatRepository } from "./repositories/InMemoryChatRepository.js";
export { InMemoryMessageRepository } from "./repositories/InMemoryMessageRepository.js";

// Services
export { ChatService } from "./services/ChatService.js";
export type { MessageUpdate, SendMessageResult } from "./services/ChatService.js";

// Utilities
export { generateId } from "./utils/id.js";
