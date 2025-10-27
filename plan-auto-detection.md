# Playbook: Vendor-Agnostic Provider Auto-Detection

This document outlines the complete, vendor-agnostic playbook to auto-detect **OpenAI**, **Anthropic (Claude)**, and **Google Gemini** providers from only an API key and a base URL.

---

## Part 1: Overview & Strategy

### 1.1. Goal & Method

*   **Goal:** Reliably identify an AI provider based on its wire behavior, without relying on key prefixes or hostnames, which can be arbitrary when using proxies.
*   **Method:** We will employ a two-phase detection strategy. A fast, synchronous heuristic check runs first, followed by a series of asynchronous, non-billable network probes if the heuristic is inconclusive. The final determination is made by analyzing the success or error response schema from the probes.
*   **Scope:** This plan covers OpenAI, Anthropic, and Google Gemini. Azure OpenAI and Vertex AI are out of scope.

### 1.2. Two-Phase Detection Strategy

To provide a fast user experience while maintaining high accuracy for non-standard configurations, detection will occur in two phases, orchestrated by `@arc/core`.

*   **Phase 1: Fast Heuristics (Synchronous)**
    *   **Function:** `detectProviderType()`
    *   **Strategy:** Uses base URL patterns and API key prefixes for instant classification.
    *   **Use Case:** Covers >95% of standard provider configurations with sub-millisecond speed.

*   **Phase 2: Network Probing (Asynchronous)**
    *   **Function:** `detectProviderTypeFromProbe()`
    *   **Strategy:** Sends harmless "list models" requests to vendor-specific endpoints if heuristics fail.
    *   **Use Case:** Handles custom proxies, non-standard base URLs, and ambiguous keys where heuristics are insufficient.

---

## Part 2: Architectural Integration

This feature integrates cleanly into Arc's strictly layered architecture.

### 2.1. Layer Assignment & Dependency Flow

*   **`@arc/ai` (The Fulfiller):** Owns the detection logic. It will expose both `detectProviderType()` (existing) and the new `detectProviderTypeFromProbe()` function.
*   **`@arc/core` (The Orchestrator):** The sole consumer of `@arc/ai`. It decides which detection phase to use, orchestrates the calls, and wraps any resulting errors with business context.
*   **`apps/web` (The Demander):** The UI never imports from `@arc/ai` directly. It calls `core.providers.create()` and displays the results or errors provided by the Core.

The dependency flow is strictly enforced: `apps/web` → `@arc/core` → `@arc/ai`.

### 2.2. Core Orchestration Logic

The `ProvidersAPI.create()` method in `@arc/core` will implement the following logic:

```typescript
// In @arc/core ProvidersAPI.create()
if (input.type === "auto") {
  try {
    // Phase 1: Try fast heuristics first
    providerType = detectProviderType({ apiKey: input.apiKey, baseUrl: input.baseUrl });
  } catch (error) {
    // Phase 2: Heuristics failed, try network probing
    // This should only run if the user is online.
    providerType = await detectProviderTypeFromProbe({ apiKey: input.apiKey, baseUrl: input.baseUrl });
  }
}
```

### 2.3. User Experience Flow

1.  User enters an API key and base URL in Settings.
2.  The system instantly attempts heuristic detection, potentially showing a preliminary result (e.g., "OpenAI Detected").
3.  When the user clicks "Test Connection," `@arc/core` triggers the full two-phase logic.
4.  If the heuristic was wrong, the network probe corrects it.
5.  If both phases fail, the user is prompted to select the provider type manually.

### 2.4. Layered Error Handling

Our error handling strategy ensures that each layer provides appropriate context.

1.  **`@arc/ai` Throws `ProviderDetectionError`:** If network probing fails, `@arc/ai` throws a structured error containing detailed evidence from each probe attempt and an `isRetryable` flag.
2.  **`@arc/core` Catches and Wraps:** The Core catches `ProviderDetectionError` and wraps it in a `CoreError`, adding a user-friendly message and an action for the UI to take (e.g., "Select provider type from dropdown").
3.  **UI Receives `CoreError`:** The UI displays the actionable message from the `CoreError`. If the error is retry-able, a "Retry" button can be shown.

---

## Part 3: Network Probe Implementation (`@arc/ai`)

This section details the contract and logic for the `detectProviderTypeFromProbe` function.

### 3.1. API Contract

The function will have a simple, Core-friendly contract.

```typescript
// In @arc/ai/src/provider-detector.ts
import type { ProviderType } from './provider.type.js';

export async function detectProviderTypeFromProbe(config: {
  apiKey: string;
  baseUrl: string;
}): Promise<ProviderType>;

// On success, returns: "openai" | "anthropic" | "gemini"
// On failure, throws: ProviderDetectionError
```

