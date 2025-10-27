/**
 * useModels Hook Tests
 *
 * Tests the model loading hook with session caching, error handling, and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useModels } from '@/lib/use-models';
import { useCore } from '@/lib/core-provider';
import type { Core, ModelInfo, ProviderConfig } from '@arc/core/core.js';

// Mock the useCore hook
vi.mock('@/lib/core-provider', () => ({
  useCore: vi.fn(),
}));

describe('useModels', () => {
  let mockCore: Partial<Core>;
  let mockProvidersList: ProviderConfig[];
  let mockModels: ModelInfo[];

  beforeEach(() => {
    // Setup mock data
    mockProvidersList = [
      {
        id: 'provider-1',
        type: 'openai',
        name: 'OpenAI GPT',
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'provider-2',
        type: 'anthropic',
        name: 'Anthropic Claude',
        apiKey: 'test-key',
        baseUrl: 'https://api.anthropic.com',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'provider-3',
        type: 'openai',
        name: 'Disabled Provider',
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        enabled: false, // Disabled provider should be ignored
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    mockModels = [
      { id: 'gpt-4', object: 'model', created: 123456, owned_by: 'openai' },
      { id: 'gpt-3.5-turbo', object: 'model', created: 123456, owned_by: 'openai' },
    ];

    // Setup mock Core instance
    mockCore = {
      providers: {
        list: vi.fn().mockResolvedValue(mockProvidersList),
        getModels: vi.fn().mockResolvedValue(mockModels),
      } as any,
    };

    (useCore as any).mockReturnValue(mockCore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with loading state', () => {
      const { result } = renderHook(() => useModels());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.groupedModels).toEqual([]);
      expect(result.current.errors.size).toBe(0);
    });
  });

  describe('Model Fetching', () => {
    it('fetches models from all enabled providers', async () => {
      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should call list() to get providers
      expect(mockCore.providers?.list).toHaveBeenCalledTimes(1);

      // Should call getModels for each enabled provider (2 enabled, 1 disabled)
      expect(mockCore.providers?.getModels).toHaveBeenCalledTimes(2);
      expect(mockCore.providers?.getModels).toHaveBeenCalledWith('provider-1');
      expect(mockCore.providers?.getModels).toHaveBeenCalledWith('provider-2');
    });

    it('groups models by provider', async () => {
      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.groupedModels).toHaveLength(2);
      expect(result.current.groupedModels[0]).toMatchObject({
        providerId: 'provider-1',
        providerName: 'OpenAI GPT',
        providerType: 'openai',
        models: mockModels,
      });
    });

    it('does not fetch models from disabled providers', async () => {
      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not call getModels for the disabled provider (provider-3)
      expect(mockCore.providers?.getModels).not.toHaveBeenCalledWith('provider-3');
    });
  });

  describe('Error Handling', () => {
    it('handles errors for individual providers', async () => {
      const testError = new Error('Failed to fetch models');

      // Mock getModels to fail for provider-1 but succeed for provider-2
      (mockCore.providers!.getModels as any).mockImplementation((id: string) => {
        if (id === 'provider-1') {
          return Promise.reject(testError);
        }
        return Promise.resolve(mockModels);
      });

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have one successful group
      expect(result.current.groupedModels).toHaveLength(1);
      expect(result.current.groupedModels[0]?.providerId).toBe('provider-2');

      // Should have one error
      expect(result.current.errors.size).toBe(1);
      expect(result.current.errors.get('provider-1')).toBe(testError);
    });

    it('continues fetching other providers when one fails', async () => {
      // Mock getModels to fail for provider-1
      (mockCore.providers!.getModels as any).mockImplementation((id: string) => {
        if (id === 'provider-1') {
          return Promise.reject(new Error('Provider 1 error'));
        }
        return Promise.resolve(mockModels);
      });

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still have provider-2's models
      expect(result.current.groupedModels).toHaveLength(1);
      expect(result.current.groupedModels[0]?.providerId).toBe('provider-2');
      expect(result.current.groupedModels[0]?.models).toEqual(mockModels);
    });

    it('handles all providers failing gracefully', async () => {
      (mockCore.providers!.getModels as any).mockRejectedValue(new Error('All failed'));

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.groupedModels).toHaveLength(0);
      expect(result.current.errors.size).toBe(2);
    });
  });

  describe('Session Caching', () => {
    it('only fetches models once on mount', async () => {
      const { result, rerender } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial fetch
      expect(mockCore.providers?.list).toHaveBeenCalledTimes(1);
      expect(mockCore.providers?.getModels).toHaveBeenCalledTimes(2);

      // Rerender shouldn't trigger new fetch
      rerender();

      expect(mockCore.providers?.list).toHaveBeenCalledTimes(1);
      expect(mockCore.providers?.getModels).toHaveBeenCalledTimes(2);
    });
  });

  describe('Refetch Function', () => {
    it('provides a refetch function', async () => {
      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetch triggers a new model fetch', async () => {
      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Call refetch
      result.current.refetch();

      await waitFor(() => {
        expect(mockCore.providers?.list).toHaveBeenCalledTimes(1);
        expect(mockCore.providers?.getModels).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Empty Provider List', () => {
    it('handles empty provider list gracefully', async () => {
      (mockCore.providers!.list as any).mockResolvedValue([]);

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.groupedModels).toHaveLength(0);
      expect(result.current.errors.size).toBe(0);
    });

    it('does not call getModels when no providers exist', async () => {
      (mockCore.providers!.list as any).mockResolvedValue([]);

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockCore.providers?.getModels).not.toHaveBeenCalled();
    });
  });

  describe('Provider with No Models', () => {
    it('handles providers returning empty model arrays', async () => {
      (mockCore.providers!.getModels as any).mockResolvedValue([]);

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Groups should still be created even with empty model arrays
      expect(result.current.groupedModels).toHaveLength(2);
      expect(result.current.groupedModels[0]?.models).toEqual([]);
    });
  });

  describe('Error Classification', () => {
    it('returns error details for provider with error', async () => {
      const providerError = {
        code: 'INVALID_API_KEY',
        isRetryable: false,
        getUserMessage: () => 'Invalid API key. Please check your settings.',
      };

      (mockCore.providers!.getModels as any).mockImplementation((id: string) => {
        if (id === 'provider-1') {
          return Promise.reject(providerError);
        }
        return Promise.resolve(mockModels);
      });

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const errorDetails = result.current.getErrorDetails('provider-1');
      expect(errorDetails).not.toBeNull();
      expect(errorDetails?.providerName).toBe('OpenAI GPT');
      expect(errorDetails?.userMessage).toBe('Invalid API key. Please check your settings.');
      expect(errorDetails?.isRetryable).toBe(false);
    });

    it('returns null for provider without error', async () => {
      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const errorDetails = result.current.getErrorDetails('provider-1');
      expect(errorDetails).toBeNull();
    });

    it('treats generic errors as retryable', async () => {
      const genericError = new Error('Network timeout');

      (mockCore.providers!.getModels as any).mockImplementation((id: string) => {
        if (id === 'provider-1') {
          return Promise.reject(genericError);
        }
        return Promise.resolve(mockModels);
      });

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const errorDetails = result.current.getErrorDetails('provider-1');
      expect(errorDetails).not.toBeNull();
      expect(errorDetails?.isRetryable).toBe(true);
      expect(errorDetails?.userMessage).toBe('Network timeout');
    });

    it('classifies ProviderError with isRetryable flag correctly', async () => {
      const retryableError = {
        code: 'RATE_LIMIT_EXCEEDED',
        isRetryable: true,
        getUserMessage: () => 'Rate limit exceeded. Please wait and try again.',
      };

      (mockCore.providers!.getModels as any).mockImplementation((id: string) => {
        if (id === 'provider-1') {
          return Promise.reject(retryableError);
        }
        return Promise.resolve(mockModels);
      });

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const errorDetails = result.current.getErrorDetails('provider-1');
      expect(errorDetails).not.toBeNull();
      expect(errorDetails?.isRetryable).toBe(true);
      expect(errorDetails?.userMessage).toBe('Rate limit exceeded. Please wait and try again.');
    });

    it('handles unknown provider ID gracefully', async () => {
      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const errorDetails = result.current.getErrorDetails('unknown-provider');
      expect(errorDetails).toBeNull();
    });
  });
});
