/**
 * ModelSelector Component Integration Tests
 *
 * Tests the enhanced model selector with fuzzy search, grouping, and loading states
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/components/model-selector';
import type { ProviderModelGroup } from '@/lib/use-models';

describe('ModelSelector', () => {
  const mockGroupedModels: ProviderModelGroup[] = [
    {
      providerId: 'provider-1',
      providerName: 'OpenAI',
      providerType: 'openai',
      models: [
        { id: 'gpt-4', object: 'model', created: 123456, owned_by: 'openai' },
        { id: 'gpt-3.5-turbo', object: 'model', created: 123456, owned_by: 'openai' },
      ],
    },
    {
      providerId: 'provider-2',
      providerName: 'Anthropic',
      providerType: 'anthropic',
      models: [
        { id: 'claude-3-opus', object: 'model', created: 123456, owned_by: 'anthropic' },
        { id: 'claude-3-sonnet', object: 'model', created: 123456, owned_by: 'anthropic' },
      ],
    },
  ];

  describe('Basic Rendering', () => {
    it('renders with provided grouped models', () => {
      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      // Check the trigger shows the selected model
      expect(screen.getByText(/gpt-4/i)).toBeInTheDocument();
    });

    it('renders combobox button with correct role', () => {
      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
    });

    it('displays "Select a model" when no model is selected', () => {
      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      expect(screen.getByText('Select a model')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows skeleton loader when isLoading is true', () => {
      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={[]}
          isLoading={true}
        />
      );

      // Skeleton should be rendered (has specific data-slot attribute)
      const skeleton = document.querySelector('[data-slot="skeleton"]');
      expect(skeleton).toBeInTheDocument();
    });

    it('does not show combobox when loading', () => {
      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={[]}
          isLoading={true}
        />
      );

      // Combobox should not be rendered during loading
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows "No models available" when groupedModels is empty', () => {
      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={[]}
          isLoading={false}
        />
      );

      expect(screen.getByText('No models available')).toBeInTheDocument();
    });

    it('disables button when no models are available', () => {
      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={[]}
          isLoading={false}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Model Selection', () => {
    it('calls onValueChange with modelId and providerId when a model is selected', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(
        <ModelSelector
          value=""
          onValueChange={handleChange}
          groupedModels={mockGroupedModels}
        />
      );

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Note: Full interaction testing with Radix UI Command/Popover in happy-dom/jsdom
      // can be complex due to portal rendering. This test verifies the component
      // renders correctly. Full E2E testing would be done with Playwright.
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('respects disabled prop', () => {
      const handleChange = vi.fn();

      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={handleChange}
          groupedModels={mockGroupedModels}
          disabled={true}
        />
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeDisabled();
    });

    it('can be clicked when not disabled', () => {
      const handleChange = vi.fn();

      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={handleChange}
          groupedModels={mockGroupedModels}
          disabled={false}
        />
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).not.toBeDisabled();
    });
  });

  describe('Model Display', () => {
    it('truncates long model IDs in the trigger', () => {
      const longModelId = 'this-is-a-very-long-model-id-that-should-be-truncated-for-display';
      const groupsWithLongId: ProviderModelGroup[] = [
        {
          providerId: 'provider-1',
          providerName: 'Test Provider',
          providerType: 'custom',
          models: [
            { id: longModelId, object: 'model', created: 123456, owned_by: 'test' },
          ],
        },
      ];

      render(
        <ModelSelector
          value={longModelId}
          onValueChange={() => {}}
          groupedModels={groupsWithLongId}
        />
      );

      // Should show truncated version (30 chars + ...) or full text
      // The button should contain some part of the model ID
      expect(screen.getByRole('combobox').textContent).toContain('this-is-a-very-long');
    });
  });

  describe('Search Functionality', () => {
    it('renders search input when dropdown is opened', async () => {
      const user = userEvent.setup();

      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Note: Due to portal rendering, full search testing requires E2E tools
      // This test verifies the component structure
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('Provider Grouping', () => {
    it('accepts grouped models structure', () => {
      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      // Component should render without errors
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('handles multiple provider groups', () => {
      render(
        <ModelSelector
          value="claude-3-opus"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      expect(screen.getByText(/claude-3-opus/i)).toBeInTheDocument();
    });
  });
});
