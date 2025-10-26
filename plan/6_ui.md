# Part 6: UI Layer Adaptation

## 1. Overview & Purpose

This phase focuses on adapting the UI layer (`apps/web`, `apps/desktop`) to consume the new, headless `@arc/core` API. The primary goal is to replace the existing data-fetching and state management abstractions with direct, clean calls to the Core facade, ensuring functional correctness over visual appearance.

The UI's responsibility is to be a pure consumer of the Core's business logic, initializing it with the correct platform context and rendering the state it provides.

## 2. Prerequisites

-   [ ] `@arc/core` has been fully refactored and passes all its isolated tests (Phase 5 is complete).
-   [ ] `@arc/platform` correctly detects and provides implementations for both `browser` and `electron` environments.
-   [ ] ESLint rules are in place to prevent the UI from importing anything from `@arc/db`, `@arc/ai`, or `@arc/platform`.

## 3. Refactoring Strategy

### A. Initialization Layer

The current API abstractions in `apps/web/lib/api/*` will be removed and replaced by a single, clean provider for the Core instance.

1.  **Create `apps/web/lib/core-provider.tsx`**:
    -   This React component will be responsible for the one-time initialization of the Core.
    -   It will detect the current platform (`browser` or `electron`).
    -   It will call `createCore()` with the correct platform type on mount. Core handles the platform creation internally.
    -   The resulting `core` instance will be provided to the entire application via React Context.

### B. Component & Hook Adaptation

All UI components and hooks will be refactored to consume the `core` instance from the context.

-   **State Hooks**: Hooks like `useSWR` or `react-query` will be used to subscribe to data from `core` methods (e.g., `core.chats.list()`).
-   **Mutation Hooks**: User actions (sending messages, creating providers) will be handled by mutation hooks that call the corresponding `core` methods (e.g., `core.providers.create(...)`).
-   **State Management**: The existing `lib/chat-store.ts` will be re-evaluated. Any business logic it contains will be moved into `@arc/core`. It may be kept for purely transient, UI-only state (e.g., sidebar visibility).

## 4. Testing Strategy

The testing strategy focuses on **functional behavior and integration with the Core API**, not visual regression. All tests must be runnable in a non-interactive, automated environment.

### A. Component Integration Tests

-   **Methodology**: Use `vitest` and `@testing-library/react`.
-   **Goal**: Verify that user interactions on a component trigger the correct `@arc/core` API calls.
-   **Implementation**: The `core` instance provided via context will be mocked to assert that the correct functions are called with the expected arguments.

### B. Platform Initialization Tests

-   **Goal**: Test that the `core-provider.tsx` correctly initializes the Core for both `browser` and `electron` platforms.
-   **Implementation**: The `createCore` function will be mocked to verify it is called with the correct platform option (e.g., `{ platform: 'browser' }`). Error states during initialization will also be tested.

### C. Critical User Journey Smoke Tests

These are higher-level tests that validate key end-to-end user flows within the UI, using a real Core instance connected to an in-memory database and a mock AI provider.

-   Create a new chat and send the first message.
-   Continue an existing conversation.
-   Switch between different chats in the chat list.
-   Add, edit, and delete a provider configuration.
-   Search for a message and see the results.
-   Delete a chat and confirm it is removed from the list.

### Automation Requirements

-   **Runner**: All tests will use `vitest` and run in a `jsdom` environment (no real browser required).
-   **Command**: A single command (`pnpm test --filter=web`) will run the entire suite.
-   **Non-interactive**: All tests must run to completion without any manual intervention.

## 5. Success Criteria

-   [ ] The old API layer in `apps/web/lib/api` is completely removed.
-   [ ] All relevant UI components and hooks are refactored to use the new `core` instance.
-   [ ] ESLint rules pass, confirming no illegal imports from lower-level modules exist in the UI.
-   [ ] All component integration and smoke tests pass.
-   [ ] The application is fully functional for all critical user journeys, backed by the real `@arc/core`.
-   [ ] The UI correctly handles and displays errors originating from the Core layer.

## 6. Out of Scope

-   **Visual Regression Testing**: No "pixel-perfect" or snapshot testing of component appearance.
-   **E2E Testing**: No full end-to-end tests using tools like Playwright or Cypress.
-   **Performance Optimization**: UI performance will be addressed after the refactoring is complete.
-   **Mobile App Adaptation**: The Capacitor app is not included in this phase.
