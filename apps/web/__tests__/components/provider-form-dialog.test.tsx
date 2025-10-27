/**
 * ProviderFormDialog Component Integration Tests (Auto-Detection)
 *
 * Tests form validation and auto-detection flow
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderFormDialog } from '@/components/provider-form-dialog';
import { createTestProvider } from '../test-utils';

describe('ProviderFormDialog (Auto-Detection)', () => {
  describe('Rendering', () => {
    it('renders add mode correctly', () => {
      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
        />
      );

      expect(screen.getByText('Add AI Provider')).toBeInTheDocument();
      expect(screen.getByText('Enter your API credentials. The provider type will be detected automatically.')).toBeInTheDocument();
      expect(screen.getByText('Add Provider')).toBeInTheDocument();
    });

    it('renders edit mode correctly', () => {
      const provider = createTestProvider({ name: 'My Provider' });

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          initialConfig={provider}
          mode="edit"
        />
      );

      expect(screen.getByText('Edit Provider')).toBeInTheDocument();
      expect(screen.getByText('Update your provider credentials. API keys are stored locally.')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('shows auto-detection hint in add mode', () => {
      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
        />
      );

      expect(screen.getByText('A name will be generated based on the detected provider type')).toBeInTheDocument();
    });

    it('does not show provider type dropdown', () => {
      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
        />
      );

      expect(screen.queryByText('Provider Type')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('Auto-Detection Flow', () => {
    it('passes type="auto" when adding a new provider', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn();

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={handleSave}
          mode="add"
        />
      );

      // Fill in the form
      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, 'sk-test123');

      // Submit
      const submitButton = screen.getByText('Add Provider');
      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'auto',
            apiKey: 'sk-test123',
          })
        );
      });
    });

    it('does not pass type when editing an existing provider', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn();
      const provider = createTestProvider({
        name: 'OpenAI',
        type: 'openai',
        apiKey: 'sk-old',
      });

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={handleSave}
          initialConfig={provider}
          mode="edit"
        />
      );

      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.clear(apiKeyInput);
      await user.type(apiKeyInput, 'sk-new123');

      const submitButton = screen.getByText('Save Changes');
      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.not.objectContaining({
            type: expect.anything(),
          })
        );
      });
    });

    it('uses default name when name field is empty in add mode', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn();

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={handleSave}
          mode="add"
        />
      );

      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, 'sk-test123');

      const submitButton = screen.getByText('Add Provider');
      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'AI Provider',
          })
        );
      });
    });

    it('uses custom name when provided', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn();

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={handleSave}
          mode="add"
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'My Custom Provider');

      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, 'sk-test123');

      const submitButton = screen.getByText('Add Provider');
      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'My Custom Provider',
          })
        );
      });
    });

    it('includes baseUrl when provided', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn();

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={handleSave}
          mode="add"
        />
      );

      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, 'sk-test123');

      const baseUrlInput = screen.getByLabelText(/base url/i);
      await user.type(baseUrlInput, 'https://custom-proxy.com');

      const submitButton = screen.getByText('Add Provider');
      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            baseUrl: 'https://custom-proxy.com',
          })
        );
      });
    });
  });

  describe('Validation', () => {
    it('validates base URL format', async () => {
      const user = userEvent.setup();

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
        />
      );

      const baseUrlInput = screen.getByLabelText(/base url/i);
      await user.type(baseUrlInput, 'invalid-url');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/must start with http/i)).toBeInTheDocument();
      });
    });

    it('trims whitespace from inputs before saving', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn();

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={handleSave}
          mode="add"
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, '  Test Provider  ');

      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, '  sk-test123  ');

      const submitButton = screen.getByText('Add Provider');
      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Provider',
            apiKey: 'sk-test123',
          })
        );
      });
    });
  });

  describe('Form State', () => {
    it('loads initial config in edit mode', () => {
      const provider = createTestProvider({
        name: 'My Provider',
        type: 'anthropic',
        apiKey: 'sk-test',
        baseUrl: 'https://custom.url',
      });

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          initialConfig={provider}
          mode="edit"
        />
      );

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('My Provider');

      const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
      expect(apiKeyInput.value).toBe('sk-test');

      const baseUrlInput = screen.getByLabelText(/base url/i) as HTMLInputElement;
      expect(baseUrlInput.value).toBe('https://custom.url');
    });

    it('calls onOpenChange when cancel clicked', async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={handleOpenChange}
          onSave={() => {}}
          mode="add"
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('resets form when dialog reopens', async () => {
      const { rerender } = render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
        />
      );

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      const user = userEvent.setup();
      await user.type(nameInput, 'Test');

      // Close and reopen
      rerender(
        <ProviderFormDialog
          open={false}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
        />
      );

      rerender(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
        />
      );

      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('');
    });
  });

  describe('Loading State', () => {
    it('disables buttons when saving', () => {
      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
          isSaving={true}
        />
      );

      expect(screen.getByText('Cancel')).toBeDisabled();
      expect(screen.getByText('Add Provider')).toBeDisabled();
    });

    it('shows loading spinner when saving', () => {
      render(
        <ProviderFormDialog
          open={true}
          onOpenChange={() => {}}
          onSave={() => {}}
          mode="add"
          isSaving={true}
        />
      );

      // Loader2 component should be rendered
      const button = screen.getByText('Add Provider').closest('button');
      expect(button?.querySelector('svg')).toBeInTheDocument();
    });
  });
});
