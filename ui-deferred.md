# Core Package and UI Enhancements

This document outlines the bottom-up implementation plan for features that require changes to core packages. The work is broken down into four distinct phases, following the project's layered architecture, ensuring a stable foundation for each subsequent layer.

---

## Phase 6: Database Layer (`@arc/db`)

**Objective:** Update the database schema to support conversation branching, message pinning, and advanced generation parameters. This is the foundational step for all subsequent changes.

### Implementation Details
-   **Target File:** `packages/db/src/migrations/definitions.ts`
-   **Note:** Since there are no existing users, we will directly update the initial migration (`0001_initial`).

#### Schema Changes
-   **`chats` Table Enhancement:** For conversation branching.
    ```sql
    parent_chat_id TEXT,
    parent_message_id TEXT,
    FOREIGN KEY (parent_chat_id) REFERENCES chats(id) ON DELETE SET NULL
    ```

-   **`messages` Table Enhancement:** For pinning and advanced controls.
    ```sql
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1)),
    pinned_at INTEGER,
    temperature REAL,
    system_prompt TEXT
    ```

-   **`settings` Table:** The existing key-value structure is sufficient. The following keys will be added programmatically: `favoriteModels`, `whitelistedModels`, `lineHeight`, `fontFamily`, `autoTitleChats`, `defaultSystemPrompt`.

### Acceptance Criteria (`schema.test.ts`)
-   [ ] **Branching:** `parent_chat_id` foreign key works correctly and sets to `NULL` on parent chat deletion.
-   [ ] **Pinning:** `is_pinned` defaults to `0`, `pinned_at` stores timestamps correctly.
-   [ ] **Settings:** Can store and retrieve JSON arrays for `favoriteModels` and `whitelistedModels`.

---

## Phase 7: AI Layer (`@arc/ai`)

**Objective:** Introduce provider auto-detection and add support for temperature control in chat completions.

### Implementation Details

#### Feature: Provider Auto-Detection
-   **New File:** `packages/ai/src/provider-detector.ts`
-   **Proposed API:**
    ```typescript
    export async function detectProviderType(config: {
      apiKey: string;
      baseUrl?: string;
    }): Promise<ProviderType>;
    ```
-   **Strategy:** Use Base URL heuristics, API key format checks, and a health check fallback.

#### Feature: Temperature Support
-   **Target File:** `packages/ai/src/provider.type.ts`
-   **Change:** Add a `temperature` parameter to the `options` object for `streamChatCompletion` and `generateChatCompletion`.

### Acceptance Criteria
-   **`provider-detector.test.ts`**
    -   [ ] Correctly identifies providers from Base URLs and API key formats.
    -   [ ] Throws a clear, specific error on detection failure.
-   **`provider-contract.test.ts`**
    -   [ ] `streamChatCompletion` correctly passes `temperature` to underlying provider SDKs.

---

## Phase 8: Core Layer (`@arc/core`)

**Objective:** Implement the business logic for the new features, consuming the updated database and AI layers.

### 8.1 Settings API (`settings-api.ts`)
-   **Features Enabled:** Model Favoriting, Whitelisting, Typography, Default System Prompt.
-   **Proposed API Examples:**
    ```typescript
    // Model Favoriting & Whitelisting
    await core.settings.update({
      favoriteModels: [...favorites, `${providerId}:${modelId}`],
      whitelistedModels: ['openai:gpt-4', 'anthropic:claude-3-5-sonnet']
    });

    // Typography
    await core.settings.update({
      lineHeight: 'relaxed',
      fontFamily: 'serif'
    });

    // Default System Prompt & Auto-Titling Toggle
    await core.settings.update({
      defaultSystemPrompt: 'You are a helpful assistant.',
      autoTitleChats: false
    });
    ```
-   **Acceptance Criteria (`settings-api.test.ts`):**
    -   [ ] `get()` returns correct defaults for new settings (e.g., `[]` for `favoriteModels`).
    -   [ ] `update()` correctly persists all new setting types (arrays, enums, strings, booleans).

### 8.2 Providers API (`providers-api.ts`)
-   **Feature Enabled:** Provider Auto-Detection.
-   **Proposed API Example:**
    ```typescript
    // Core handles detection automatically
    await core.providers.create({
      type: 'auto',
      name: "My Provider",
      apiKey: apiKey,
      baseUrl: baseUrl
    });
    ```
