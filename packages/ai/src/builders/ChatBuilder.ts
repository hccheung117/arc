import type {
  IChatBuilder,
  ChatMessage,
  ChatModelOptions,
} from '@arc/contracts/ai/ChatBuilder.js';
import type { ChatResult, ChatChunk } from '@arc/contracts/ai/Results.js';
import type { CancellableStream as ICancellableStream } from '@arc/contracts/ai/Streams.js';
import type { ImageAttachment } from '@arc/contracts/ImageAttachment.js';
import type { IProvider } from '@arc/contracts/IProvider.js';
import type { Provider } from '@arc/contracts/ai/Metadata.js';
import { createCancellableStream } from '../utils/CancellableStream.js';
import type { ChatMetadata } from '@arc/contracts/ai/Metadata.js';

/**
 * Fluent chat builder implementation
 */
export class ChatBuilder implements IChatBuilder {
  private messages: ChatMessage[] = [];
  private selectedModel?: string;
  private modelOptions?: ChatModelOptions;

  constructor(
    private provider: IProvider,
    private providerType: Provider
  ) {}

  /**
   * Set the model to use
   */
  model(model: string, options?: ChatModelOptions): IChatBuilder {
    this.selectedModel = model;
    this.modelOptions = options;
    return this;
  }

  /**
   * Add a system message
   */
  systemSays(content: string): IChatBuilder {
    this.messages.push({ role: 'system', content });
    return this;
  }

  /**
   * Add a user message
   */
  userSays(content: string, options?: { images?: ImageAttachment[] }): IChatBuilder {
    this.messages.push({
      role: 'user',
      content,
      images: options?.images,
    });
    return this;
  }

  /**
   * Add an assistant message
   */
  assistantSays(content: string): IChatBuilder {
    this.messages.push({ role: 'assistant', content });
    return this;
  }

  /**
   * Clone this builder
   */
  clone(): IChatBuilder {
    const cloned = new ChatBuilder(this.provider, this.providerType);
    cloned.messages = [...this.messages];
    cloned.selectedModel = this.selectedModel;
    cloned.modelOptions = this.modelOptions;
    return cloned;
  }

  /**
   * Generate a completion (non-streaming)
   */
  async generate(): Promise<ChatResult> {
    this.validateState();

    let fullContent = '';
    let lastMetadata: Partial<ChatMetadata> = {
      model: this.selectedModel!,
      provider: this.providerType,
    };

    // Use streaming internally and collect all chunks
    for await (const chunk of this.stream()) {
      fullContent += chunk.content;
      // Update metadata as we receive it
      Object.assign(lastMetadata, chunk.metadata);
    }

    return {
      content: fullContent,
      metadata: lastMetadata as ChatMetadata,
    };
  }

  /**
   * Stream a completion
   */
  stream(): ICancellableStream<ChatChunk> {
    this.validateState();

    const model = this.selectedModel!;
    const messages = this.convertMessages();
    const attachments = this.getLastUserImages();

    return createCancellableStream(async function* (signal) {
      // Get the stream from the provider (existing IProvider interface)
      const providerStream = this.provider.streamChatCompletion(
        messages,
        model,
        attachments,
        signal
      );

      let totalContent = '';
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const contentChunk of providerStream) {
        totalContent += contentChunk;
        completionTokens += this.estimateTokens(contentChunk);

        yield {
          content: contentChunk,
          metadata: {
            model,
            provider: this.providerType,
            usage: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
          },
        };
      }

      // Final chunk with complete metadata
      yield {
        content: '',
        metadata: {
          model,
          provider: this.providerType,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
          finishReason: 'stop',
        },
      };
    }.bind(this));
  }

  /**
   * Validate that the builder is in a valid state
   */
  private validateState(): void {
    if (!this.selectedModel) {
      throw new Error('Model must be set before generating');
    }
    if (this.messages.length === 0) {
      throw new Error('At least one message must be added');
    }
  }

  /**
   * Convert internal messages to IProvider format
   */
  private convertMessages(): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return this.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Get images from the last user message
   */
  private getLastUserImages(): ImageAttachment[] | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i]?.role === 'user') {
        return this.messages[i]?.images;
      }
    }
    return undefined;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
