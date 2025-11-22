import { contextBridge } from 'electron';

/**
 * Magic Proxy for M2 Verification
 *
 * This temporary IPC bridge returns sensible defaults for all method calls,
 * allowing the UI to render without a real backend.
 *
 * Will be replaced with real IPC handlers in M3.
 */

// Mock data for UI verification
const mockModels = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: { id: 'openai', name: 'OpenAI', type: 'openai' as const },
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: { id: 'anthropic', name: 'Anthropic', type: 'anthropic' as const },
  },
];

// Track stream event listeners for mock streaming
const streamListeners = {
  delta: new Set<(event: { streamId: string; chunk: string }) => void>(),
  complete: new Set<(event: { streamId: string; message: unknown }) => void>(),
  error: new Set<(event: { streamId: string; error: string }) => void>(),
};

/**
 * Simulates a streaming response for M2 testing.
 * Emits delta events with chunks, then a complete event.
 */
function simulateStream(streamId: string, messageId: string, conversationId: string, content: string) {
  const response = `This is a mock response to: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"

The Magic Proxy is working! This simulated response demonstrates that:
- The UI can render correctly
- Message streaming is functional
- The sidebar and workspace are connected

In Milestone 3, this will be replaced with real AI responses.`;

  const chunks = response.split(' ');
  let currentContent = '';
  let index = 0;

  const interval = setInterval(() => {
    if (index < chunks.length) {
      const chunk = (index === 0 ? '' : ' ') + chunks[index];
      currentContent += chunk;
      streamListeners.delta.forEach((cb) => cb({ streamId, chunk }));
      index++;
    } else {
      clearInterval(interval);
      const message = {
        id: messageId,
        conversationId,
        role: 'assistant' as const,
        status: 'complete' as const,
        content: currentContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      streamListeners.complete.forEach((cb) => cb({ streamId, message }));
    }
  }, 50);
}

const electronAPI = {
  // Models
  getModels: async () => mockModels,

  // Messages
  getMessages: async (_conversationId: string) => [],
  streamMessage: async (conversationId: string, _model: string, content: string) => {
    const streamId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    // Start streaming after a short delay
    setTimeout(() => simulateStream(streamId, messageId, conversationId, content), 100);
    return { streamId, messageId };
  },
  cancelStream: async (_streamId: string) => {},

  // Conversations
  getConversationSummaries: async () => [],
  deleteConversation: async (_conversationId: string) => {},
  renameConversation: async (_conversationId: string, _title: string) => {},
  togglePin: async (_conversationId: string, _pinned: boolean) => {},
  showThreadContextMenu: async (_currentPinnedState: boolean) => null,

  // Provider config
  updateProviderConfig: async (_providerId: string, _config: { apiKey?: string; baseUrl?: string }) => {},
  getProviderConfig: async (_providerId: string) => ({ apiKey: null, baseUrl: null }),

  // Stream event listeners
  onStreamDelta: (callback: (event: { streamId: string; chunk: string }) => void) => {
    streamListeners.delta.add(callback);
    return () => streamListeners.delta.delete(callback);
  },
  onStreamComplete: (callback: (event: { streamId: string; message: unknown }) => void) => {
    streamListeners.complete.add(callback);
    return () => streamListeners.complete.delete(callback);
  },
  onStreamError: (callback: (event: { streamId: string; error: string }) => void) => {
    streamListeners.error.add(callback);
    return () => streamListeners.error.delete(callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
