/**
 * Reactive Chat Titling Integration Tests
 *
 * Tests that the UI updates reactively when chat titles are changed by auto-titling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HomePage from '@/app/page';
import { CoreProvider } from '@/lib/core-provider';
import { createMockCore } from '../test-utils';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => null,
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Reactive Chat Titling Integration', () => {
  let mockCore: ReturnType<typeof createMockCore>;
  let titleUpdatedCallback: ((event: { chatId: string; title: string }) => void) | null = null;

  beforeEach(() => {
    mockCore = createMockCore();
    titleUpdatedCallback = null;

    // Mock the event subscription
    mockCore.chats.on = vi.fn((event: string, callback: (data: { chatId: string; title: string }) => void) => {
      if (event === 'title-updated') {
        titleUpdatedCallback = callback;
      }
    });

    mockCore.chats.off = vi.fn();

    // Set up default mock responses
    mockCore.chats.list.mockResolvedValue([
      {
        id: 'chat-1',
        title: 'New Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 2,
      },
      {
        id: 'chat-2',
        title: 'Another Chat',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        messageCount: 5,
      },
    ]);

    mockCore.messages.list.mockResolvedValue([]);
    mockCore.messages.getPinnedMessages.mockResolvedValue([]);
    mockCore.providers.list.mockResolvedValue([]);
    mockCore.settings.get.mockResolvedValue({
      lineHeight: 'normal',
      fontFamily: 'sans',
      defaultSystemPrompt: '',
      autoTitleChats: true,
    });
  });

  it('subscribes to title-updated events on mount', async () => {
    render(
      <CoreProvider value={mockCore}>
        <HomePage />
      </CoreProvider>
    );

    await waitFor(() => {
      expect(mockCore.chats.on).toHaveBeenCalledWith(
        'title-updated',
        expect.any(Function)
      );
    });
  });

  it('unsubscribes from title-updated events on unmount', async () => {
    const { unmount } = render(
      <CoreProvider value={mockCore}>
        <HomePage />
      </CoreProvider>
    );

    await waitFor(() => {
      expect(mockCore.chats.on).toHaveBeenCalled();
    });

    unmount();

    expect(mockCore.chats.off).toHaveBeenCalledWith(
      'title-updated',
      expect.any(Function)
    );
  });

  it('updates chat title in list when title-updated event is emitted', async () => {
    render(
      <CoreProvider value={mockCore}>
        <HomePage />
      </CoreProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeInTheDocument();
    });

    // Simulate auto-titling event
    if (titleUpdatedCallback) {
      titleUpdatedCallback({
        chatId: 'chat-1',
        title: 'Updated Chat Title',
      });
    }

    // Title should update without reloading
    await waitFor(() => {
      expect(screen.getByText('Updated Chat Title')).toBeInTheDocument();
      expect(screen.queryByText('New Chat')).not.toBeInTheDocument();
    });
  });

  it('updates correct chat when multiple chats exist', async () => {
    render(
      <CoreProvider value={mockCore}>
        <HomePage />
      </CoreProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeInTheDocument();
      expect(screen.getByText('Another Chat')).toBeInTheDocument();
    });

    // Simulate auto-titling event for chat-2
    if (titleUpdatedCallback) {
      titleUpdatedCallback({
        chatId: 'chat-2',
        title: 'Renamed Second Chat',
      });
    }

    // Only chat-2 should be updated
    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeInTheDocument(); // chat-1 unchanged
      expect(screen.getByText('Renamed Second Chat')).toBeInTheDocument(); // chat-2 updated
      expect(screen.queryByText('Another Chat')).not.toBeInTheDocument();
    });
  });

  it('does not reload chats from API when title is updated', async () => {
    render(
      <CoreProvider value={mockCore}>
        <HomePage />
      </CoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeInTheDocument();
    });

    // Clear the mock call count
    mockCore.chats.list.mockClear();

    // Simulate auto-titling event
    if (titleUpdatedCallback) {
      titleUpdatedCallback({
        chatId: 'chat-1',
        title: 'Updated via Event',
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Updated via Event')).toBeInTheDocument();
    });

    // Should NOT have called chats.list again
    expect(mockCore.chats.list).not.toHaveBeenCalled();
  });

  it('handles title updates for non-existent chats gracefully', async () => {
    render(
      <CoreProvider value={mockCore}>
        <HomePage />
      </CoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeInTheDocument();
    });

    // Simulate event for non-existent chat
    if (titleUpdatedCallback) {
      titleUpdatedCallback({
        chatId: 'non-existent-chat',
        title: 'Should Not Appear',
      });
    }

    // Original chats should remain unchanged
    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeInTheDocument();
      expect(screen.getByText('Another Chat')).toBeInTheDocument();
      expect(screen.queryByText('Should Not Appear')).not.toBeInTheDocument();
    });
  });

  it('maintains reactive updates across multiple events', async () => {
    render(
      <CoreProvider value={mockCore}>
        <HomePage />
      </CoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeInTheDocument();
    });

    // First update
    if (titleUpdatedCallback) {
      titleUpdatedCallback({
        chatId: 'chat-1',
        title: 'First Update',
      });
    }

    await waitFor(() => {
      expect(screen.getByText('First Update')).toBeInTheDocument();
    });

    // Second update to same chat
    if (titleUpdatedCallback) {
      titleUpdatedCallback({
        chatId: 'chat-1',
        title: 'Second Update',
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Second Update')).toBeInTheDocument();
      expect(screen.queryByText('First Update')).not.toBeInTheDocument();
    });

    // Update different chat
    if (titleUpdatedCallback) {
      titleUpdatedCallback({
        chatId: 'chat-2',
        title: 'Other Chat Updated',
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Second Update')).toBeInTheDocument();
      expect(screen.getByText('Other Chat Updated')).toBeInTheDocument();
    });
  });
});
