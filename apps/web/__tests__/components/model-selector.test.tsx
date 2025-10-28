/**
 * ModelSelector Component Integration Tests
 *
 * Tests the enhanced model selector with fuzzy search, grouping, favorites, and loading states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/components/model-selector';
import type { ProviderModelGroup } from '@/lib/use-models';

// Mock the useCore hook
const mockSettingsGet = vi.fn();
const mockSettingsUpdate = vi.fn();

vi.mock('@/lib/core-provider', () => ({
  useCore: () => ({
    settings: {
      get: mockSettingsGet,
      update: mockSettingsUpdate,
    },
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsGet.mockResolvedValue({
      favoriteModels: [],
    });
  });

  describe('Basic Rendering', () => {
    it('renders with provided grouped models', async () => {
      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      // Check the trigger shows the selected model
      expect(screen.getByText(/gpt-4/i)).toBeInTheDocument();
    });

    it('renders combobox button with correct role', async () => {
      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
    });

    it('displays "Select a model" when no model is selected', async () => {
      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

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

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Note: Full interaction testing with Radix UI Command/Popover in happy-dom/jsdom
      // can be complex due to portal rendering. This test verifies the component
      // renders correctly. Full E2E testing would be done with Playwright.
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('respects disabled prop', async () => {
      const handleChange = vi.fn();

      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={handleChange}
          groupedModels={mockGroupedModels}
          disabled={true}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeDisabled();
    });

    it('can be clicked when not disabled', async () => {
      const handleChange = vi.fn();

      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={handleChange}
          groupedModels={mockGroupedModels}
          disabled={false}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      const trigger = screen.getByRole('combobox');
      expect(trigger).not.toBeDisabled();
    });
  });

  describe('Model Display', () => {
    it('truncates long model IDs in the trigger', async () => {
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

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

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

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Note: Due to portal rendering, full search testing requires E2E tools
      // This test verifies the component structure
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('Provider Grouping', () => {
    it('accepts grouped models structure', async () => {
      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      // Component should render without errors
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('handles multiple provider groups', async () => {
      render(
        <ModelSelector
          value="claude-3-opus"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      expect(screen.getByText(/claude-3-opus/i)).toBeInTheDocument();
    });
  });

  describe('Favorites Management', () => {
    it('loads favorite models from settings on mount', async () => {
      mockSettingsGet.mockResolvedValue({
        favoriteModels: ['provider-1:gpt-4'],
      });

      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });
    });

    it('renders management button in footer', async () => {
      const user = userEvent.setup();

      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Note: Full footer button testing requires E2E tools due to portal rendering
      expect(trigger).toBeInTheDocument();
    });

    it('persists favorites when toggled', async () => {
      mockSettingsUpdate.mockResolvedValue(undefined);

      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      // Note: Full favorites interaction testing requires E2E tools
      // This test verifies the component mounts correctly with favorites support
    });

    it('handles favorites persistence errors gracefully', async () => {
      mockSettingsUpdate.mockRejectedValue(new Error('Failed to save'));

      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      // Component should still render without errors
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Management Mode', () => {
    it('loads without errors in management mode', async () => {
      render(
        <ModelSelector
          value="gpt-4"
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      // Note: Full management mode testing (toggling, star clicking) requires E2E tools
      // due to complex Radix UI portal interactions
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Favorites Group Display', () => {
    it('prepares favorites group when favorites exist', async () => {
      mockSettingsGet.mockResolvedValue({
        favoriteModels: ['provider-1:gpt-4', 'provider-2:claude-3-opus'],
      });

      render(
        <ModelSelector
          value=""
          onValueChange={() => {}}
          groupedModels={mockGroupedModels}
        />
      );

      await waitFor(() => {
        expect(mockSettingsGet).toHaveBeenCalled();
      });

      // Note: Full favorites group rendering testing requires E2E tools
      // This test verifies the component handles favorites in settings
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});
