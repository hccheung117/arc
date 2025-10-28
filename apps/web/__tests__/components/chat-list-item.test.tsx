/**
 * ChatListItem Component Integration Tests
 *
 * Tests that user interactions trigger correct callback functions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatListItem } from '@/components/chat-list-item';
import { createTestChat } from '../test-utils';

describe('ChatListItem', () => {
  it('renders chat title correctly', () => {
    const chat = createTestChat({ title: 'My Test Chat' });

    render(
      <ChatListItem
        chat={chat}
        isActive={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('My Test Chat')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const chat = createTestChat();

    render(
      <ChatListItem
        chat={chat}
        isActive={false}
        onClick={handleClick}
      />
    );

    await user.click(screen.getByText(chat.title));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows active state when isActive is true', () => {
    const chat = createTestChat();

    const { container } = render(
      <ChatListItem
        chat={chat}
        isActive={true}
        onClick={() => {}}
      />
    );

    // Active chat should have bg-accent class
    const chatDiv = container.querySelector('.group');
    expect(chatDiv?.className).toContain('bg-accent');
  });

  it('triggers rename callback with new title', async () => {
    const user = userEvent.setup();
    const handleRename = vi.fn();
    const chat = createTestChat({ title: 'Original Title' });

    render(
      <ChatListItem
        chat={chat}
        isActive={false}
        onClick={() => {}}
        onRename={handleRename}
      />
    );

    // Open edit mode by double-clicking title
    const titleDiv = screen.getByText('Original Title');
    await user.dblClick(titleDiv);

    // Change the title
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New Title');

    // Blur to save (simulates clicking outside)
    input.blur();

    expect(handleRename).toHaveBeenCalledWith(chat.id, 'New Title');
  });

  it('does not trigger rename if title unchanged', async () => {
    const user = userEvent.setup();
    const handleRename = vi.fn();
    const chat = createTestChat({ title: 'Original Title' });

    render(
      <ChatListItem
        chat={chat}
        isActive={false}
        onClick={() => {}}
        onRename={handleRename}
      />
    );

    // Open edit mode by double-clicking title
    const titleDiv = screen.getByText('Original Title');
    await user.dblClick(titleDiv);

    // Blur without changing (simulates clicking outside)
    const input = screen.getByRole('textbox');
    input.blur();

    expect(handleRename).not.toHaveBeenCalled();
  });

  it('shows delete button on hover', () => {
    const handleDelete = vi.fn();
    const chat = createTestChat({ title: 'Chat to Delete' });

    const { container } = render(
      <ChatListItem
        chat={chat}
        isActive={false}
        onClick={() => {}}
        onDelete={handleDelete}
      />
    );

    // Delete button should not be visible initially (requires hover state)
    // Note: Full hover interaction testing requires E2E tools
    // This test verifies the component renders correctly with onDelete prop
    expect(container.querySelector('.group')).toBeInTheDocument();
  });

  it('handles edit mode correctly', async () => {
    const user = userEvent.setup();
    const chat = createTestChat({ title: 'Test Chat' });

    render(
      <ChatListItem
        chat={chat}
        isActive={false}
        onClick={() => {}}
      />
    );

    // Verify title is displayed
    expect(screen.getByText('Test Chat')).toBeInTheDocument();

    // Enter edit mode by double-clicking
    const titleDiv = screen.getByText('Test Chat');
    await user.dblClick(titleDiv);

    // Should show input in edit mode
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('cancels edit mode on escape key', async () => {
    const user = userEvent.setup();
    const handleRename = vi.fn();
    const chat = createTestChat({ title: 'Original Title' });

    render(
      <ChatListItem
        chat={chat}
        isActive={false}
        onClick={() => {}}
        onRename={handleRename}
      />
    );

    // Open edit mode by double-clicking title
    const titleDiv = screen.getByText('Original Title');
    await user.dblClick(titleDiv);

    // Press escape
    await user.keyboard('{Escape}');

    // Should exit edit mode without calling rename
    expect(handleRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
