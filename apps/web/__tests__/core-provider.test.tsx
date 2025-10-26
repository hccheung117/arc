/**
 * CoreProvider Platform Initialization Tests
 *
 * Tests that CoreProvider correctly initializes the Core for both
 * browser and electron platforms, and handles errors appropriately.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CoreProvider, useCore } from '@/lib/core-provider';
import type { Core } from '@arc/core/core.js';

// Mock the core module
vi.mock('@arc/core/core.js', () => ({
  createCore: vi.fn(),
}));

import { createCore } from '@arc/core/core.js';

describe('CoreProvider', () => {
  let mockCore: Partial<Core>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a mock core instance
    mockCore = {
      providers: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        checkConnection: vi.fn(),
        getModels: vi.fn(),
      },
      chats: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn(),
        create: vi.fn(),
        rename: vi.fn(),
        delete: vi.fn(),
        sendMessage: vi.fn(),
      },
      messages: {
        regenerate: vi.fn(),
        edit: vi.fn(),
        delete: vi.fn(),
        stop: vi.fn(),
      },
      search: {
        messages: vi.fn(),
        messagesInChat: vi.fn(),
        chats: vi.fn(),
      },
      settings: {
        get: vi.fn(),
        update: vi.fn(),
        reset: vi.fn(),
      },
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Setup default mock implementation
    vi.mocked(createCore).mockResolvedValue(mockCore as Core);

    // Clear window.electron
    delete (window as any).electron;
  });

  afterEach(() => {
    delete (window as any).electron;
  });

  it('detects browser platform and initializes Core', async () => {
    render(
      <CoreProvider>
        <div>Content</div>
      </CoreProvider>
    );

    await waitFor(() => {
      expect(createCore).toHaveBeenCalledWith({ platform: 'browser' });
    });

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('detects electron platform and initializes Core', async () => {
    // Mock electron environment
    (window as any).electron = { ipcRenderer: {} };

    render(
      <CoreProvider>
        <div>Content</div>
      </CoreProvider>
    );

    await waitFor(() => {
      expect(createCore).toHaveBeenCalledWith({ platform: 'electron' });
    });

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows loading state during initialization', () => {
    // Make createCore never resolve to keep loading state
    vi.mocked(createCore).mockReturnValue(new Promise(() => {}) as any);

    render(
      <CoreProvider>
        <div>Content</div>
      </CoreProvider>
    );

    expect(screen.getByText('Initializing...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('displays error state if core creation fails', async () => {
    const error = new Error('Failed to create core');
    vi.mocked(createCore).mockRejectedValue(error);

    render(
      <CoreProvider>
        <div>Content</div>
      </CoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to Initialize')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to create core')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('provides core instance via useCore hook', async () => {
    function TestComponent() {
      const core = useCore();
      return <div>Core loaded: {core ? 'yes' : 'no'}</div>;
    }

    render(
      <CoreProvider>
        <TestComponent />
      </CoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Core loaded: yes')).toBeInTheDocument();
    });
  });

  it('throws error when useCore is used outside CoreProvider', () => {
    function TestComponent() {
      try {
        useCore();
        return <div>Should not reach here</div>;
      } catch (error) {
        return <div>{(error as Error).message}</div>;
      }
    }

    render(<TestComponent />);

    expect(screen.getByText('useCore must be used within a CoreProvider')).toBeInTheDocument();
  });

  it('calls core.close on unmount', async () => {
    const { unmount } = render(
      <CoreProvider>
        <div>Content</div>
      </CoreProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    // Unmount
    unmount();

    // Give cleanup a moment to run
    await waitFor(() => {
      expect(mockCore.close).toHaveBeenCalled();
    });
  });

  it('handles core.close errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockCore.close as any).mockRejectedValue(new Error('Close failed'));

    const { unmount } = render(
      <CoreProvider>
        <div>Content</div>
      </CoreProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    // Unmount
    unmount();

    // Give cleanup a moment to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should log error but not throw
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to close core:',
        expect.any(Error)
      );
    }, { timeout: 1000 });

    consoleErrorSpy.mockRestore();
  });

  it('prevents setting state after unmount', async () => {
    const { unmount } = render(
      <CoreProvider>
        <div>Content</div>
      </CoreProvider>
    );

    // Unmount immediately (before Core finishes loading)
    unmount();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not throw or cause errors (no state updates after unmount)
  });

  it('initializes only once even with multiple renders', async () => {
    const { rerender } = render(
      <CoreProvider>
        <div>Content 1</div>
      </CoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });

    // Rerender with different children
    rerender(
      <CoreProvider>
        <div>Content 2</div>
      </CoreProvider>
    );

    // createCore should only be called once
    expect(createCore).toHaveBeenCalledTimes(1);
  });
});
