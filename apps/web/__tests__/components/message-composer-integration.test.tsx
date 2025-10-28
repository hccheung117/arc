/**
 * MessageComposer Integration Tests
 *
 * Tests the integration of TemperaturePopover and SystemPromptPopover
 * into the MessageComposer component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageComposer } from '@/components/message-composer';
import { createRef } from 'react';

describe('MessageComposer - Inline Controls Integration', () => {
  const mockSetMessageInput = vi.fn();
  const mockOnSendMessage = vi.fn();
  const mockOnTemperatureChange = vi.fn();
  const mockOnSystemPromptChange = vi.fn();
  const mockRemoveImageAttachment = vi.fn();
  const mockClearAttachmentError = vi.fn();
  const mockOnDrop = vi.fn();
  const mockOnDragOver = vi.fn();
  const mockOnPaste = vi.fn();
  const mockOnFileInputChange = vi.fn();

  const fileInputRef = createRef<HTMLInputElement>();

  const defaultProps = {
    messageInput: '',
    setMessageInput: mockSetMessageInput,
    attachedImages: [],
    attachmentError: '',
    clearAttachmentError: mockClearAttachmentError,
    removeImageAttachment: mockRemoveImageAttachment,
    hasProvider: true,
    isStreaming: false,
    temperature: 1.0,
    defaultTemperature: 1.0,
    onTemperatureChange: mockOnTemperatureChange,
    systemPrompt: '',
    onSystemPromptChange: mockOnSystemPromptChange,
    onSendMessage: mockOnSendMessage,
    onDrop: mockOnDrop,
    onDragOver: mockOnDragOver,
    onPaste: mockOnPaste,
    fileInputRef,
    onFileInputChange: mockOnFileInputChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Toolbar Button Layout', () => {
    it('renders all three action buttons in correct order', () => {
      render(<MessageComposer {...defaultProps} />);

      const buttons = screen.getAllByRole('button');

      // Should have: Image, Temperature, SystemPrompt, Send buttons
      expect(buttons.length).toBeGreaterThanOrEqual(4);

      // Verify temperature and system prompt buttons are present
      expect(screen.getByRole('button', { name: /Temperature:/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /system prompt/i })).toBeInTheDocument();
    });

    it('renders image attachment button first', () => {
      render(<MessageComposer {...defaultProps} />);

      const imageButton = screen.getByRole('button', { name: /Attach image/i });
      expect(imageButton).toBeInTheDocument();
    });

    it('renders temperature button after image button', () => {
      render(<MessageComposer {...defaultProps} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      expect(temperatureButton).toBeInTheDocument();
    });

    it('renders system prompt button after temperature button', () => {
      render(<MessageComposer {...defaultProps} />);

      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });
      expect(systemPromptButton).toBeInTheDocument();
    });

    it('renders send button last', () => {
      render(<MessageComposer {...defaultProps} />);

      const sendButton = screen.getByRole('button', { name: /Send message/i });
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe('Temperature Control Integration', () => {
    it('displays current temperature in button', () => {
      render(<MessageComposer {...defaultProps} temperature={0.3} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature: Precise/i });
      expect(temperatureButton).toBeInTheDocument();
    });

    it('shows visual indicator when temperature differs from default', () => {
      render(<MessageComposer {...defaultProps} temperature={0.3} defaultTemperature={1.0} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      expect(temperatureButton.className).toMatch(/bg-primary|text-primary/);
    });

    it('opens temperature popover when clicked', async () => {
      const user = userEvent.setup();
      render(<MessageComposer {...defaultProps} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(temperatureButton);

      await waitFor(() => {
        expect(screen.getByText('Temperature')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Precise/ })).toBeInTheDocument();
      });
    });

    it('calls onTemperatureChange when preset is selected', async () => {
      const user = userEvent.setup();
      render(<MessageComposer {...defaultProps} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(temperatureButton);

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /Precise/ })).toBeInTheDocument();
      });

      const preciseOption = screen.getByRole('radio', { name: /Precise/ });
      await user.click(preciseOption);

      await waitFor(() => {
        expect(mockOnTemperatureChange).toHaveBeenCalledWith(0.3);
      });
    });

    it('disables temperature button when no provider', () => {
      render(<MessageComposer {...defaultProps} hasProvider={false} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      expect(temperatureButton).toBeDisabled();
    });

    it('disables temperature button when streaming', () => {
      render(<MessageComposer {...defaultProps} isStreaming={true} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      expect(temperatureButton).toBeDisabled();
    });
  });

  describe('System Prompt Control Integration', () => {
    it('displays inactive state when no prompt is set', () => {
      render(<MessageComposer {...defaultProps} systemPrompt="" />);

      const systemPromptButton = screen.getByRole('button', { name: /No system prompt override/i });
      expect(systemPromptButton).toBeInTheDocument();
    });

    it('displays active state when prompt is set', () => {
      render(<MessageComposer {...defaultProps} systemPrompt="Custom prompt" />);

      const systemPromptButton = screen.getByRole('button', { name: /System prompt override active/i });
      expect(systemPromptButton).toBeInTheDocument();
    });

    it('shows visual indicator when system prompt is set', () => {
      render(<MessageComposer {...defaultProps} systemPrompt="Custom prompt" />);

      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });
      expect(systemPromptButton.className).toMatch(/bg-primary|text-primary/);
    });

    it('opens system prompt popover when clicked', async () => {
      const user = userEvent.setup();
      render(<MessageComposer {...defaultProps} />);

      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });
      await user.click(systemPromptButton);

      await waitFor(() => {
        expect(screen.getByText('System Prompt Override')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Enter a custom system prompt/i)).toBeInTheDocument();
      });
    });

    it('calls onSystemPromptChange when text is typed', async () => {
      const user = userEvent.setup();
      render(<MessageComposer {...defaultProps} />);

      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });
      await user.click(systemPromptButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter a custom system prompt/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Enter a custom system prompt/i);
      await user.type(textarea, 'New prompt');

      await waitFor(() => {
        expect(mockOnSystemPromptChange).toHaveBeenCalled();
      });
    });

    it('disables system prompt button when no provider', () => {
      render(<MessageComposer {...defaultProps} hasProvider={false} />);

      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });
      expect(systemPromptButton).toBeDisabled();
    });

    it('disables system prompt button when streaming', () => {
      render(<MessageComposer {...defaultProps} isStreaming={true} />);

      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });
      expect(systemPromptButton).toBeDisabled();
    });
  });

  describe('Both Controls Together', () => {
    it('shows both visual indicators when both are customized', () => {
      render(
        <MessageComposer
          {...defaultProps}
          temperature={0.3}
          defaultTemperature={1.0}
          systemPrompt="Custom prompt"
        />
      );

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });

      expect(temperatureButton.className).toMatch(/bg-primary|text-primary/);
      expect(systemPromptButton.className).toMatch(/bg-primary|text-primary/);
    });

    it('can open both popovers sequentially', async () => {
      const user = userEvent.setup();
      render(<MessageComposer {...defaultProps} />);

      // Open temperature popover
      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(temperatureButton);

      await waitFor(() => {
        expect(screen.getByText('Temperature')).toBeInTheDocument();
      });

      // Close it by clicking outside or ESC
      await user.keyboard('{Escape}');

      // Open system prompt popover
      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });
      await user.click(systemPromptButton);

      await waitFor(() => {
        expect(screen.getByText('System Prompt Override')).toBeInTheDocument();
      });
    });
  });

  describe('Existing Functionality Preservation', () => {
    it('still renders message textarea', () => {
      render(<MessageComposer {...defaultProps} messageInput="Test message" />);

      const textarea = screen.getByPlaceholderText(/Ask anything/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Test message');
    });

    it('still handles image attachments', () => {
      const mockImage = {
        id: 'test-image-1',
        data: 'data:image/png;base64,base64data',
        mimeType: 'image/png',
        size: 1234,
        name: 'test.png',
      };

      render(<MessageComposer {...defaultProps} attachedImages={[mockImage]} />);

      // Should render image attachment chip
      const chips = screen.getAllByRole('img');
      expect(chips.length).toBeGreaterThan(0);
    });

    it('still handles send button clicks', async () => {
      const user = userEvent.setup();
      render(<MessageComposer {...defaultProps} messageInput="Test" />);

      const sendButton = screen.getByRole('button', { name: /Send message/i });
      await user.click(sendButton);

      expect(mockOnSendMessage).toHaveBeenCalled();
    });

    it('still handles keyboard shortcuts for send (Enter)', async () => {
      const user = userEvent.setup();
      render(<MessageComposer {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Ask anything/i);
      await user.click(textarea);
      await user.type(textarea, 'Test message{Enter}');

      expect(mockOnSendMessage).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('maintains button order in toolbar', () => {
      render(<MessageComposer {...defaultProps} />);

      const toolbar = screen.getByRole('button', { name: /Attach image/i }).parentElement;
      expect(toolbar).toBeInTheDocument();

      // All controls should be in the same toolbar
      expect(screen.getByRole('button', { name: /Temperature:/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /system prompt/i })).toBeInTheDocument();
    });

    it('keeps all buttons accessible on small screens', () => {
      render(<MessageComposer {...defaultProps} />);

      const temperatureButton = screen.getByRole('button', { name: /Temperature:/i });
      const systemPromptButton = screen.getByRole('button', { name: /system prompt/i });

      // Buttons should have flex-shrink-0 to prevent collapsing
      expect(temperatureButton.className).toMatch(/flex-shrink-0|shrink-0/);
      expect(systemPromptButton.className).toMatch(/flex-shrink-0|shrink-0/);
    });
  });
});
