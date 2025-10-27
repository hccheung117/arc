/**
 * Test Utilities
 *
 * Helper functions and components for testing UI components.
 * Provides mock Core factory and test wrapper components.
 */

import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import type { Core } from '@arc/core/core.js';
import type { Chat } from '@arc/core/core.js';
import type { Message } from '@arc/core/core.js';
import type { ProviderConfig } from '@arc/core/core.js';
import type { SearchResult } from '@arc/core/core.js';
import type { Settings } from '@arc/core/core.js';

// ============================================================================
// Mock Core Factory
// ============================================================================

export interface MockCoreOptions {
  chats?: Chat[];
  messages?: Message[];
  providers?: ProviderConfig[];
  settings?: Settings;
}

/**
 * Create a mock Core instance with default implementations
 */
export function createMockCore(options: MockCoreOptions = {}): Core {
  const {
    chats = [],
    messages = [],
    providers = [],
    settings = {
      theme: 'system',
      fontSize: 'medium',
      enableMarkdown: true,
      enableSyntaxHighlighting: true,
    },
  } = options;

  // Create mock async generators for streaming
  async function* mockStreamGenerator() {
    yield { messageId: 'msg-1', content: 'Hello', status: 'streaming' as const };
    yield { messageId: 'msg-1', content: ' world', status: 'complete' as const };
  }

  const mockCore: Core = {
    // Providers API
    providers: {
      list: vi.fn().mockResolvedValue(providers),
      create: vi.fn().mockImplementation(async (config) => ({
        id: `provider-${Date.now()}`,
        ...config,
        enabled: true,
      })),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      checkConnection: vi.fn().mockResolvedValue(undefined),
      getModels: vi.fn().mockResolvedValue([
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
        { id: 'claude-3', name: 'Claude 3', provider: 'anthropic' },
      ]),
    },

    // Chats API
    chats: {
      list: vi.fn().mockResolvedValue(chats),
      get: vi.fn().mockImplementation(async (id: string) => {
        const chat = chats.find((c) => c.id === id);
        if (!chat) return null;
        return {
          ...chat,
          messages: messages.filter((m) => m.chatId === id),
        };
      }),
      create: vi.fn().mockImplementation((params) => ({
        id: `chat-${Date.now()}`,
        title: params.title || 'New Chat',
        createdAt: new Date(),
        updatedAt: new Date(),
        send: vi.fn().mockReturnValue(mockStreamGenerator()),
      })),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockReturnValue(mockStreamGenerator()),
    },

    // Messages API
    messages: {
      list: vi.fn().mockResolvedValue(messages),
      getPinnedMessages: vi.fn().mockResolvedValue([]),
      regenerate: vi.fn().mockReturnValue(mockStreamGenerator()),
      edit: vi.fn().mockReturnValue(mockStreamGenerator()),
      delete: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },

    // Search API
    search: {
      messages: vi.fn().mockResolvedValue([] as SearchResult[]),
      messagesInChat: vi.fn().mockResolvedValue([] as SearchResult[]),
      chats: vi.fn().mockResolvedValue([]),
    },

    // Settings API
    settings: {
      get: vi.fn().mockResolvedValue(settings),
      update: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined),
    },

    // Core methods
    close: vi.fn().mockResolvedValue(undefined),
  };

  return mockCore;
}

// ============================================================================
// Test Wrapper Components
// ============================================================================

/**
 * Create a test context provider that wraps components with a mock Core
 */
export function createTestCoreProvider(mockCore: Core) {
  const CoreContext = React.createContext<{ core: Core; isReady: boolean } | undefined>(undefined);

  function TestCoreProvider({ children }: { children: React.ReactNode }) {
    return (
      <CoreContext.Provider value={{ core: mockCore, isReady: true }}>
        {children}
      </CoreContext.Provider>
    );
  }

  // Mock the useCore hook
  function useCore(): Core {
    const context = React.useContext(CoreContext);
    if (context === undefined) {
      throw new Error('useCore must be used within a CoreProvider');
    }
    return context.core;
  }

  return { TestCoreProvider, useCore, CoreContext };
}

// ============================================================================
// Custom Render Function
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  mockCore?: Core;
}

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithCore(
  ui: ReactElement,
  options?: CustomRenderOptions
): ReturnType<typeof render> & { mockCore: Core } {
  const mockCore = options?.mockCore || createMockCore();
  const { TestCoreProvider } = createTestCoreProvider(mockCore);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <TestCoreProvider>{children}</TestCoreProvider>;
  }

  return {
    ...render(ui, { ...options, wrapper: Wrapper }),
    mockCore,
  };
}

// ============================================================================
// Test Data Factories
// ============================================================================

export function createTestChat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: `chat-${Date.now()}`,
    title: 'Test Chat',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Date.now()}`,
    chatId: 'chat-1',
    role: 'user',
    content: 'Test message',
    status: 'complete',
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: `provider-${Date.now()}`,
    name: 'Test Provider',
    type: 'openai',
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
    ...overrides,
  };
}
