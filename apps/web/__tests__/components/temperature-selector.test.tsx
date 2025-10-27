/**
 * TemperatureSelector Component Tests
 *
 * Tests the temperature selector with preset levels and advanced slider mode
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemperatureSelector } from '@/components/temperature-selector';

describe('TemperatureSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Preset Mode', () => {
    it('renders three preset options', () => {
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      expect(screen.getByRole('radio', { name: /Precise/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Balanced/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Creative/ })).toBeInTheDocument();
    });

    it('selects Balanced preset by default when value is 1.0', () => {
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const balancedOption = screen.getByRole('radio', { name: /Balanced/ });
      expect(balancedOption).toBeChecked();
    });

    it('selects Precise preset when value is 0.3', () => {
      render(<TemperatureSelector value={0.3} onChange={mockOnChange} />);

      const preciseOption = screen.getByRole('radio', { name: /Precise/ });
      expect(preciseOption).toBeChecked();
    });

    it('selects Creative preset when value is 1.7', () => {
      render(<TemperatureSelector value={1.7} onChange={mockOnChange} />);

      const creativeOption = screen.getByRole('radio', { name: /Creative/ });
      expect(creativeOption).toBeChecked();
    });

    it('selects closest preset when value is between presets', () => {
      render(<TemperatureSelector value={0.65} onChange={mockOnChange} />);

      // 0.65 is closest to Balanced (1.0)
      const balancedOption = screen.getByRole('radio', { name: /Balanced/ });
      expect(balancedOption).toBeChecked();
    });

    it('calls onChange with correct value when Precise is selected', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const preciseOption = screen.getByRole('radio', { name: /Precise/ });
      await user.click(preciseOption);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(0.3);
      });
    });

    it('calls onChange with correct value when Creative is selected', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const creativeOption = screen.getByRole('radio', { name: /Creative/ });
      await user.click(creativeOption);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(1.7);
      });
    });

    it('shows description text by default', () => {
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      expect(
        screen.getByText(/Controls randomness. Lower is more focused, higher is more creative./)
      ).toBeInTheDocument();
    });

    it('hides description when showDescription is false', () => {
      render(
        <TemperatureSelector
          value={1.0}
          onChange={mockOnChange}
          showDescription={false}
        />
      );

      expect(
        screen.queryByText(/Controls randomness/)
      ).not.toBeInTheDocument();
    });
  });

  describe('Advanced Mode Toggle', () => {
    it('shows Advanced button by default', () => {
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument();
    });

    it('switches to slider mode when Advanced is clicked', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
    });

    it('hides presets when in advanced mode', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.queryByRole('radio', { name: /Precise/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: /Balanced/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: /Creative/ })).not.toBeInTheDocument();
      });
    });

    it('shows Simple button in advanced mode', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /simple/i })).toBeInTheDocument();
      });
    });

    it('switches back to presets when Simple is clicked', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      // Go to advanced mode
      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });

      // Go back to simple mode
      const simpleButton = screen.getByRole('button', { name: /simple/i });
      await user.click(simpleButton);

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /Balanced/ })).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Slider Mode', () => {
    it('displays current temperature value', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.5} onChange={mockOnChange} />);

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByText('1.5')).toBeInTheDocument();
      });
    });

    it('shows advanced mode description', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Fine-tune the temperature value from 0 \(deterministic\) to 2/)
        ).toBeInTheDocument();
      });
    });

    it('hides advanced description when showDescription is false', async () => {
      const user = userEvent.setup();
      render(
        <TemperatureSelector
          value={1.0}
          onChange={mockOnChange}
          showDescription={false}
        />
      );

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.queryByText(/Fine-tune/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Label Control', () => {
    it('shows label by default', () => {
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      expect(screen.getByText('Temperature')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(
        <TemperatureSelector
          value={1.0}
          onChange={mockOnChange}
          showLabel={false}
        />
      );

      expect(screen.queryByText('Temperature')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses custom id when provided', () => {
      render(
        <TemperatureSelector
          value={1.0}
          onChange={mockOnChange}
          id="custom-temp"
        />
      );

      const preciseOption = screen.getByRole('radio', { name: /Precise/ });
      expect(preciseOption).toHaveAttribute('id', 'custom-temp-precise');
    });

    it('provides accessible labels for presets', () => {
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      // All presets should have accessible labels
      expect(screen.getByRole('radio', { name: /Precise/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Balanced/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Creative/ })).toBeInTheDocument();
    });

    it('provides accessible slider in advanced mode', async () => {
      const user = userEvent.setup();
      render(<TemperatureSelector value={1.0} onChange={mockOnChange} />);

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      await waitFor(() => {
        // Slider should be accessible with proper labeling via container
        const slider = screen.getByRole('slider');
        expect(slider).toBeInTheDocument();
        // Container has aria-label which provides accessible name
        expect(slider.closest('[aria-label]')).toHaveAttribute('aria-label', 'Temperature');
      });
    });
  });
});
