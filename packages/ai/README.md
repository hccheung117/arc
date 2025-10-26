# Arc AI SDK

Arc AI is a provider‑agnostic, usage‑first SDK with a fluent API for chat, embeddings, images, speech, and moderation. It emphasizes a readable, chainable interface, self‑cancellable streams, and rich metadata.

## Quick Start

```ts
import { AI } from '@arc/ai/ai.js';
import { createBrowserPlatform } from '@arc/platform/platform.js';

// Required: pass an HTTP implementation from your platform package
const platform = await createBrowserPlatform();
const http = platform.http;

const ai = new AI('openai', {
  apiKey: process.env.OPENAI_API_KEY!,
  // baseUrl and customHeaders are optional
}, http);
```

## Core Patterns

### Chat

```ts
// Non-streaming
const result = await ai.chat
  .model('model-id') // e.g., provider's chat model
  .systemSays('You are helpful.')
  .userSays('Explain async/await')
  .generate();

console.log(result.content);
console.log(result.metadata.usage?.totalTokens);

// Streaming with cancellation
const stream = ai.chat
  .model('model-id')
  .userSays('Write a long response')
  .stream();

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
  if (shouldStop) stream.cancel();
}
```

Vision (image inputs to the most recent user message):

```ts
// ImageAttachment expects a data URL or base64 string
const image: ImageAttachment = {
  id: 'img1',
  data: 'data:image/png;base64,...',
  mimeType: 'image/png',
  size: 12345,
};

const response = await ai.chat
  .model('model-id') // select a model that supports vision
  .userSays('What do you see?', { images: [image] })
  .generate();

console.log(response.content);
```

### Embeddings

```ts
const emb = await ai.embedding
  .model('embedding-model-id')
  .dimensions(1024) // optional
  .embed('Hello world');

console.log(emb.vector.length);
```

Stream batch embeddings:

```ts
const texts = ['a', 'b', 'c'];
const s = ai.embedding.model('embedding-model-id').embedStream(texts);
for await (const chunk of s) {
  // chunk.vector, chunk.metadata.index, chunk.metadata.total
}
```

### Images

```ts
const img = await ai.image
  .model('image-model-id') // e.g., image generation capable model
  .options({ size: '1024x1024', quality: 'hd', style: 'vivid' })
  .responseFormat('url') // or 'b64_json'
  .generate('A cyberpunk city at night');

console.log(img.url ?? img.b64);
```

Note: Image editing and variations may require multipart support and are provider/platform‑dependent (coming soon).

### Speech (Text‑to‑Speech)

```ts
const speech = await ai.speech
  .model('tts-model-id')
  .voice('nova') // voice is provider-specific
  .options({ speed: 1.0, format: 'mp3' })
  .speak('Hello there');

console.log(speech.audio.byteLength);

// streamSpeak yields provider-specific chunking (for some providers it may be a single chunk)
const audio = ai.speech.model('tts-model-id').voice('alloy').streamSpeak(longText);
for await (const chunk of audio) {
  player.enqueue(chunk.audio);
}
```

### Moderation

```ts
const mod = await ai.moderation.check('Text to review');
if (mod.flagged) {
  console.warn('Flagged', mod.metadata.categories);
}
```

### Capability Discovery (avoid hardcoding)

```ts
// List models
const models = await ai.chat.models();

// Check provider health (valid key, connectivity)
const healthy = await ai.chat.healthCheck();

// Inspect capabilities for a model (streaming, vision, roles, etc.)
const caps = await ai.chat.capabilities('model-id');
if (caps.supportsVision) {
  // attach images to last user message
}
```

### Error Handling

```ts
import { ProviderError } from '@arc/core/domain/ProviderError.js';

try {
  const out = await ai.chat.model('model-id').userSays('Hi').generate();
  console.log(out.content);
} catch (err) {
  if (err instanceof ProviderError) {
    console.error(err.code, err.getUserMessage());
    if (err.isRetryable && err.retryAfter) {
      // retry after err.retryAfter seconds
    }
  }
}
```

## Notes

- Models, voices, and feature availability are provider‑specific. Use `models()` and `capabilities()` at runtime instead of hardcoding assumptions.
- Streaming and TTS chunking are provider‑dependent.
- Some features (e.g., image edit/variations, audio transcription/translation) may require platform‑specific multipart support and are not documented here to avoid drift. Check provider modules under `@arc/ai/{provider}/*`.

## Contributors (high‑level)

- No barrel files; import from concrete modules, e.g., `@arc/ai/ai.js`, `@arc/ai/provider.type.js`.
- Shared utilities live under `@arc/ai/lib/*`.
- Provider modules are flat, capability‑named files (`openai-chat.ts`, `openai-embeddings.ts`, etc.).
