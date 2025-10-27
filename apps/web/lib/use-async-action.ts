/**
 * Standardized hook for async operations with loading, error, and data states
 * Ensures consistent UI feedback across all asynchronous operations
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { classifyError, getToastDuration, TOAST_DURATION } from './error-handler';

export interface AsyncActionState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface AsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for managing async actions with automatic toast notifications
 *
 * @example
 * const { execute, loading, error } = useAsyncAction(
 *   async (chatId: string) => await core.chats.delete(chatId),
 *   { successMessage: 'Chat deleted successfully' }
 * );
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: AsyncActionOptions = {}
) {
  const [state, setState] = useState<AsyncActionState<TResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setState({ data: null, loading: true, error: null });

      try {
        const result = await action(...args);
        setState({ data: result, loading: false, error: null });

        // Show success toast if configured
        if (options.showSuccessToast !== false && options.successMessage) {
          toast.success(options.successMessage, {
            duration: TOAST_DURATION.short,
          });
        }

        // Call success callback
        if (options.onSuccess) {
          options.onSuccess();
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ data: null, loading: false, error });

        // Classify error for retry-ability
        const errorDetails = classifyError(error);

        // Show error toast if configured
        if (options.showErrorToast !== false) {
          const message = options.errorMessage || errorDetails.message;

          if (errorDetails.isRetryable) {
            toast.error('Temporary Error', {
              description: message,
              duration: getToastDuration(errorDetails.severity, true),
              action: {
                label: 'Retry',
                onClick: () => execute(...args),
              },
            });
          } else {
            toast.error('Error', {
              description: message,
              duration: getToastDuration(errorDetails.severity, false),
            });
          }
        }

        // Call error callback
        if (options.onError) {
          options.onError(error);
        }

        return null;
      }
    },
    [action, options]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    execute,
    reset,
    loading: state.loading,
    error: state.error,
    data: state.data,
  };
}

/**
 * Hook for optimistic UI updates with automatic rollback on failure
 *
 * @example
 * const { execute } = useOptimisticAction(
 *   async () => await core.chats.rename(id, newTitle),
 *   (newTitle) => setChatTitle(newTitle),
 *   (oldTitle) => setChatTitle(oldTitle),
 *   { successMessage: 'Chat renamed successfully' }
 * );
 */
export function useOptimisticAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  applyOptimisticUpdate: (...args: TArgs) => void,
  rollbackUpdate: (...args: TArgs) => void,
  options: AsyncActionOptions = {}
) {
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);

      // Apply optimistic update immediately
      applyOptimisticUpdate(...args);

      try {
        const result = await action(...args);
        setLoading(false);

        // Show success toast if configured
        if (options.showSuccessToast !== false && options.successMessage) {
          toast.success(options.successMessage, {
            duration: TOAST_DURATION.short,
          });
        }

        // Call success callback
        if (options.onSuccess) {
          options.onSuccess();
        }

        return result;
      } catch (err) {
        // Rollback optimistic update on failure
        rollbackUpdate(...args);
        setLoading(false);

        const error = err instanceof Error ? err : new Error(String(err));
        const errorDetails = classifyError(error);

        // Show error toast if configured
        if (options.showErrorToast !== false) {
          const message = options.errorMessage || errorDetails.message;

          if (errorDetails.isRetryable) {
            toast.error('Temporary Error', {
              description: message,
              duration: getToastDuration(errorDetails.severity, true),
              action: {
                label: 'Retry',
                onClick: () => execute(...args),
              },
            });
          } else {
            toast.error('Error', {
              description: message,
              duration: getToastDuration(errorDetails.severity, false),
            });
          }
        }

        // Call error callback
        if (options.onError) {
          options.onError(error);
        }

        return null;
      }
    },
    [action, applyOptimisticUpdate, rollbackUpdate, options]
  );

  return {
    execute,
    loading,
  };
}
