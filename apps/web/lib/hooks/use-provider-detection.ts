import { useState, useCallback, useRef } from "react";
import { OpenAIProvider } from "@arc/ai/openai/OpenAIProvider.js";
import { AnthropicProvider } from "@arc/ai/anthropic/AnthropicProvider.js";
import { GeminiProvider } from "@arc/ai/gemini/GeminiProvider.js";
import { BrowserFetch } from "@arc/platform-browser/http/BrowserFetch.js";
import type { ProviderConfig } from "@/lib/chat-store";
import { normalizeBaseUrl, generateUrlVariations } from "@/lib/utils/normalize-base-url";

/**
 * Provider detection timeout (ms)
 */
const DETECTION_TIMEOUT_MS = 5000;

/**
 * Result from a single provider detection attempt
 */
export interface ProviderDetectionResult {
  provider: ProviderConfig["provider"];
  success: boolean;
  error?: string;
  normalizedBaseUrl?: string; // The actual URL that worked (if success=true)
}

/**
 * Overall detection state
 */
export interface DetectionState {
  isDetecting: boolean;
  results: ProviderDetectionResult[];
  successfulProviders: ProviderConfig["provider"][];
}

/**
 * Hook for smart provider detection
 *
 * Runs concurrent health checks on all supported providers to automatically
 * detect which provider(s) work with the given API key and base URL.
 */
export function useProviderDetection() {
  const [state, setState] = useState<DetectionState>({
    isDetecting: false,
    results: [],
    successfulProviders: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Detect compatible providers for given credentials
   *
   * @param apiKey - API key to test (optional for some proxies)
   * @param baseUrl - Base URL override (optional)
   * @returns Promise that resolves when detection completes
   */
  const detect = useCallback(async (apiKey?: string, baseUrl?: string) => {
    // Cancel any ongoing detection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this detection run
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState({
      isDetecting: true,
      results: [],
      successfulProviders: [],
    });

    const http = new BrowserFetch();

    // Helper to run a single provider detection with timeout
    const detectProvider = async (
      uiProviderType: ProviderConfig["provider"]
    ): Promise<ProviderDetectionResult> => {
      // Normalize the base URL and generate variations to try
      const cleanedUrl = normalizeBaseUrl(baseUrl);
      const urlVariations = generateUrlVariations(cleanedUrl, uiProviderType);

      // Try each URL variation until one works
      let lastError: Error | undefined;
      for (const urlToTry of urlVariations) {
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error("Detection timeout"));
            }, DETECTION_TIMEOUT_MS);
          });

          // Create provider instance based on type
          let provider;
          if (uiProviderType === "openai") {
            provider = new OpenAIProvider(http, apiKey || "", urlToTry || undefined);
          } else if (uiProviderType === "anthropic") {
            provider = new AnthropicProvider(http, apiKey || "", {
              ...(urlToTry ? { baseUrl: urlToTry } : {}),
            });
          } else if (uiProviderType === "google") {
            provider = new GeminiProvider(http, apiKey || "", {
              ...(urlToTry ? { baseUrl: urlToTry } : {}),
            });
          } else {
            throw new Error(`Unsupported provider: ${uiProviderType}`);
          }

          // Race between health check and timeout
          await Promise.race([
            provider.healthCheck(),
            timeoutPromise,
          ]);

          // Success! Return the working URL
          return {
            provider: uiProviderType,
            success: true,
            ...(urlToTry && { normalizedBaseUrl: urlToTry }),
          };
        } catch (error) {
          // Store the error and try next variation
          lastError = error as Error;
          continue;
        }
      }

      // All variations failed - return the last error
      let errorMessage = "Unknown error";
      if (lastError) {
        errorMessage = lastError.message;
      }

      return {
        provider: uiProviderType,
        success: false,
        error: errorMessage,
      };
    };

    // Run all detections concurrently
    const detectionPromises = [
      detectProvider("openai"),
      detectProvider("anthropic"),
      detectProvider("google"),
    ];

    try {
      const results = await Promise.all(detectionPromises);

      // Check if detection was cancelled
      if (abortController.signal.aborted) {
        setState({
          isDetecting: false,
          results: [],
          successfulProviders: [],
        });
        return;
      }

      // Extract successful providers
      const successfulProviders = results
        .filter((r) => r.success)
        .map((r) => r.provider);

      setState({
        isDetecting: false,
        results,
        successfulProviders,
      });
    } catch (error) {
      // This shouldn't happen since we're catching errors in detectProvider,
      // but handle it just in case
      console.error("Unexpected error during provider detection:", error);

      setState({
        isDetecting: false,
        results: [],
        successfulProviders: [],
      });
    }
  }, []);

  /**
   * Cancel ongoing detection
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({
      isDetecting: false,
      results: [],
      successfulProviders: [],
    });
  }, []);

  return {
    ...state,
    detect,
    cancel,
  };
}