-   **Acceptance Criteria (`providers-api.test.ts`):**
    -   [ ] `create({ type: 'auto' })` calls the `@arc/ai` detection function.
    -   [ ] `create()` with an explicit type (e.g., `'openai'`) bypasses detection.
    -   [ ] Errors from the detection layer are propagated clearly.

### 8.3 Messages API (`messages-api.ts`)
-   **Features Enabled:** In-Chat Message Pinning, Advanced Composer Controls.
-   **Proposed API Examples:**
    ```typescript
    // Pinning
    await core.messages.pin(messageId);
    await core.messages.unpin(messageId);
    const pinnedMessages = await core.messages.getPinnedMessages(chatId);

    // Advanced Controls (via chat.sendMessage)
    for await (const update of chat.sendMessage({
      content: userMessage,
      model: 'gpt-4',
      providerConnectionId: providerId,
      options: {
        systemPrompt: 'You are a helpful coding assistant.',
        temperature: 0.7
      }
    })) { /* ... */ }
    ```
-   **Acceptance Criteria (`messages-api.test.ts`):**
    -   [ ] `pin()`, `unpin()`, and `getPinnedMessages()` work as expected, ordering by `pinned_at`.
    -   [ ] `sendMessage()` correctly persists `temperature` and `systemPrompt` with the resulting assistant's message.

### 8.4 Chats API (`chats-api.ts`)
-   **Features Enabled:** Branch Off Conversation, Automatic Chat Titling.
-   **Proposed API Examples:**
    ```typescript
    // Branching
    const newChat = await core.chats.branch(chatId, messageId);

    // The branched chat contains lineage info for UI hints
    const chat = await core.chats.get(newChat.id);
    if (chat?.chat.parentChatId) {
      const parent = await core.chats.get(chat.chat.parentChatId);
    }

    // Auto-Titling (background process)
    // No direct API change, but the title will update automatically after send()
    const updatedChat = await core.chats.get(chat.id);
    // updatedChat.title is now "Python List Comprehensions" or similar.
    ```
-   **Acceptance Criteria (`chats-api.test.ts`):**
    -   [ ] `branch()` creates a new chat, copies messages atomically, and sets parent IDs.
    -   [ ] Auto-titling is triggered as a non-blocking background task after the first exchange.
    -   [ ] Auto-titling is skipped if disabled via settings.

---

## Phase 9: UI Layer (`apps/web`)

**Objective:** Consume the new Core APIs to implement the deferred UI features.

### Implementation Overview & Acceptance Criteria

1.  **Settings Page:**
    -   **Task:** Add controls for model favoriting/whitelisting, typography, and default system prompt.
    -   **Tests (`settings-*.test.tsx`):** UI controls correctly call the corresponding `core.settings.update()` methods and reflect state changes.

2.  **Provider Dialog (`provider-form-dialog.test.tsx`):**
    -   **Task:** Remove the manual type selector and use `type: 'auto'` when creating providers. Add UI hints for detected provider type.
    -   **Tests:** The simplified dialog successfully creates providers and shows clear errors on detection failure.

3.  **Message Context Menu (`message.test.tsx`):**
    -   **Task:** Add "Branch from here" and "Pin message" actions.
    -   **Tests:** Clicking "Branch Off" calls `core.chats.branch()` and navigates to the new chat. Clicking "Pin" calls `core.messages.pin()`.

4.  **Pinned Messages Bar (`pinned-messages-bar.test.tsx`):**
    -   **Task:** Create a new component to display messages from `core.messages.getPinnedMessages(chatId)`.
    -   **Tests:** The bar appears only when pinned messages exist. Clicking a message in the bar scrolls to it.

5.  **Composer (`composer.test.tsx`):**
    -   **Task:** Add an advanced settings popover for per-message system prompts and temperature.
    -   **Tests:** Values from the popover are correctly passed to `chat.sendMessage()`.

6.  **Chat List (`chat-list-item.test.tsx`):**
    -   **Task:** Ensure the UI reactively updates when a chat title is auto-generated.
    -   **Tests:** The chat list item updates from "New Chat" to the generated title without a manual refresh.
