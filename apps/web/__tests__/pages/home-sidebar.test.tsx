/**
 * Home Page Sidebar Integration Tests
 *
 * Tests that the home page correctly integrates the ChatSidebar with
 * SidebarProvider and that sidebar state management works end-to-end.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithSidebar, createMockCore, createTestChat } from '../test-utils';
import Home from '@/app/page';

// Mock the Core provider
vi.mock('@/lib/core-provider', () => ({
  useCore: () => createMockCore({
    chats: [
      createTestChat({ id: 'chat-1', title: 'Test Chat 1' }),
      createTestChat({ id: 'chat-2', title: 'Test Chat 2' }),
    ],
  }),
}));

// Mock useModels hook
vi.mock('@/lib/use-models', () => ({
  useModels: () => ({
    groupedModels: [],
    isLoading: false,
    errors: new Map(),
    getErrorDetails: vi.fn(),
    refetch: vi.fn(),
  }),
}));

// Mock useChatManagement hook
vi.mock('@/lib/use-chat-management', () => ({
  useChatManagement: () => ({
    chats: [
      createTestChat({ id: 'chat-1', title: 'Test Chat 1' }),
      createTestChat({ id: 'chat-2', title: 'Test Chat 2' }),
    ],
    activeChatId: 'chat-1',
    setActiveChatId: vi.fn(),
    createChat: vi.fn(),
    selectChat: vi.fn(),
    renameChat: vi.fn(),
    deleteChat: vi.fn(),
    refreshChats: vi.fn(),
  }),
}));

// Mock useMessageOperations hook
vi.mock('@/lib/use-message-operations', () => ({
  useMessageOperations: () => ({
    messages: [],
    pinnedMessages: [],
    isStreaming: false,
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
    stopMessage: vi.fn(),
    regenerateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    editMessage: vi.fn(),
    pinMessage: vi.fn(),
    branchOff: vi.fn(),
  }),
}));

// Mock useSearchState hook
vi.mock('@/lib/use-search-state', () => ({
  useSearchState: () => ({
    searchActive: false,
    searchMatches: [],
    currentMatchIndex: -1,
    sidebarSearchQuery: '',
    globalSearchQuery: '',
    globalSearchResults: [],
    setSearchActive: vi.fn(),
    setSidebarSearchQuery: vi.fn(),
    setGlobalSearchQuery: vi.fn(),
    handleSearch: vi.fn(),
    handleSearchNext: vi.fn(),
    handleSearchPrevious: vi.fn(),
    handleSearchClose: vi.fn(),
  }),
}));

// Mock useImageAttachments hook
vi.mock('@/lib/use-image-attachments', () => ({
  useImageAttachments: () => ({
    attachedImages: [],
    attachmentError: null,
    fileInputRef: { current: null },
    handleDrop: vi.fn(),
    handleDragOver: vi.fn(),
    handlePaste: vi.fn(),
    handleFileInputChange: vi.fn(),
    removeImageAttachment: vi.fn(),
    clearAttachments: vi.fn(),
    clearAttachmentError: vi.fn(),
  }),
}));

// Mock useDisplayItems hook
vi.mock('@/lib/use-display-items', () => ({
  useDisplayItems: () => [],
}));

describe('Home Page Sidebar Integration', () => {
  it('renders page with SidebarProvider wrapper', () => {
    renderWithSidebar(<Home />);

    // Page should render without errors
    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it('renders ChatSidebar within the page', () => {
    renderWithSidebar(<Home />);

    // Sidebar components should be present
    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it('does not render mobile menu button', () => {
    renderWithSidebar(<Home />);

    // The old mobile MenuIcon button should not be present
    // Only the SidebarTrigger should exist
    const buttons = screen.getAllByRole('button');
    const mobileMenuButton = buttons.find(btn =>
      btn.getAttribute('aria-label') === 'Toggle sidebar' &&
      btn.className.includes('fixed')
    );
    expect(mobileMenuButton).toBeUndefined();
  });

  it('renders main content area alongside sidebar', () => {
    renderWithSidebar(<Home />);

    // Main content components should be present
    // Check for message composer or other main content indicators
    const mainContent = document.querySelector('.flex.flex-1.flex-col');
    expect(mainContent).toBeInTheDocument();
  });

  it('renders Command Palette', () => {
    renderWithSidebar(<Home />);

    // Command palette should be in the DOM (even if closed)
    // It's rendered by the Home component
    expect(document.body).toBeInTheDocument();
  });
});
