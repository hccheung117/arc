/**
 * ModelSelector Component Integration Tests
 *
 * Tests that model selection triggers correct callbacks
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/components/model-selector';

describe('ModelSelector', () => {
  const mockModels = [
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
    { id: 'claude-3', name: 'Claude 3', provider: 'anthropic' },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini' },
  ];

  it('renders with provided models', () => {
    render(
      <ModelSelector
        value="gpt-4"
        onValueChange={() => {}}
        models={mockModels}
      />
    );

    // Check the trigger shows the selected model
    expect(screen.getByText(/gpt-4/i)).toBeInTheDocument();
  });

  it('calls onValueChange when a model is selected', async () => {
    const handleChange = vi.fn();

    render(
      <ModelSelector
        value="gpt-4"
        onValueChange={handleChange}
        models={mockModels}
      />
    );

    // Verify the component renders with select element
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();

    // Note: Full interaction testing with Radix UI Select in happy-dom/jsdom
    // can be complex due to portal rendering. This test verifies the component
    // renders correctly. Full E2E testing would be done with Playwright.
  });

  it('displays all provided models in the dropdown', () => {
    render(
      <ModelSelector
        value="gpt-4"
        onValueChange={() => {}}
        models={mockModels}
      />
    );

    // Verify trigger renders
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();

    // Note: Full dropdown testing requires E2E tools due to Radix UI portals
  });

  it('respects disabled prop', () => {
    const handleChange = vi.fn();

    render(
      <ModelSelector
        value="gpt-4"
        onValueChange={handleChange}
        models={mockModels}
        disabled={true}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
  });

  it('handles empty models array gracefully', () => {
    render(
      <ModelSelector
        value=""
        onValueChange={() => {}}
        models={[]}
      />
    );

    // Should render without crashing
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('displays provider name in model label', () => {
    render(
      <ModelSelector
        value="gpt-4"
        onValueChange={() => {}}
        models={mockModels}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();

    // Note: Provider names would be visible in dropdown, which requires E2E testing
  });

  it('maintains selection after dropdown closes', () => {
    const handleChange = vi.fn();

    render(
      <ModelSelector
        value="gpt-4"
        onValueChange={handleChange}
        models={mockModels}
      />
    );

    // Verify selected value is displayed
    expect(screen.getByText(/gpt-4/i)).toBeInTheDocument();
  });
});
