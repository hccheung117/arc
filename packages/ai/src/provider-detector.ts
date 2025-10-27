import type { ProviderType } from "./provider.type.js";
import { ProviderDetectionError, type ProbeAttempt } from "./errors.js";

/**
 * Detects the provider type from API configuration using heuristics
 *
 * Detection strategy (in order):
 * 1. Base URL heuristics (if baseUrl provided)
 * 2. API key format detection
 *
 * For edge cases (custom proxies with non-standard keys), users should
 * explicitly specify the provider type when creating connections.
 *
 * @param config - Provider configuration with API key and optional base URL
 * @returns The detected provider type
 * @throws {ProviderDetectionError} When provider cannot be identified
 *
 * @example
 * ```typescript
 * const providerType = await detectProviderType({
 *   apiKey: 'sk-ant-api03-...',
 *   baseUrl: 'https://api.anthropic.com/v1'
 * });
 * // Returns: 'anthropic'
 * ```
 */
export function detectProviderType(config: {
  apiKey: string;
  baseUrl?: string;
}): ProviderType {
  const attempts: string[] = [];

  // Strategy 1: Base URL Heuristics
  if (config.baseUrl) {
    const urlDetection = detectFromBaseUrl(config.baseUrl);
    if (urlDetection) {
      return urlDetection;
    }
    attempts.push("Base URL heuristics (no match)");
  }

  // Strategy 2: API Key Format Detection
  const keyDetection = detectFromApiKey(config.apiKey);
  if (keyDetection) {
    return keyDetection;
  }
  attempts.push("API key format detection (no match)");

  // Detection failed - throw comprehensive error
  throw new ProviderDetectionError(
    `Unable to detect provider type. Attempted: ${attempts.join(", ")}. ` +
    "Please specify the provider type explicitly when creating the connection.",
    {
      attempts: [],
      isRetryable: false,
    }
  );
}

/**
 * Detect provider from base URL
 * Uses domain-based heuristics to identify well-known provider endpoints
 */
function detectFromBaseUrl(baseUrl: string): ProviderType | null {
  try {
    // Normalize URL (remove trailing slashes, convert to lowercase)
    const normalizedUrl = baseUrl.toLowerCase().replace(/\/+$/, "");

    // Check for well-known provider domains
    if (normalizedUrl.includes("api.openai.com")) {
      return "openai";
    }

    if (normalizedUrl.includes("api.anthropic.com")) {
      return "anthropic";
    }

    if (normalizedUrl.includes("generativelanguage.googleapis.com")) {
      return "gemini";
    }

    // No match found
    return null;
  } catch {
    // Invalid URL format
    return null;
  }
}

/**
 * Detect provider from API key format
 * Different providers use distinct key prefixes and formats
 */
function detectFromApiKey(apiKey: string): ProviderType | null {
  // OpenAI: sk- or sk-proj- prefix
  if (apiKey.startsWith("sk-proj-") || apiKey.startsWith("sk-")) {
    // Need to distinguish from Anthropic which also uses sk-
    // Check for Anthropic's specific prefix
    if (apiKey.startsWith("sk-ant-")) {
      return "anthropic";
    }
    return "openai";
  }

  // Anthropic: sk-ant- prefix
  if (apiKey.startsWith("sk-ant-")) {
    return "anthropic";
  }

  // Gemini: Starts with AIza (Google API key format)
  // This is more distinctive than just length
  if (apiKey.startsWith("AIza")) {
    return "gemini";
  }

  // No clear match
  return null;
}

/**
 * Detects the provider type using network probes
 *
 * This function sends parallel, non-billable "list models" requests to
 * identify the provider based on response schemas. Used as a fallback
 * when heuristic detection fails (e.g., custom proxies, non-standard keys).
 *
 * @param config - Provider configuration with API key and base URL
 * @returns The detected provider type
 * @throws {ProviderDetectionError} When provider cannot be identified
 *
 * @example
 * ```typescript
 * const providerType = await detectProviderTypeFromProbe({
 *   apiKey: 'custom-proxy-key',
 *   baseUrl: 'https://my-proxy.com'
 * });
 * ```
 */
