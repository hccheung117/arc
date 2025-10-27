/**
 * Message Component Integration Tests
 *
 * Tests that user interactions trigger correct callback functions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Message } from '@/components/message';

describe('Message', () => {
  it('renders user message correctly', () => {
    const message = {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello world',
      status: 'complete' as const,
    };

    render(
      <Message
        message={message}
        isLatestAssistant={false}
      />
    );

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders assistant message with markdown', () => {
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: '# Hello\n\nThis is **bold** text.',
      status: 'complete' as const,
    };

    render(
      <Message
        message={message}
        isLatestAssistant={false}
      />
    );

    // Check that markdown is rendered
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Hello');
  });

  it('shows streaming indicator for streaming messages', () => {
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello',
      status: 'streaming' as const,
    };

    const { container } = render(
      <Message
        message={message}
        isLatestAssistant={true}
      />
    );

    // Check for the animated cursor
    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).toBeInTheDocument();
  });

  it('shows stopped indicator for stopped messages', () => {
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello',
      status: 'stopped' as const,
    };

    render(
      <Message
        message={message}
        isLatestAssistant={true}
      />
    );

    expect(screen.getByText('(stopped)')).toBeInTheDocument();
  });

  it('calls onStop when stop button clicked', async () => {
    const handleStop = vi.fn();
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello',
      status: 'streaming' as const,
    };

    render(
      <Message
        message={message}
        isLatestAssistant={true}
        onStop={handleStop}
      />
    );

    // Hover to show buttons
    const messageContainer = screen.getByText('Hello').closest('.group');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
    }

    // Wait for button to appear after hover
    const stopButton = await screen.findByText(/stop/i);
    fireEvent.click(stopButton);

    expect(handleStop).toHaveBeenCalledTimes(1);
  });

  it('calls onRegenerate with message ID when regenerate clicked', async () => {
    const handleRegenerate = vi.fn();
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello world',
      status: 'complete' as const,
    };

    render(
      <Message
        message={message}
        isLatestAssistant={true}
        onRegenerate={handleRegenerate}
      />
    );

    // Hover to show buttons
    const messageContainer = screen.getByText('Hello world').closest('.group');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
    }

    // Wait for button to appear after hover
    const regenerateButton = await screen.findByText(/regenerate/i);
    fireEvent.click(regenerateButton);

    expect(handleRegenerate).toHaveBeenCalledWith('msg-1');
  });

  it('calls onDelete with message ID when delete clicked', async () => {
    const handleDelete = vi.fn();
    const message = {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello world',
      status: 'complete' as const,
    };

    render(
      <Message
        message={message}
        isLatestAssistant={false}
        onDelete={handleDelete}
      />
    );

    // Hover to show buttons
    const messageContainer = screen.getByText('Hello world').closest('.group');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
    }

    // Wait for button to appear after hover
    const deleteButton = await screen.findByText(/delete/i);
    fireEvent.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith('msg-1');
  });

  it('shows regenerate button only for latest assistant message', async () => {
    const user = userEvent.setup();
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello',
      status: 'complete' as const,
    };

    const { rerender } = render(
      <Message
        message={message}
        isLatestAssistant={true}
        onRegenerate={vi.fn()}
      />
    );

    // Hover to show buttons
    const messageContainer = screen.getByText('Hello').closest('.group');
    if (messageContainer) {
      await user.hover(messageContainer);
    }

    // Wait for button to appear after hover
    expect(await screen.findByText(/regenerate/i)).toBeInTheDocument();

    rerender(
      <Message
        message={message}
        isLatestAssistant={false}
        onRegenerate={vi.fn()}
      />
    );

    // Button should not be present for non-latest messages even when hovering
    expect(screen.queryByText(/regenerate/i)).not.toBeInTheDocument();
  });

  it('does not show action buttons for streaming messages except stop', async () => {
    const user = userEvent.setup();
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello',
      status: 'streaming' as const,
    };

    render(
      <Message
        message={message}
        isLatestAssistant={true}
        onStop={vi.fn()}
        onRegenerate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Hover to show buttons
    const messageContainer = screen.getByText('Hello').closest('.group');
    if (messageContainer) {
      await user.hover(messageContainer);
    }

    // Wait for stop button to appear after hover
    expect(await screen.findByText(/stop/i)).toBeInTheDocument();
    expect(screen.queryByText(/regenerate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  it('renders image attachments', () => {
    const message = {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Check this image',
      status: 'complete' as const,
      attachments: [
        {
          id: 'att-1',
          data: 'data:image/png;base64,abc123',
          mimeType: 'image/png',
          size: 1024,
          name: 'test.png',
        },
      ],
    };

    render(
      <Message
        message={message}
        isLatestAssistant={false}
      />
    );

    const image = screen.getByAltText(/image 1/i);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('applies highlight styles when isHighlighted is true', () => {
    const message = {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello',
      status: 'complete' as const,
    };

    const { container } = render(
      <Message
        message={message}
        isLatestAssistant={false}
        isHighlighted={true}
      />
    );

    const messageDiv = container.querySelector('.ring-2.ring-yellow-400');
    expect(messageDiv).toBeInTheDocument();
  });

  describe('Error States', () => {
    it('renders error message with destructive styling', () => {
      const message = {
        id: 'msg-error',
        role: 'assistant' as const,
        content: '**Failed to load models**\n\nInvalid API key.',
        status: 'error' as const,
      };

      const { container } = render(
        <Message
          message={message}
          isLatestAssistant={false}
        />
      );

      // Check for error styling (border-destructive class with opacity modifier)
      const messageContainer = container.querySelector('[class*="border-destructive"]');
      expect(messageContainer).toBeInTheDocument();
    });

    it('shows AlertCircle icon for error messages', () => {
      const message = {
        id: 'msg-error',
        role: 'assistant' as const,
        content: 'Error occurred',
        status: 'error' as const,
      };

      const { container } = render(
        <Message
          message={message}
          isLatestAssistant={false}
        />
      );

      // Check for AlertCircle icon (lucide-react renders as svg)
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('shows retry button for retryable error messages', async () => {
      const handleRetry = vi.fn();
      const message = {
        id: 'msg-error',
        role: 'assistant' as const,
        content: 'Network error',
        status: 'error' as const,
      };

      render(
        <Message
          message={message}
          isLatestAssistant={false}
          onRetry={handleRetry}
          errorMetadata={{ isRetryable: true }}
        />
      );

      // Retry button should be visible for retryable errors
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('does not show retry button for non-retryable errors', () => {
      const handleRetry = vi.fn();
      const message = {
        id: 'msg-error',
        role: 'assistant' as const,
        content: 'Invalid API key',
        status: 'error' as const,
      };

      render(
        <Message
          message={message}
          isLatestAssistant={false}
          onRetry={handleRetry}
          errorMetadata={{ isRetryable: false }}
        />
      );

      // Retry button should NOT be visible for non-retryable errors
      const retryButton = screen.queryByRole('button', { name: /retry/i });
      expect(retryButton).not.toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const handleRetry = vi.fn();
      const message = {
        id: 'msg-error',
        role: 'assistant' as const,
        content: 'Network error',
        status: 'error' as const,
      };

      render(
        <Message
          message={message}
          isLatestAssistant={false}
          onRetry={handleRetry}
          errorMetadata={{ isRetryable: true }}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('does not show regenerate or delete buttons for error messages', () => {
      const message = {
        id: 'msg-error',
        role: 'assistant' as const,
        content: 'Error occurred',
        status: 'error' as const,
      };

      render(
        <Message
          message={message}
          isLatestAssistant={true}
          onRegenerate={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // Regenerate and delete should not be shown for error messages
      const regenerateButton = screen.queryByRole('button', { name: /regenerate/i });
      const deleteButton = screen.queryByRole('button', { name: /delete/i });

      expect(regenerateButton).not.toBeInTheDocument();
      expect(deleteButton).not.toBeInTheDocument();
    });
  });
});
