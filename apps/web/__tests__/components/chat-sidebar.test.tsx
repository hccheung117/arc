/**
 * ChatSidebar Component Unit Tests
 *
 * Tests the ChatSidebar component in both collapsed and expanded states,
 * verifying rendering, interactions, and callback propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatSidebar } from '@/components/chat-sidebar';
import { renderWithSidebar, createTestChat } from '../test-utils';

describe('ChatSidebar', () => {
  const mockOnSelectChat = vi.fn();
  const mockOnCreateChat = vi.fn();
  const mockOnRenameChat = vi.fn();
  const mockOnDeleteChat = vi.fn();
  const mockSetSidebarSearchQuery = vi.fn();

  const defaultProps = {
    chats: [],
    activeChatId: null,
    sidebarSearchQuery: '',
    setSidebarSearchQuery: mockSetSidebarSearchQuery,
    onSelectChat: mockOnSelectChat,
    onCreateChat: mockOnCreateChat,
    onRenameChat: mockOnRenameChat,
    onDeleteChat: mockOnDeleteChat,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Expanded State', () => {
    it('renders sidebar with toggle button when expanded', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      // SidebarTrigger should be present
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('renders "Chats" header text when expanded', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      expect(screen.getByText('Chats')).toBeInTheDocument();
    });

    it('renders search input when expanded', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      const searchInput = screen.getByPlaceholderText(/search chats/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('renders "New Chat" button with text when expanded', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      expect(newChatButton).toBeInTheDocument();
      expect(within(newChatButton).getByText('New Chat')).toBeInTheDocument();
    });

    it('displays all chats from props when expanded', () => {
      const chats = [
        createTestChat({ id: 'chat-1', title: 'Test Chat 1' }),
        createTestChat({ id: 'chat-2', title: 'Test Chat 2' }),
        createTestChat({ id: 'chat-3', title: 'Test Chat 3' }),
      ];

      renderWithSidebar(<ChatSidebar {...defaultProps} chats={chats} />, { defaultOpen: true });

      expect(screen.getByText('Test Chat 1')).toBeInTheDocument();
      expect(screen.getByText('Test Chat 2')).toBeInTheDocument();
      expect(screen.getByText('Test Chat 3')).toBeInTheDocument();
    });
  });

  describe('Collapsed State', () => {
    it('hides "Chats" header text when collapsed', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: false });

      expect(screen.queryByText('Chats')).not.toBeInTheDocument();
    });

    it('hides search input when collapsed', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: false });

      expect(screen.queryByPlaceholderText(/search chats/i)).not.toBeInTheDocument();
    });

    it('renders icon-only "New Chat" button when collapsed', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: false });

      // Should have a button with just the icon (no "New Chat" text visible)
      const buttons = screen.getAllByRole('button');
      const iconButtons = buttons.filter(btn => !btn.textContent?.includes('New Chat'));
      expect(iconButtons.length).toBeGreaterThan(0);
    });

    it('hides chat list when collapsed', () => {
      const chats = [
        createTestChat({ id: 'chat-1', title: 'Test Chat 1' }),
        createTestChat({ id: 'chat-2', title: 'Test Chat 2' }),
      ];

      renderWithSidebar(<ChatSidebar {...defaultProps} chats={chats} />, { defaultOpen: false });

      // Chats should not be visible when collapsed
      expect(screen.queryByText('Test Chat 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Chat 2')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onCreateChat when "New Chat" button is clicked', async () => {
      const user = userEvent.setup();
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      await user.click(newChatButton);

      expect(mockOnCreateChat).toHaveBeenCalledTimes(1);
    });

    it('calls setSidebarSearchQuery when search input changes', async () => {
      const user = userEvent.setup();
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      const searchInput = screen.getByPlaceholderText(/search chats/i);
      await user.type(searchInput, 'test query');

      expect(mockSetSidebarSearchQuery).toHaveBeenCalled();
    });

    it('filters chats based on search query', () => {
      const chats = [
        createTestChat({ id: 'chat-1', title: 'Project Alpha' }),
        createTestChat({ id: 'chat-2', title: 'Project Beta' }),
        createTestChat({ id: 'chat-3', title: 'Meeting Notes' }),
      ];

      renderWithSidebar(
        <ChatSidebar {...defaultProps} chats={chats} sidebarSearchQuery="project" />,
        { defaultOpen: true }
      );

      // Should show chats matching "project"
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      // Should not show non-matching chat
      expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
    });

    it('highlights active chat correctly', () => {
      const chats = [
        createTestChat({ id: 'chat-1', title: 'Chat 1' }),
        createTestChat({ id: 'chat-2', title: 'Chat 2' }),
      ];

      const { container } = renderWithSidebar(
        <ChatSidebar {...defaultProps} chats={chats} activeChatId="chat-1" />,
        { defaultOpen: true }
      );

      // Check that the active chat has the bg-accent class
      const chatElements = container.querySelectorAll('.group');
      const activeElement = Array.from(chatElements).find(
        el => el.className.includes('bg-accent')
      );
      expect(activeElement).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('performs case-insensitive search', () => {
      const chats = [
        createTestChat({ id: 'chat-1', title: 'Important Meeting' }),
        createTestChat({ id: 'chat-2', title: 'casual chat' }),
      ];

      renderWithSidebar(
        <ChatSidebar {...defaultProps} chats={chats} sidebarSearchQuery="CHAT" />,
        { defaultOpen: true }
      );

      expect(screen.queryByText('Important Meeting')).not.toBeInTheDocument();
      expect(screen.getByText('casual chat')).toBeInTheDocument();
    });

    it('shows all chats when search query is empty', () => {
      const chats = [
        createTestChat({ id: 'chat-1', title: 'Chat 1' }),
        createTestChat({ id: 'chat-2', title: 'Chat 2' }),
      ];

      renderWithSidebar(
        <ChatSidebar {...defaultProps} chats={chats} sidebarSearchQuery="" />,
        { defaultOpen: true }
      );

      expect(screen.getByText('Chat 1')).toBeInTheDocument();
      expect(screen.getByText('Chat 2')).toBeInTheDocument();
    });
  });
});