The `ProviderDetectionError` provides structured context for `@arc/core`:

```typescript
class ProviderDetectionError extends Error {
  public readonly attempts: Array<{
    vendor: string;
    method: 'GET' | 'POST';
    path: string;
    statusCode: number | null;
    evidence: string; // Truncated response, keys redacted
  }>;
  public readonly isRetryable: boolean; // True if all failures were network timeouts
}
```

### 3.2. Input Normalization

Before probing, the function will normalize its inputs:
*   `baseUrl`: Trim whitespace, force `https://` scheme if missing, and remove any trailing slash.
*   `apiKey`: Used directly in requests but never logged raw. Telemetry should use a short hash of the key.

### 3.3. The Three Probes

We will send up to three parallel, non-billable "list models" requests. The first to return a confidently matching response determines the provider type.

| Vendor      | Request Details                               | Authentication                                          |
| :---------- | :-------------------------------------------- | :------------------------------------------------------ |
| **OpenAI**  | `GET {baseUrl}/v1/models`                     | `Authorization: Bearer <key>`                           |
| **Anthropic** | `GET {baseUrl}/v1/models`                     | `x-api-key: <key>` & `anthropic-version: <YYYY-MM-DD>`*      |
| **Gemini**    | `GET {baseUrl}/v1beta/models?key=<key>`       | API key in query parameter                              |

**Note:** For Anthropic, we use any valid date in `YYYY-MM-DD` format (e.g., `2023-06-01`). The exact date is not critical for detection purposes, as the vendor will accept any valid date format. When validating responses, we check for the presence of a date pattern rather than an exact match.

### 3.4. Decision Logic & Schema Checks

Detection is based on the distinct shape of success or error responses. We do not need full schema validation; simple structural checks are sufficient.

**Decision Flow:**

1.  Fire all three probes in parallel.
2.  The first probe to return a response that matches a known success or error schema wins.
3.  If a success response (HTTP 200) is received, classify based on its unique structure.
4.  If only error responses (HTTP 4xx/5xx) are received, classify based on the vendor-specific error envelope.
5.  If multiple probes match (rare), prefer the one with an HTTP 200 response.
6.  If no probe yields a recognizable schema, throw a `ProviderDetectionError` with the collected evidence.

**Schema Fingerprints:**

| Vendor      | Success Schema (HTTP 200)                               | Error Schema (HTTP 4xx/5xx)                             |
| :---------- | :------------------------------------------------------ | :------------------------------------------------------ |
| **OpenAI**  | `object: "list"` AND `data` is an array of objects with `id`. | `error.message` AND `error.type` exist.                 |
| **Anthropic** | `data` is an array AND response has `first_id` or `has_more`. | Top-level `type: "error"` AND `error.type` & `error.message` exist. |
| **Gemini**    | `models` is an array of objects with `name` like `"models/..."`. | `error.code` (number) AND `error.status` (string) exist. |

---

## Part 4: Operational Considerations

To ensure the feature is robust and secure, we will implement several guardrails.

*   **Timeouts:** Each probe will have a short timeout (e.g., 3 seconds). With parallel execution, the total detection time will be roughly that of a single probe.
*   **Retries:** The system will perform **one** retry attempt only on network timeout errors. It will never retry on 4xx or 5xx HTTP status codes.
*   **Caching:** The `@arc/ai` detection function is stateless. Caching is the responsibility of `@arc/core`, which can memoize results based on a hash of the `(baseUrl, apiKey)` pair and invalidate the cache when a provider's configuration is updated.
*   **Security:** Raw API keys will never be logged. The detection function receives the key but must not persist it. `@arc/ai` is responsible for redacting keys from evidence before throwing an error.
*   **User Agent:** All probe requests will include a `User-Agent: Arc/<version>` header to aid in potential vendor troubleshooting.

---

## Part 5: Verification

The detection logic will be verified with a comprehensive, automated test suite.

*   **Test Strategy:** All tests will use a mocked HTTP client to simulate vendor responses, ensuring non-interactive and deterministic execution in our CI/CD pipeline. We will test the decision logic, not the vendors themselves.

*   **Must-Pass Scenarios:**
    1.  **Valid Keys:** For each vendor, mock a 200 response with a valid success schema and assert the correct `ProviderType` is returned.
    2.  **Invalid Keys:** For each vendor, mock a 401 response with a valid error schema and assert the correct `ProviderType` is returned.
    3.  **Network Timeout:** Mock a network timeout for all probes and assert that a `ProviderDetectionError` is thrown with `isRetryable: true`.
    4.  **Ambiguous Failure:** Mock generic 404 responses for all probes and assert that a `ProviderDetectionError` is thrown with `isRetryable: false`.