export async function detectProviderTypeFromProbe(config: {
  apiKey: string;
  baseUrl: string;
}): Promise<ProviderType> {
  // Normalize inputs
  const normalizedConfig = normalizeProbeConfig(config);

  // Send probes in parallel
  const probePromises = [
    probeOpenAI(normalizedConfig),
    probeAnthropic(normalizedConfig),
    probeGemini(normalizedConfig),
  ];

  // Wait for all probes to complete
  const results = await Promise.allSettled(probePromises);

  // Collect all probe attempts for error reporting
  const attempts: ProbeAttempt[] = results
    .map((result) => {
      if (result.status === 'fulfilled' && result.value.attempt) {
        return result.value.attempt;
      } else if (result.status === 'rejected') {
        // Extract attempt from error if available
        return null;
      }
      return null;
    })
    .filter((attempt): attempt is ProbeAttempt => attempt !== null);

  // Find successful detection (prefer success responses over error schema matches)
  const successfulProbe = results.find(
    (result) => result.status === 'fulfilled' && result.value.detected
  );

  if (successfulProbe && successfulProbe.status === 'fulfilled') {
    return successfulProbe.value.detected as ProviderType;
  }

  // All probes failed - determine if retryable
  const allTimeouts = results.every(
    (result) =>
      result.status === 'fulfilled' &&
      result.value.attempt?.statusCode === null
  );

  throw new ProviderDetectionError(
    "Unable to automatically detect provider type from network probes. " +
    "The API key and base URL combination did not match any known provider. " +
    "Please specify the provider type explicitly.",
    {
      attempts,
      isRetryable: allTimeouts,
    }
  );
}

/**
 * Normalize probe configuration inputs
 */
function normalizeProbeConfig(config: {
  apiKey: string;
  baseUrl: string;
}): { apiKey: string; baseUrl: string } {
  let baseUrl = config.baseUrl.trim();

  // Ensure https:// scheme
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
  }

  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/+$/, "");

  return {
    apiKey: config.apiKey.trim(),
    baseUrl,
  };
}

/**
 * Check if an error is a network timeout error
 */
function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message.includes("timeout"));
}

/**
 * Probe OpenAI endpoint
 * Retries once on network timeout errors
 */
async function probeOpenAI(config: {
  apiKey: string;
  baseUrl: string;
}): Promise<{ detected: ProviderType | null; attempt: ProbeAttempt }> {
  const path = "/v1/models";
  const url = `${config.baseUrl}${path}`;
  const maxAttempts = 2; // 1 initial + 1 retry

  for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "User-Agent": "Arc/1.0",
        },
        timeout: 3000,
      });

      const data = await response.json();
      const evidence = redactApiKey(JSON.stringify(data).slice(0, 200), config.apiKey);

      const attempt: ProbeAttempt = {
        vendor: "openai",
        method: "GET",
        path,
        statusCode: response.status,
        evidence,
      };

      // Check for OpenAI success schema
      if (response.status === 200 && matchesOpenAISchema(data)) {
        return { detected: "openai", attempt };
      }

      // Check for OpenAI error schema
      if (response.status >= 400 && matchesOpenAIErrorSchema(data)) {
        return { detected: "openai", attempt };
      }

      return { detected: null, attempt };
    } catch (error) {
      // Only retry on timeout errors, and only if we haven't exhausted attempts
      if (isTimeoutError(error) && attemptNum < maxAttempts) {
        continue; // Retry
      }

      // Return failure (either non-timeout error or exhausted retries)
      return {
        detected: null,
        attempt: {
          vendor: "openai",
          method: "GET",
          path,
          statusCode: null,
          evidence: error instanceof Error ? error.message : "Network timeout",
        },
      };
    }
  }

  // Shouldn't reach here, but TypeScript needs this
  return {
    detected: null,
    attempt: {
      vendor: "openai",
      method: "GET",
      path,
      statusCode: null,
      evidence: "Max retry attempts exceeded",
    },
  };
}

/**
 * Probe Anthropic endpoint
 * Retries once on network timeout errors
 */
async function probeAnthropic(config: {
  apiKey: string;
  baseUrl: string;
}): Promise<{ detected: ProviderType | null; attempt: ProbeAttempt }> {
  const path = "/v1/models";
  const url = `${config.baseUrl}${path}`;
  const maxAttempts = 2; // 1 initial + 1 retry

  for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "User-Agent": "Arc/1.0",
        },
        timeout: 3000,
      });

      const data = await response.json();
      const evidence = redactApiKey(JSON.stringify(data).slice(0, 200), config.apiKey);

      const attempt: ProbeAttempt = {
        vendor: "anthropic",
        method: "GET",
        path,
        statusCode: response.status,
        evidence,
      };

      // Check for Anthropic success schema
      if (response.status === 200 && matchesAnthropicSchema(data)) {
        return { detected: "anthropic", attempt };
      }

      // Check for Anthropic error schema
      if (response.status >= 400 && matchesAnthropicErrorSchema(data)) {
        return { detected: "anthropic", attempt };
      }

      return { detected: null, attempt };
    } catch (error) {
      // Only retry on timeout errors, and only if we haven't exhausted attempts
      if (isTimeoutError(error) && attemptNum < maxAttempts) {
        continue; // Retry
      }

      // Return failure (either non-timeout error or exhausted retries)
      return {
        detected: null,
        attempt: {
          vendor: "anthropic",
          method: "GET",
          path,
          statusCode: null,
          evidence: error instanceof Error ? error.message : "Network timeout",
        },
      };
    }
  }

  // Shouldn't reach here, but TypeScript needs this
  return {
    detected: null,
    attempt: {
      vendor: "anthropic",
      method: "GET",
      path,
      statusCode: null,
      evidence: "Max retry attempts exceeded",
    },
  };
}

