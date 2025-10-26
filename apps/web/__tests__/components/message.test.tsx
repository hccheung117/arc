/**
 * Message Component Integration Tests
 *
 * Tests that user interactions trigger correct callback functions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    const user = userEvent.setup();
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
      await user.hover(messageContainer);
    }

    const stopButton = screen.getByText(/stop/i);
    await user.click(stopButton);

    expect(handleStop).toHaveBeenCalledTimes(1);
  });

  it('calls onRegenerate with message ID when regenerate clicked', async () => {
    const user = userEvent.setup();
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
      await user.hover(messageContainer);
    }

    const regenerateButton = screen.getByText(/regenerate/i);
    await user.click(regenerateButton);

    expect(handleRegenerate).toHaveBeenCalledWith('msg-1');
  });

  it('calls onDelete with message ID when delete clicked', async () => {
    const user = userEvent.setup();
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
      await user.hover(messageContainer);
    }

    const deleteButton = screen.getByText(/delete/i);
    await user.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith('msg-1');
  });

  it('shows regenerate button only for latest assistant message', () => {
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

    expect(screen.getByText(/regenerate/i)).toBeInTheDocument();

    rerender(
      <Message
        message={message}
        isLatestAssistant={false}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.queryByText(/regenerate/i)).not.toBeInTheDocument();
  });

  it('does not show action buttons for streaming messages except stop', () => {
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

    expect(screen.getByText(/stop/i)).toBeInTheDocument();
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
});
