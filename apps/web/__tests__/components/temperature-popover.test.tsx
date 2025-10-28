/**
 * TemperaturePopover Component Tests
 *
 * Tests the temperature popover with visual indicators and integration with TemperatureSelector
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemperaturePopover } from '@/components/temperature-popover';

describe('TemperaturePopover', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Popover Button', () => {
    it('renders the temperature button', () => {
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature: Balanced/i });
      expect(button).toBeInTheDocument();
    });

    it('shows correct preset label in tooltip for Precise (0.3)', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={0.3}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature: Precise/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText(/Temperature:/)).toBeInTheDocument();
        expect(screen.getByText(/Precise/)).toBeInTheDocument();
      });
    });

    it('shows correct preset label in tooltip for Balanced (1.0)', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature: Balanced/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText(/Balanced/)).toBeInTheDocument();
      });
    });

    it('shows correct preset label in tooltip for Creative (1.7)', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.7}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature: Creative/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText(/Creative/)).toBeInTheDocument();
      });
    });

    it('shows exact value for custom temperature', async () => {
      render(
        <TemperaturePopover
          value={0.8}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature: 0.8/i });
      expect(button).toBeInTheDocument();
    });

    it('can be disabled', () => {
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
          disabled={true}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Visual Indicators', () => {
    it('shows visual indicator when temperature differs from default', () => {
      render(
        <TemperaturePopover
          value={0.3}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      // Check for primary color classes indicating non-default state
      expect(button.className).toMatch(/bg-primary|text-primary/);
    });

    it('does not show visual indicator when temperature equals default', () => {
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      // Should not have primary color classes when at default
      expect(button.className).not.toMatch(/bg-primary\/10/);
    });

    it('shows "Custom value set" in tooltip when non-default', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={0.3}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText(/Custom value set/)).toBeInTheDocument();
      });
    });

    it('shows "Using default" in tooltip when at default', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText(/Using default/)).toBeInTheDocument();
      });
    });
  });

  describe('Popover Content', () => {
    it('opens popover when button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Temperature')).toBeInTheDocument();
        expect(screen.getByText(/Control the randomness of AI responses/)).toBeInTheDocument();
      });
    });

    it('renders TemperatureSelector inside popover', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(button);

      await waitFor(() => {
        // TemperatureSelector presets should be visible
        expect(screen.getByRole('radio', { name: /Precise/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Balanced/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Creative/ })).toBeInTheDocument();
      });
    });

    it('shows reset button when value differs from default', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={0.3}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Reset to Default \(1.0\)/i })).toBeInTheDocument();
      });
    });

    it('does not show reset button when at default value', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Reset to Default/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Temperature Changes', () => {
    it('calls onChange when preset is selected', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /Precise/ })).toBeInTheDocument();
      });

      const preciseOption = screen.getByRole('radio', { name: /Precise/ });
      await user.click(preciseOption);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(0.3);
      });
    });

    it('resets to default when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={0.3}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Reset to Default/i })).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /Reset to Default \(1.0\)/i });
      await user.click(resetButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(1.0);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on button', () => {
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature: Balanced/i });
      expect(button).toHaveAttribute('aria-label');
    });

    it('popover content is accessible', async () => {
      const user = userEvent.setup();
      render(
        <TemperaturePopover
          value={1.0}
          onChange={mockOnChange}
          defaultValue={1.0}
        />
      );

      const button = screen.getByRole('button', { name: /Temperature:/i });
      await user.click(button);

      await waitFor(() => {
        // Title should be accessible
        expect(screen.getByText('Temperature')).toBeInTheDocument();
        // Radio buttons should be accessible
        expect(screen.getByRole('radio', { name: /Precise/ })).toBeInTheDocument();
      });
    });
  });
});
