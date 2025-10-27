"use client";

/**
 * useModels - Hook to fetch and cache models from all enabled providers
 *
 * This hook fetches models from all enabled providers, caches them for the session,
 * and provides error handling. It's designed to be used by the model selector
 * component to display available models grouped by provider.
 */

import { useEffect, useState, useCallback } from "react";
import { useCore } from "./core-provider";
import type { ModelInfo, ProviderConfig } from "@arc/core/core.js";

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Error details for display
 */
interface ErrorDetails {
  providerName: string;
  userMessage: string;
  isRetryable: boolean;
}

/**
 * Check if error is a ProviderError with retry information
 */
function isProviderError(error: unknown): error is {
  code: string;
  isRetryable: boolean;
  getUserMessage: () => string;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "isRetryable" in error &&
    "getUserMessage" in error &&
    typeof (error as any).getUserMessage === "function"
  );
}

/**
 * Classify error and extract user-friendly message
 */
function classifyError(error: unknown): { isRetryable: boolean; userMessage: string } {
  // Check if it's a ProviderError with retry info
  if (isProviderError(error)) {
    return {
      isRetryable: error.isRetryable,
      userMessage: error.getUserMessage(),
    };
  }

  // Fallback: treat generic errors as retryable (might be network issues)
  if (error instanceof Error) {
    return {
      isRetryable: true,
      userMessage: error.message || "An unexpected error occurred. Please try again.",
    };
  }

  // Unknown error type
  return {
    isRetryable: true,
    userMessage: "An unexpected error occurred. Please try again.",
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * Models grouped by provider
 */
export interface ProviderModelGroup {
  providerId: string;
  providerName: string;
  providerType: string;
  models: ModelInfo[];
}

/**
 * Hook return value
 */
interface UseModelsReturn {
  /**
   * Models grouped by provider
   */
  groupedModels: ProviderModelGroup[];

  /**
   * Whether any provider is currently loading models
   */
  isLoading: boolean;

  /**
   * Map of provider ID to error (if model fetching failed)
   */
  errors: Map<string, Error>;

  /**
   * Refetch models from all providers
   */
  refetch: () => void;

  /**
   * Get error details for a specific provider
   */
  getErrorDetails: (providerId: string) => ErrorDetails | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Fetch and cache models from all enabled providers
 *
 * Features:
 * - Session-based caching (models are fetched once and cached in state)
 * - Loading states per provider
 * - Error handling (errors are returned to be displayed as chat messages)
 * - Automatic refetch when providers list changes
 *
 * @returns Hook state and controls
 */
export function useModels(): UseModelsReturn {
  const core = useCore();

  const [groupedModels, setGroupedModels] = useState<ProviderModelGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());
  const [providers, setProviders] = useState<ProviderConfig[]>([]);

  /**
   * Fetch models from all enabled providers
   */
  const fetchModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrors(new Map());

      // Get all enabled providers
      const enabledProviders = await core.providers.list();
      const activeProviders = enabledProviders.filter((p) => p.enabled);

      setProviders(activeProviders);

      // Fetch models from each provider in parallel
      const results = await Promise.allSettled(
        activeProviders.map(async (provider) => {
          try {
            const models = await core.providers.getModels(provider.id);
            return {
              providerId: provider.id,
              providerName: provider.name,
              providerType: provider.type,
              models,
            };
          } catch (error) {
            // Store error for this provider (preserve original error object)
            throw {
              providerId: provider.id,
              error: error instanceof Error ? error : error,
            };
          }
        })
      );

      // Process results
      const successfulGroups: ProviderModelGroup[] = [];
      const newErrors = new Map<string, Error>();

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          successfulGroups.push(result.value);
        } else {
          // Extract provider ID and error from rejection
          const rejection = result.reason as {
            providerId: string;
            error: Error;
          };
          newErrors.set(rejection.providerId, rejection.error);
        }
      });

      setGroupedModels(successfulGroups);
      setErrors(newErrors);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsLoading(false);
    }
  }, [core]);

  /**
   * Refetch models (useful for manual refresh)
   */
  const refetch = useCallback(() => {
    void fetchModels();
  }, [fetchModels]);

  /**
   * Get error details for a specific provider
   */
  const getErrorDetails = useCallback(
    (providerId: string): ErrorDetails | null => {
      const error = errors.get(providerId);
      if (!error) {
        return null;
      }

      // Find provider info
      const provider = providers.find((p) => p.id === providerId);
      const providerName = provider?.name || "Unknown Provider";

      // Classify error (error can be Error or ProviderError-like object)
      const { isRetryable, userMessage } = classifyError(error);

      return {
        providerName,
        userMessage,
        isRetryable,
      };
    },
    [errors, providers]
  );

  /**
   * Fetch models on mount and when providers change
   */
  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  return {
    groupedModels,
    isLoading,
    errors,
    refetch,
    getErrorDetails,
  };
}
