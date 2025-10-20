// Domain models
export type { Chat } from "./domain/Chat.js";
export type { Message, MessageRole, MessageStatus } from "./domain/Message.js";
export type { ImageAttachment } from "./domain/ImageAttachment.js";
export type { ProviderConfig, ProviderType } from "./domain/ProviderConfig.js";
export { ProviderError, ProviderErrorCode } from "./domain/ProviderError.js";

// Platform abstraction
export type {
  IPlatformHTTP,
  HTTPRequest,
  HTTPResponse,
} from "./platform/IPlatformHTTP.js";
export type {
  IPlatformDatabase,
  DatabaseExecResult,
  DatabaseQueryResult,
} from "./platform/IPlatformDatabase.js";

// Repository interfaces
export type { IChatRepository } from "./repositories/IChatRepository.js";
export type { IMessageRepository } from "./repositories/IMessageRepository.js";
export type { IProviderConfigRepository } from "./repositories/IProviderConfigRepository.js";
export type { ISettingsRepository } from "./repositories/ISettingsRepository.js";

// In-memory repository implementations
export { InMemoryChatRepository } from "./repositories/InMemoryChatRepository.js";
export { InMemoryMessageRepository } from "./repositories/InMemoryMessageRepository.js";
export { InMemoryProviderConfigRepository } from "./repositories/InMemoryProviderConfigRepository.js";

// Providers
export { OpenAIAdapter } from "./providers/openai/OpenAIAdapter.js";
export type {
  OpenAIMessage,
  OpenAIModel,
} from "./providers/openai/types.js";

// Services
export { ChatService } from "./services/ChatService.js";
export type { MessageUpdate, SendMessageResult } from "./services/ChatService.js";

// Utilities
export { generateId } from "./utils/id.js";
