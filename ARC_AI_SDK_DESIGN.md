# Arc AI SDK Design Implementation

## Status: Initial Implementation Complete

This document describes the implementation of the Arc AI SDK design as specified in the requirements.

## Overview

The Arc AI SDK provides a fluent, provider-agnostic API for interacting with multiple AI platforms (OpenAI, Anthropic, Gemini). The design emphasizes:

1. **Usage-first API** - APIs match how developers want to write code
2. **Fluent interface** - Chain methods for readable, natural code
3. **Explicit namespaces** - Clear modules for chat, embedding, image, audio, speech, moderation
4. **Self-cancellable streams** - Built-in cancellation without AbortController
5. **Rich metadata** - Token counts, finish reasons, model/provider details everywhere
6. **Provider agnostic** - One API across OpenAI, Anthropic, and Gemini

## Implementation Structure

### Packages

#### `@arc/contracts` - Type Definitions
Location: `/home/user/arc/packages/contracts/src/ai/`

Defines all interfaces and types for the fluent API:
- **Metadata.ts** - Usage, FinishReason, and metadata types
- **Errors.ts** - ProviderErrorCode and error interfaces
- **Results.ts** - Result types for all API operations
- **Streams.ts** - CancellableStream interface
- **ChatBuilder.ts** - Chat API interfaces
- **EmbeddingBuilder.ts** - Embedding API interfaces
- **ImageBuilder.ts** - Image generation API interfaces
- **AudioBuilder.ts** - Audio transcription API interfaces
- **SpeechBuilder.ts** - Text-to-speech API interfaces
- **ModerationBuilder.ts** - Content moderation API interfaces
- **IAI.ts** - Main AI interface

#### `@arc/ai` - Implementation
Location: `/home/user/arc/packages/ai/src/`

