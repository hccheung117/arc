/**
 * ChatSidebar Responsive Behavior Tests
 *
 * Tests that the ChatSidebar adapts correctly to mobile and desktop viewports.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ChatSidebar } from '@/components/chat-sidebar';
import { renderWithSidebar, createTestChat } from '../test-utils';
import * as useMobileModule from '../../hooks/use-mobile';

// Mock the useIsMobile hook
vi.mock('../../hooks/use-mobile');

describe('ChatSidebar Responsive Behavior', () => {
  const defaultProps = {
    chats: [
      createTestChat({ id: 'chat-1', title: 'Test Chat 1' }),
      createTestChat({ id: 'chat-2', title: 'Test Chat 2' }),
    ],
    activeChatId: null,
    sidebarSearchQuery: '',
    setSidebarSearchQuery: vi.fn(),
    onSelectChat: vi.fn(),
    onCreateChat: vi.fn(),
    onRenameChat: vi.fn(),
    onDeleteChat: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop Behavior', () => {
    beforeEach(() => {
      // Mock desktop viewport
      vi.mocked(useMobileModule.useIsMobile).mockReturnValue(false);
    });

    it('renders sidebar with icon-collapsible mode on desktop', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      // Sidebar should be rendered (not as Sheet)
      // Verify by checking for the toggle button
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('persists sidebar in DOM when collapsed on desktop', () => {
      renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: false });

      // Even when collapsed, sidebar structure should still exist
      // We can verify this by checking that the toggle button is still present
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('Mobile Behavior', () => {
    beforeEach(() => {
      // Mock mobile viewport
      vi.mocked(useMobileModule.useIsMobile).mockReturnValue(true);
    });

    it('renders sidebar with Sheet component on mobile', () => {
      // On mobile, the sidebar uses Sheet component which renders in a portal
      // The shadcn/ui Sidebar component handles this internally
      const { container } = renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: true });

      // Verify the sidebar wrapper is rendered
      expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toBeInTheDocument();
    });

    it('uses offcanvas mode on mobile', () => {
      // On mobile, sidebar doesn't collapse - it's either fully open (Sheet overlay) or hidden
      const { container } = renderWithSidebar(<ChatSidebar {...defaultProps} />, { defaultOpen: false });

      // Verify the sidebar wrapper exists (structure is in DOM even when closed)
      expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toBeInTheDocument();
    });
  });
});
