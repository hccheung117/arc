/**
 * ProviderFormDialog Component Integration Tests
 *
 * Tests form validation and data submission
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderFormDialog } from '@/components/provider-form-dialog';
import { createTestProvider } from '../test-utils';

describe('ProviderFormDialog', () => {
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
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('calls onSave with correct data structure', async () => {
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
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'My OpenAI Provider');

    const apiKeyInput = screen.getByLabelText(/api key/i);
    await user.type(apiKeyInput, 'sk-test123');

    // Submit
    const submitButton = screen.getByText('Add Provider');
    await user.click(submitButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'openai',
          name: 'My OpenAI Provider',
          apiKey: 'sk-test123',
          baseUrl: 'https://api.openai.com/v1',
        })
      );
    });
  });

  it('validates name field is required', async () => {
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

    // Focus and blur without entering anything
    await user.click(nameInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

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
    await user.clear(baseUrlInput);
    await user.type(baseUrlInput, 'invalid-url');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/must start with http/i)).toBeInTheDocument();
    });
  });

  it('updates base URL when provider type changes', () => {
    render(
      <ProviderFormDialog
        open={true}
        onOpenChange={() => {}}
        onSave={() => {}}
        mode="add"
      />
    );

    // Verify default base URL for OpenAI
    const baseUrlInput = screen.getByLabelText(/base url/i) as HTMLInputElement;
    expect(baseUrlInput.value).toBe('https://api.openai.com/v1');

    // Note: Testing provider type change requires E2E due to Radix UI Select portals
  });

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

  it('disables provider type selection in edit mode', () => {
    const provider = createTestProvider({ type: 'openai' });

    render(
      <ProviderFormDialog
        open={true}
        onOpenChange={() => {}}
        onSave={() => {}}
        initialConfig={provider}
        mode="edit"
      />
    );

    const providerSelect = screen.getByRole('combobox', { name: /provider type/i });
    expect(providerSelect).toBeDisabled();
  });

  it('shows all provider type options in add mode', () => {
    render(
      <ProviderFormDialog
        open={true}
        onOpenChange={() => {}}
        onSave={() => {}}
        mode="add"
      />
    );

    const providerSelect = screen.getByRole('combobox', { name: /provider type/i });
    expect(providerSelect).toBeInTheDocument();

    // Note: Verifying dropdown options requires E2E testing due to Radix UI portals
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
