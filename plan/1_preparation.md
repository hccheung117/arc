# Preparation: filesystem-only bridge (mv/rm/mkdir)

This document contains only simple, order-safe filesystem operations to prepare the current codebase for plans 2–5. No code edits, no new files authored, and no config/package changes here.

- Run from repository root
- Use git-aware commands to preserve history
- Execute in order

## 0) Create target directories (idempotent)
```bash
mkdir -p packages/core/src/{chats,messages,providers,settings,search,shared}
```

## 1) Core: move/rename to feature-sliced structure
```bash
# domain → feature folders (kebab-case)
git mv packages/core/src/domain/Chat.ts packages/core/src/chats/chat.ts
git mv packages/core/src/domain/Message.ts packages/core/src/messages/message.ts
git mv packages/core/src/domain/ProviderConfig.ts packages/core/src/providers/provider-config.ts
git mv packages/core/src/domain/ProviderError.ts packages/core/src/shared/errors.ts

# repository interfaces → *.type.ts
git mv packages/core/src/repositories/IChatRepository.ts packages/core/src/chats/chat-repository.type.ts
git mv packages/core/src/repositories/IMessageRepository.ts packages/core/src/messages/message-repository.type.ts
git mv packages/core/src/repositories/IProviderConfigRepository.ts packages/core/src/providers/provider-repository.type.ts
git mv packages/core/src/repositories/ISettingsRepository.ts packages/core/src/settings/settings-repository.type.ts

# in-memory implementations → *-repository-memory.ts
git mv packages/core/src/repositories/InMemoryChatRepository.ts packages/core/src/chats/chat-repository-memory.ts
git mv packages/core/src/repositories/InMemoryMessageRepository.ts packages/core/src/messages/message-repository-memory.ts
git mv packages/core/src/repositories/InMemoryProviderConfigRepository.ts packages/core/src/providers/provider-repository-memory.ts

# shared utils
git mv packages/core/src/utils/id.ts packages/core/src/shared/id-generator.ts

# NOTE: keep core/platform interfaces for now; deletion is deferred to plan/2_platform
```

## 2) DB: simple renames (no content changes)
```bash
git mv packages/db/src/schema/types.ts packages/db/src/schema.ts
git mv packages/db/src/migrations/migrations.ts packages/db/src/migrations/definitions.ts
```

## 3) Contracts → AI: move essential types only
```bash
mkdir -p packages/ai/src
git mv packages/contracts/src/IProvider.ts packages/ai/src/provider.type.ts
git mv packages/contracts/src/ImageAttachment.ts packages/ai/src/image-attachment.type.ts

# NOTE: keep remaining contracts for now; absorption of contracts/* is handled in plan/4_ai
```

## 4) AI: remove non-chat modalities (keep streaming/lib intact)
```bash
git rm packages/ai/src/openai/openai-embeddings.ts || true
git rm packages/ai/src/openai/openai-images.ts || true
git rm packages/ai/src/openai/openai-audio.ts || true
git rm packages/ai/src/openai/openai-speech.ts || true
git rm packages/ai/src/openai/openai-moderation.ts || true
git rm packages/ai/src/gemini/gemini-embeddings.ts || true

# NOTE: do NOT remove packages/ai/src/lib or provider-specific errors yet; those are refactored in plan/4_ai
```

## 5) Deletions explicitly deferred (handled in plans 2–5)
- Move/merge platform implementations and delete `packages/platform-*` (plan/2_platform)
- Remove remaining `@arc/contracts` after full absorption (plan/4_ai)
- Move SQLite repositories from `@arc/db` into `@arc/core` (plan/3_db)
- Create new facade/factory files and update package exports (plans 2–5)

## 6) Quick verification
```bash
# presence checks (should exist after moves)
test -f packages/core/src/chats/chat.ts
test -f packages/core/src/messages/message.ts
test -f packages/core/src/providers/provider-config.ts
test -f packages/core/src/shared/errors.ts
test -f packages/core/src/chats/chat-repository.type.ts
test -f packages/core/src/messages/message-repository.type.ts
test -f packages/core/src/providers/provider-repository.type.ts
test -f packages/core/src/settings/settings-repository.type.ts
test -f packages/core/src/chats/chat-repository-memory.ts
test -f packages/core/src/messages/message-repository-memory.ts
test -f packages/core/src/providers/provider-repository-memory.ts
test -f packages/core/src/shared/id-generator.ts
test -f packages/db/src/schema.ts
test -f packages/db/src/migrations/definitions.ts
test -f packages/ai/src/provider.type.ts
test -f packages/ai/src/image-attachment.type.ts
```
