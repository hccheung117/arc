# Restructuring the `@arc/ai` Package

This document outlines a proposed redesign of the `@arc/ai` package. The goal is to create a more unified, fluent, and extensible API for interacting with various AI providers, with a primary focus on streamlining the chat experience.

## 1. Architectural Role

As a **Module Layer (Lowest)** package, `@arc/ai`'s primary role is to act as a **Fulfiller**. It provides a unified, fluent API for interacting with various AI providers, serving as a specialized module for the `@arc/core` layer.

-   **Consumer**: `@arc/core`. The `core` layer is the only package that should directly import and use `@arc/ai`. The Application/UI layer is forbidden from accessing it directly.
-   **Dependencies**: It depends on `@arc/platform` for I/O operations, such as making HTTP requests to provider APIs. This keeps it decoupled from any specific platform environment.
-   **Contract Ownership**: It defines and owns its own contracts, such as the core `Provider` interface. `@arc/core` imports this contract, ensuring a clean, one-way dependency flow. The `Provider` contract will stipulate that implementations should return token usage information when available from the underlying model API.

## 2. Goals

-   **Fluent API:** Introduce a chainable, fluent API for constructing chat requests to improve developer experience and code readability.
-   **Focus on Chat:** Prioritize the chat modality as the core feature of the package.
-   **Clean up Modalities:** Remove and clean up other modalities (e.g., embeddings, image generation, audio, speech, moderation) from the core chat flow to simplify the main API surface.
-   **Simplified Provider Management:** Offer a clean, consistent way to configure and switch between different AI providers.

## 3. Proposed Directory Structure

The new structure will centralize provider logic and clarify the package's architecture.

```
packages/ai/
  src/
    provider.ts              # Defines the core interface and shared types.
    providers/
      openai.ts              # Internal implementation for OpenAI.
      anthropic.ts           # Internal implementation for Anthropic.
      gemini.ts              # Internal implementation for Gemini.
    errors.ts                # Defines custom error types (e.g., ProviderError).
```

## 4. Error Handling

The `@arc/ai` package defines a hierarchy of errors that allow `@arc/core` to implement intelligent retry and recovery logic. All errors extend from a base `AIError`.

-   **`ProviderAuthError`** (Non-Retry-able): Thrown for invalid API keys or authentication failures.
-   **`ProviderRateLimitError`** (Retry-able): Thrown when the provider's rate limit is exceeded. Contains metadata for backoff duration if provided by the API.
-   **`ProviderTimeoutError`** (Retry-able): Thrown on network timeouts when communicating with the provider.
-   **`ProviderQuotaExceededError`** (Non-Retry-able): Thrown when the user's quota with the provider has been exhausted.
-   **`ModelNotFoundError`** (Non-Retry-able): Thrown when a specified model does not exist.

## 5. API Design Showcase

```typescript
// Create an AI instance
const ai = new AI('openai', { apiKey: '...' }, http);
```

```typescript
// Create with custom base URL and headers
const ai = new AI('openai', {
  apiKey: '...',
  baseUrl: 'https://custom.proxy.com/v1',
  customHeaders: { 'X-Custom': 'value' }
}, http);
```

```typescript
// Streaming chat - simple
for await (const chunk of ai.chat
  .model('gpt-4')
  .userSays('Hello!')
  .stream()) {
  console.log(chunk);
}
```

```typescript
// Streaming chat - with system message
for await (const chunk of ai.chat
  .model('gpt-4')
  .systemSays('You are a helpful assistant')
  .userSays('What is the capital of France?')
  .stream()) {
  console.log(chunk);
}
```

```typescript
// Streaming chat - multi-turn conversation
for await (const chunk of ai.chat
  .model('gpt-4')
  .systemSays('You are a helpful assistant')
  .userSays('What is 2+2?')
  .assistantSays('2+2 equals 4')
  .userSays('What about 3+3?')
  .stream()) {
  console.log(chunk);
}
```

```typescript
// Streaming chat - with images
for await (const chunk of ai.chat
  .model('gpt-4-vision')
  .userSays('What do you see?', { images: [imageAttachment] })
  .stream()) {
  console.log(chunk);
}
```

```typescript
// Streaming chat - with cancellation
const stream = ai.chat
  .model('gpt-4')
  .userSays('Tell me a long story')
  .stream();

for await (const chunk of stream) {
  console.log(chunk);
}
// Later: stream.cancel();
```

```typescript
// Non-streaming chat
const result = await ai.chat
  .model('gpt-4')
  .userSays('Hello!')
  .generate();
// `result` includes the full content and token count if provided by the model.
```

```typescript
// Non-streaming chat - with conversation history
const result = await ai.chat
  .model('gpt-4')
  .systemSays('You are a helpful assistant')
  .userSays('What is 2+2?')
  .assistantSays('2+2 equals 4')
  .userSays('What about 3+3?')
  .generate();
```

```typescript
// List available models
const models = await ai.chat.models();
```

```typescript
// Health check
const isHealthy = await ai.chat.healthCheck();
```

```typescript
// Get model capabilities
const capabilities = ai.chat.capabilities('gpt-4-vision');
```

## 6. Testing Strategy

The testing strategy for `@arc/ai` is centered on verifying provider implementations against a common contract, without making any real network calls. This ensures tests are fast, deterministic, and can run in any automated environment without needing API keys.

-   **Provider Contract Tests**: Each provider (OpenAI, Anthropic, Gemini) must pass an identical suite of tests that validate its adherence to the shared `Provider` interface. The `PlatformHTTP` dependency will be mocked to simulate API responses.

-   **Streaming Validation**: Provider implementations will be tested to ensure they can correctly parse their specific Server-Sent Event (SSE) stream formats. Tests will feed mock stream data and verify that the resulting async iterable yields the correct chunks.

-   **Error Classification**: Tests will simulate various HTTP error responses (e.g., 401, 429, 500) from the mocked `PlatformHTTP` client and assert that the provider correctly maps them to the appropriate classified error types (`ProviderAuthError`, `ProviderRateLimitError`, etc.).

-   **Fluent API**: The chainable builder API will be tested to ensure it correctly constructs the final payload that is sent to the provider, including multi-turn conversation history and image attachments.

-   **Automation Requirement**: All tests must be runnable via a single, non-interactive command (e.g., `pnpm test --filter=@arc/ai`). No tests will make live network requests.

### Success Criteria

-   [ ] All provider implementations pass the same contract test suite using a mocked HTTP client.
-   [ ] Streaming and non-streaming chat methods produce the correct output from mock API data.
-   [ ] All documented provider and network errors are correctly classified.
-   [ ] The fluent API correctly assembles chat history and parameters for the provider.
-   [ ] All tests run to completion without requiring network access or API keys.
