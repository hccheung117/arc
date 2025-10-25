# Part 6: Integration Testing & System Validation

## 1. Overview & Purpose

This document outlines the final phase of testing for the Arc refactoring: **integration testing**. While prior phases focused on validating each package in isolation, this phase validates the system as a cohesive whole.

The purpose is to ensure that the independently verified packages (`@arc/platform`, `@arc/db`, `@arc/ai`, `@arc/core`) work together correctly to deliver the application's core functionality. We will be testing the public API of `@arc/core` as the primary entry point, simulating how a UI application would consume it.

## 2. Prerequisites

Execution of this testing phase is gated by the successful completion of all prior phases. The following conditions must be met:

-   [ ] All package-level tests for `@arc/platform`, `@arc/db`, `@arc/ai`, and `@arc/core` are passing.
-   [ ] Architectural boundaries are enforced by ESLint, and the linting process passes without errors.
-   [ ] All package exports are correctly limited to their public facades, with no internal modules exposed.
-   [ ] The entire monorepo builds successfully via `pnpm build`.

## 3. Integration Test Suites

Integration tests are organized by user-facing functionality and architectural concerns. Tests will use a **mock provider by default** for speed and determinism, with an **option to run against real AI APIs** for validation.

### A. Core User Flows

-   **Complete Chat Lifecycle**: A single test will cover the entire user journey:
    1.  Create a provider connection.
    2.  Start a `PendingChat`.
    3.  Send the first message, persisting the chat.
    4.  Verify the chat and its first two messages (user + assistant) are in the database.
    5.  Continue the conversation with `sendMessage`.
    6.  Search for a term within the chat.
    7.  Rename the chat.
    8.  Delete the chat and verify cascade deletion of its messages.
-   **Multi-Provider Conversations**: A test to ensure a single chat can seamlessly switch between different providers and models for different messages.
-   **Provider Management**: Tests for the full lifecycle of a provider configuration (create, validate connection, update, delete).
-   **Message Operations**: Tests for regenerating responses, editing user messages, and branching conversations from a specific point.

### B. Data Integrity & Persistence

-   **Transaction Atomicity**: Tests will inject failures during multi-step database operations (e.g., during the first `send` call) and verify that the transaction is rolled back, leaving the database in a clean state.
-   **Foreign Key Cascades**: Explicitly test that deleting a `chat` also deletes all associated `messages` and `message_attachments`.
-   **FTS Synchronization**: Verify that creating, updating, and deleting messages correctly updates the `messages_fts` table, ensuring the search index is never stale.

### C. Platform Compatibility

-   **Browser Platform**: The entire integration suite will run using the `browser` platform (`sql.js`).
-   **Electron Platform**: The entire suite will run again using the `electron` platform (`better-sqlite3`), if the test environment supports it. This ensures data and logic are consistent across both primary platforms.
-   **Capacitor Platform**: The suite will run against a mocked Capacitor plugin interface to validate the JS-to-native bridge calls.

### D. Error Handling & Recovery

-   **API Errors**: Simulate `ProviderAuthError`, `ProviderRateLimitError`, and `ProviderTimeoutError` from the mock provider and verify that `@arc/core` handles them gracefully without crashing.
-   **Data Errors**: Test for scenarios like attempting to fetch a non-existent chat or message.
-   **Graceful Degradation**: Ensure that a failure in one operation (e.g., sending a message) does not corrupt the state of the parent chat.

## 4. Test Execution Strategy

-   **Test Command**: A single command, `pnpm test:integration`, will run the entire suite.
-   **Default Mode (Mocked)**: By default, tests use a `MockProvider` located in `packages/core/test/fixtures/`. This mock is deterministic, requires no API keys, and allows for simulating various responses and errors.
-   **Optional Mode (Real APIs)**: Tests can be run against real AI providers by setting environment variables (e.g., `TEST_OPENAI_KEY`). Tests for a specific provider will be skipped gracefully if its corresponding key is not found. This is intended for local validation, not for CI.
-   **Test Fixtures**: Common data structures (provider configs, sample chats) will be provided in `packages/core/test/fixtures/` to reduce boilerplate and ensure consistency.

## 5. Automation Requirements

-   All integration tests must be runnable in a non-interactive, automated environment.
-   Tests must not depend on any GUI, browser window, or manual intervention.
-   The suite must return a clear pass/fail exit code for CI/CD pipelines.

## 6. Success Criteria

-   [ ] All critical user flows, from provider creation to chat deletion, complete successfully.
-   [ ] Data persists correctly and transactionally across all operations.
-   [ ] The system handles simulated provider and network errors gracefully.
-   [ ] The core logic produces identical results when run against both the browser (`sql.js`) and electron (`better-sqlite3`) platforms.
-   [ ] The entire test suite passes in a fully automated, non-interactive run.

## 7. Known Limitations & Future Work

This testing phase focuses on the architectural and functional correctness of the headless `core` API. The following are explicitly out of scope for this phase and will be addressed separately:

-   **UI/Application-Level Testing**: No smoke tests for the `apps/web` or `apps/desktop` applications are included.
-   **Performance & Load Testing**: No benchmarks will be run. Performance analysis will be a separate effort post-refactoring.
-   **Security Testing**: No penetration testing or vulnerability scanning will be performed.