/**
 * Probe Gemini endpoint
 * Retries once on network timeout errors
 */
async function probeGemini(config: {
  apiKey: string;
  baseUrl: string;
}): Promise<{ detected: ProviderType | null; attempt: ProbeAttempt }> {
  const path = `/v1beta/models?key=${config.apiKey}`;
  const url = `${config.baseUrl}${path}`;
  const maxAttempts = 2; // 1 initial + 1 retry

  for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          "User-Agent": "Arc/1.0",
        },
        timeout: 3000,
      });

      const data = await response.json();
      const evidence = redactApiKey(JSON.stringify(data).slice(0, 200), config.apiKey);

      const attempt: ProbeAttempt = {
        vendor: "gemini",
        method: "GET",
        path: "/v1beta/models",
        statusCode: response.status,
        evidence,
      };

      // Check for Gemini success schema
      if (response.status === 200 && matchesGeminiSchema(data)) {
        return { detected: "gemini", attempt };
      }

      // Check for Gemini error schema
      if (response.status >= 400 && matchesGeminiErrorSchema(data)) {
        return { detected: "gemini", attempt };
      }

      return { detected: null, attempt };
    } catch (error) {
      // Only retry on timeout errors, and only if we haven't exhausted attempts
      if (isTimeoutError(error) && attemptNum < maxAttempts) {
        continue; // Retry
      }

      // Return failure (either non-timeout error or exhausted retries)
      return {
        detected: null,
        attempt: {
          vendor: "gemini",
          method: "GET",
          path: "/v1beta/models",
          statusCode: null,
          evidence: error instanceof Error ? error.message : "Network timeout",
        },
      };
    }
  }

  // Shouldn't reach here, but TypeScript needs this
  return {
    detected: null,
    attempt: {
      vendor: "gemini",
      method: "GET",
      path: "/v1beta/models",
      statusCode: null,
      evidence: "Max retry attempts exceeded",
    },
  };
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout: number }
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new Error("Network timeout");
    }
    throw error;
  }
}

/**
 * Schema matchers for success responses
 */
function matchesOpenAISchema(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "object" in data &&
    (data as { object: unknown }).object === "list" &&
    "data" in data &&
    Array.isArray((data as { data: unknown }).data)
  );
}

function matchesAnthropicSchema(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    Array.isArray((data as { data: unknown }).data) &&
    ("first_id" in data || "has_more" in data)
  );
}

function matchesGeminiSchema(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;

  const models = (data as { models?: unknown }).models;
  if (!Array.isArray(models)) return false;

  return models.every(
    (model) =>
      typeof model === "object" &&
      model !== null &&
      "name" in model &&
      typeof (model as { name: unknown }).name === "string" &&
      (model as { name: string }).name.startsWith("models/")
  );
}

/**
 * Schema matchers for error responses
 */
function matchesOpenAIErrorSchema(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "object" &&
    (data as { error: { message?: unknown } }).error !== null &&
    "message" in (data as { error: object }).error &&
    "type" in (data as { error: object }).error
  );
}

function matchesAnthropicErrorSchema(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type: unknown }).type === "error" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "object" &&
    (data as { error: { type?: unknown; message?: unknown } }).error !== null &&
    "type" in (data as { error: object }).error &&
    "message" in (data as { error: object }).error
  );
}

function matchesGeminiErrorSchema(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "object" &&
    (data as { error: { code?: unknown; status?: unknown } }).error !== null &&
    "code" in (data as { error: object }).error &&
    typeof (data as { error: { code: unknown } }).error.code === "number" &&
    "status" in (data as { error: object }).error &&
    typeof (data as { error: { status: unknown } }).error.status === "string"
  );
}

/**
 * Redact API key from evidence string
 */
function redactApiKey(text: string, apiKey: string): string {
  // Redact the full API key
  let redacted = text.replace(new RegExp(apiKey, "g"), "[REDACTED]");

  // Also redact common API key patterns
  redacted = redacted.replace(/sk-[a-zA-Z0-9-_]+/g, "sk-[REDACTED]");
  redacted = redacted.replace(/AIza[a-zA-Z0-9-_]+/g, "AIza[REDACTED]");

  return redacted;
}