Implements the fluent API:
- **AI.ts** - Main entry point class
- **builders/** - Builder implementations for each namespace
- **utils/** - CancellableStream implementation
- **openai/**, **anthropic/**, **gemini/** - Provider-specific adapters

## API Usage Examples

### Basic Chat

```typescript
import { AI } from '@arc/ai';

const ai = new AI('openai', { apiKey: process.env.OPENAI_API_KEY });

// Non-streaming
const result = await ai.chat
  .model('gpt-4')
  .userSays('Explain async/await')
  .generate();

console.log(result.content);
console.log(result.metadata.usage.totalTokens);
```

### Streaming Chat

```typescript
const stream = ai.chat
  .model('gpt-4')
  .userSays('Write a long essay')
  .stream();

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
  if (shouldStop) stream.cancel();
}
```

### Multi-turn Conversation

```typescript
const result = await ai.chat
  .model('claude-3-5-sonnet')
  .systemSays('You are a helpful coding assistant')
  .userSays('How do I use async/await?')
  .assistantSays('Async/await is syntactic sugar...')
  .userSays('Can you show an example?')
  .generate();
```

### Vision (Images in Chat)

```typescript
const result = await ai.chat
  .model('gpt-4-vision')
  .userSays('What do you see?', { images: [imageAttachment] })
  .generate();
```

### Embeddings

```typescript
// Single embedding
const embedding = await ai.embedding
  .model('text-embedding-3-large')
  .embed('Hello world');

console.log(embedding.vector);

// Batch embeddings
const batch = await ai.embedding
  .model('text-embedding-3-small')
  .embedBatch(['First text', 'Second text', 'Third text']);

console.log(batch.vectors);
```

### Image Generation

```typescript
const image = await ai.image
  .model('dall-e-3')
  .options({ quality: 'hd', size: '1024x1024' })
  .generate('A serene mountain landscape at sunset');

console.log(image.url);
```

### Audio Transcription

```typescript
const transcription = await ai.audio
  .model('whisper-1')
  .options({ language: 'en', format: 'verbose_json' })
  .transcribe(audioFile);

console.log(transcription.text);
console.log(transcription.metadata.segments);
```

### Speech (TTS)

```typescript
const speech = await ai.speech
  .model('tts-1-hd')
  .voice('nova')
  .options({ speed: 1.2 })
  .speak('Hello, how are you today?');

// speech.audio is an ArrayBuffer
```

### Content Moderation

```typescript
const result = await ai.moderation.check('Content to moderate');

console.log(result.flagged);
console.log(result.metadata.categories);
console.log(result.metadata.categoryScores);
```

## Implementation Status

### Completed ✓
- [x] Core contracts and type definitions
- [x] CancellableStream utility
- [x] All builder interfaces
- [x] Main AI class structure
- [x] ChatBuilder implementation (with existing provider integration)
- [x] EmbeddingBuilder, ImageBuilder, AudioBuilder, SpeechBuilder, ModerationBuilder (scaffolded)

### In Progress / Needs Completion
- [ ] Fix TypeScript compilation errors (optional property handling)
- [ ] Extend provider adapters to implement all API methods
  - [ ] OpenAI: embeddings, images, audio, speech, moderation
  - [ ] Anthropic: limited API support (chat only)
  - [ ] Gemini: extend API support
- [ ] Implement proper token counting and metadata
- [ ] Add comprehensive error handling
- [ ] Create unit tests
- [ ] Create integration tests
- [ ] Add examples directory

## Architecture Notes

### Existing Integration
The implementation builds on top of the existing Arc provider system:
- Existing `IProvider` interface for chat completions
- Existing `ProviderError` from `@arc/core/domain/ProviderError`
- Existing provider adapters (OpenAIAdapter, AnthropicAdapter, GeminiAdapter)

### Builder Pattern
Each API namespace (chat, embedding, etc.) uses a fluent builder pattern:
1. Configure the request through method chaining
2. Execute with `.generate()` or `.stream()`
3. Receive rich results with metadata

### Provider Extensions
The builders define provider interfaces that extend beyond the base `IProvider`:
- `IEmbeddingProvider` - for embedding operations
- `IImageProvider` - for image generation
- `IAudioProvider` - for audio transcription
- `ISpeechProvider` - for text-to-speech
- `IModerationProvider` - for content moderation

These need to be implemented in each provider adapter.

## Next Steps

1. **Fix Compilation Issues**
   - Resolve `exactOptionalPropertyTypes` conflicts
   - Add missing provider interface implementations
   - Update import paths

2. **Complete Provider Implementations**
   - Extend OpenAIAdapter with embedding, image, audio, speech, moderation methods
   - Add appropriate error handling and retry logic
   - Implement proper streaming for applicable APIs

3. **Testing**
   - Unit tests for each builder
   - Integration tests with real API keys (optional)
   - Mock provider for testing

4. **Documentation**
   - API reference documentation
   - Migration guide from old API
   - Recipe examples

5. **Platform Integration**
   - Ensure HTTP client injection works across all platforms
   - Test on web, desktop, and mobile

## Design Principles Applied

1. **Usage First** - API designed around developer mental model
   - `userSays()` instead of low-level message objects
   - `stream.cancel()` instead of AbortController
   - Direct result access instead of forced destructuring

2. **Progressive Disclosure** - Simple things are one-liners:
   ```typescript
   await ai.chat.model('gpt-4').userSays('Hi').generate();
   ```

3. **Consistency** - Same pattern across all namespaces:
   ```typescript
   ai.chat.model(...).userSays(...).generate()
   ai.embedding.model(...).embed(...)
   ai.image.model(...).generate(...)
   ```

4. **Rich Metadata** - Every result includes usage, model, provider info
5. **Self-Cancellable** - Streams can be cancelled without external controllers
6. **Provider Agnostic** - Single API works with multiple providers

## Files Modified/Created

### Contracts Package
```
packages/contracts/src/ai/
├── Metadata.ts          (new)
├── Errors.ts            (new)
├── Results.ts           (new)
├── Streams.ts           (new)
├── ChatBuilder.ts       (new)
├── EmbeddingBuilder.ts  (new)
├── ImageBuilder.ts      (new)
├── AudioBuilder.ts      (new)
├── SpeechBuilder.ts     (new)
├── ModerationBuilder.ts (new)
└── IAI.ts               (new)
```

### AI Package
```
packages/ai/src/
├── AI.ts                           (new)
├── builders/
│   ├── ChatBuilder.ts              (new)
│   ├── EmbeddingBuilder.ts         (new)
│   ├── ImageBuilder.ts             (new)
│   ├── AudioBuilder.ts             (new)
│   ├── SpeechBuilder.ts            (new)
│   └── ModerationBuilder.ts        (new)
└── utils/
    └── CancellableStream.ts        (new)
```

## References

- Original Design Spec: (provided in task description)
- Existing Provider System: `packages/ai/src/{openai,anthropic,gemini}/`
- Core Domain: `packages/core/src/domain/`
