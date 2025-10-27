import type { ProviderType } from "./provider.type.js";
import { ProviderDetectionError } from "./errors.js";

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
    "Please specify the provider type explicitly when creating the connection."
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

