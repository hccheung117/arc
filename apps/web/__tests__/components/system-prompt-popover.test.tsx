/**
 * SystemPromptPopover Component Tests
 *
 * Tests the system prompt popover with visual indicators and textarea
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SystemPromptPopover } from '@/components/system-prompt-popover';

describe('SystemPromptPopover', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Popover Button', () => {
    it('renders the system prompt button', () => {
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /No system prompt override/i });
      expect(button).toBeInTheDocument();
    });

    it('shows active state aria-label when prompt is set', () => {
      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /System prompt override active/i });
      expect(button).toBeInTheDocument();
    });

    it('can be disabled', () => {
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Visual Indicators', () => {
    it('shows visual indicator when system prompt is set', () => {
      render(
        <SystemPromptPopover
          value="Custom system prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      // Check for primary color classes indicating active state
      expect(button.className).toMatch(/bg-primary|text-primary/);
    });

    it('does not show visual indicator when system prompt is empty', () => {
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      // Should not have primary color classes when empty
      expect(button.className).not.toMatch(/bg-primary\/10/);
    });

    it('shows "Custom prompt active" in tooltip when prompt is set', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText(/Custom prompt active/)).toBeInTheDocument();
      });
    });

    it('shows "No override set" in tooltip when prompt is empty', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText(/No override set/)).toBeInTheDocument();
      });
    });
  });

  describe('Popover Content', () => {
    it('opens popover when button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('System Prompt Override')).toBeInTheDocument();
        expect(screen.getByText(/Customize the AI's behavior for this chat/)).toBeInTheDocument();
      });
    });

    it('renders textarea inside popover', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/Enter a custom system prompt/i);
        expect(textarea).toBeInTheDocument();
      });
    });

    it('displays current value in textarea', async () => {
      const user = userEvent.setup();
      const customPrompt = "You are a helpful assistant";

      render(
        <SystemPromptPopover
          value={customPrompt}
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/Enter a custom system prompt/i);
        expect(textarea).toHaveValue(customPrompt);
      });
    });

    it('shows character count when prompt is set', async () => {
      const user = userEvent.setup();
      const customPrompt = "Test prompt";

      render(
        <SystemPromptPopover
          value={customPrompt}
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(`${customPrompt.length} characters`)).toBeInTheDocument();
      });
    });

    it('shows "No custom prompt" when empty', async () => {
      const user = userEvent.setup();

      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/No custom prompt/)).toBeInTheDocument();
      });
    });

    it('shows clear button in header when prompt is set', async () => {
      const user = userEvent.setup();

      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /Clear system prompt/i });
        expect(clearButton).toBeInTheDocument();
      });
    });

    it('shows clear button in footer when prompt is set', async () => {
      const user = userEvent.setup();

      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        const clearButtons = screen.getAllByRole('button', { name: /Clear/i });
        expect(clearButtons.length).toBeGreaterThan(0);
      });
    });

    it('shows helper text when prompt is empty', async () => {
      const user = userEvent.setup();

      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Leave empty to use the default system prompt/)).toBeInTheDocument();
      });
    });
  });

  describe('Prompt Changes', () => {
    it('calls onChange when text is typed', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter a custom system prompt/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/Enter a custom system prompt/i);
      await user.type(textarea, 'New prompt');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('clears prompt when header clear button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear system prompt/i })).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /Clear system prompt/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('');
      });
    });

    it('clears prompt when footer clear button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        const clearButtons = screen.getAllByRole('button', { name: /Clear/i });
        expect(clearButtons.length).toBeGreaterThan(0);
      });

      // Click the footer clear button (should be the last one)
      const clearButtons = screen.getAllByRole('button', { name: /Clear/i });
      const footerClearButton = clearButtons[clearButtons.length - 1];
      if (footerClearButton) {
        await user.click(footerClearButton);

        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith('');
        });
      }
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on button when empty', () => {
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /No system prompt override/i });
      expect(button).toHaveAttribute('aria-label');
    });

    it('has proper aria-label on button when set', () => {
      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /System prompt override active/i });
      expect(button).toHaveAttribute('aria-label');
    });

    it('textarea is accessible', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value=""
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/Enter a custom system prompt/i);
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe('TEXTAREA');
      });
    });

    it('clear button has accessible label', async () => {
      const user = userEvent.setup();
      render(
        <SystemPromptPopover
          value="Custom prompt"
          onChange={mockOnChange}
        />
      );

      const button = screen.getByRole('button', { name: /system prompt/i });
      await user.click(button);

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /Clear system prompt/i });
        expect(clearButton).toHaveAttribute('aria-label');
      });
    });
  });
});