---

## Part 6: Implementation Sequence

Based on Arc's architectural principles (bottom-up validation, package-first isolation), this is the optimal implementation sequence.

### **Phase 1: Foundation in `@arc/ai` (The Fulfiller)**

This is the lowest layer and must be completed first with full test coverage.

#### Step 1.1: Error Types & Contracts
- Define `ProviderDetectionError` class in `packages/ai/src/errors.ts`
- Add the probe result types and evidence structure
- Update `provider.type.ts` if needed for any new type definitions

#### Step 1.2: Network Probe Implementation
- Implement `detectProviderTypeFromProbe()` in `packages/ai/src/provider-detector.ts`
- Add input normalization (baseUrl, apiKey sanitization)
- Implement the three parallel probes (OpenAI, Anthropic, Gemini)
- Add timeout handling (3 seconds per probe)
- Implement retry logic (one retry on network timeout only)
- Add schema fingerprinting logic for each vendor

#### Step 1.3: Test Suite for `@arc/ai`
- Create `packages/ai/__tests__/provider-probe.test.ts`
- Mock HTTP client using vitest
- Test all scenarios from Part 5 of the plan:
  - Valid keys (200 responses) for each vendor
  - Invalid keys (401 responses) for each vendor
  - Network timeouts (all probes fail, `isRetryable: true`)
  - Ambiguous failures (404s, `isRetryable: false`)
  - Edge cases (malformed responses, mixed results)
- Ensure 100% coverage of detection logic
- **Verify all tests pass before proceeding**

#### Step 1.4: Enhanced Heuristics (if needed)
- Review and update existing `detectProviderType()` function
- Ensure it throws a clear error when heuristics fail
- Add tests for heuristic edge cases

---

### **Phase 2: Orchestration in `@arc/core` (The Orchestrator)**

Only begin after `@arc/ai` tests pass completely.

#### Step 2.1: Error Wrapping
- Add new `CoreError` variants in `packages/core/src/shared/errors.ts` for provider detection failures
- Implement wrapping logic that converts `ProviderDetectionError` to actionable `CoreError`

#### Step 2.2: Two-Phase Detection Logic
- Update `packages/core/src/providers/providers-api.ts`
- Implement the orchestration in `ProvidersAPI.create()`:
  ```typescript
  if (input.type === "auto") {
    try {
      // Phase 1: Fast heuristics
      providerType = detectProviderType({...});
    } catch (error) {
      // Phase 2: Network probing
      providerType = await detectProviderTypeFromProbe({...});
    }
  }
  ```
- Add result caching based on `(baseUrl, apiKey)` hash
- Implement cache invalidation on provider updates

#### Step 2.3: Test Suite for `@arc/core`
- Create `packages/core/__tests__/providers-auto-detection.test.ts`
- **Mock `@arc/ai` completely** (package-first isolation principle)
- Test orchestration logic:
  - Heuristics succeed → no probe called
  - Heuristics fail → probe called
  - Probe succeeds → correct provider created
  - Probe fails → correct `CoreError` thrown with actionable message
  - Caching works correctly
  - Cache invalidation works
- **Verify all tests pass before proceeding**

---

### **Phase 3: UI Integration in `apps/web` (The Demander)**

Only begin after both `@arc/ai` and `@arc/core` tests pass.

#### Step 3.1: Settings UI Enhancement
- Update provider form dialog to support "Auto-detect" option
- Add visual feedback during detection (loading state)
- Show preliminary heuristic result if available

#### Step 3.2: Test Connection Flow
- Wire up "Test Connection" button to trigger `core.providers.create()`
- Handle the two-phase detection transparently
- Display success/error messages from `CoreError`
- Show "Retry" button for retryable errors
- Allow manual provider selection fallback

#### Step 3.3: UI Tests
- Create `apps/web/__tests__/components/provider-auto-detection.test.tsx`
- **Mock `@arc/core` completely**
- Test UI states:
  - Auto-detect loading
  - Auto-detect success
  - Auto-detect failure (retryable)
  - Auto-detect failure (non-retryable)
  - Manual fallback selection

---

### **Phase 4: Integration Testing**

After all three layers pass their isolated tests.

#### Step 4.1: End-to-End Verification
- Create integration test that uses real (unmocked) `@arc/ai` and `@arc/core`
- Use HTTP mocking at the network boundary only
- Test the complete flow from UI → Core → AI → Network
- Verify error propagation through all layers

#### Step 4.2: Manual Testing Checklist
- Test with real API keys for each vendor
- Test with custom proxy URLs
- Test offline behavior
- Test concurrent detection attempts