/**
 * ModelBadge Component Unit Tests
 *
 * Tests the model badge component in isolation with various data scenarios
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelBadge } from '@/components/model-badge';
import type { ProviderConfig } from '@arc/core/core.js';

const mockProviders: ProviderConfig[] = [
  {
    id: 'provider-1',
    type: 'openai',
    name: 'OpenAI GPT-4',
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'provider-2',
    type: 'anthropic',
    name: 'Anthropic Claude',
    apiKey: 'test-key-2',
    baseUrl: 'https://api.anthropic.com',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe('ModelBadge', () => {
  it('renders with valid model and provider', () => {
    render(
      <ModelBadge
        model="gpt-4"
        providerConnectionId="provider-1"
        providers={mockProviders}
      />
    );

    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('shows "Unknown Model" when model is undefined', () => {
    render(
      <ModelBadge
        providerConnectionId="provider-1"
        providers={mockProviders}
      />
    );

    expect(screen.getByText('Unknown Model')).toBeInTheDocument();
  });

  it('resolves provider name correctly', async () => {
    const user = userEvent.setup();

    render(
      <ModelBadge
        model="claude-3-opus"
        providerConnectionId="provider-2"
        providers={mockProviders}
      />
    );

    const badge = screen.getByText('claude-3-opus');

    // Hover over badge to show tooltip
    await user.hover(badge);

    // Tooltip should show provider name (multiple instances due to accessibility)
    const providerTexts = await screen.findAllByText(/Anthropic Claude/);
    expect(providerTexts.length).toBeGreaterThan(0);
  });

  it('shows "Deleted Provider" when provider is not found in list', async () => {
    const user = userEvent.setup();

    render(
      <ModelBadge
        model="gpt-4"
        providerConnectionId="non-existent-provider"
        providers={mockProviders}
      />
    );

    const badge = screen.getByText('gpt-4');
    await user.hover(badge);

    // Should show "Deleted Provider" in tooltip (provider ID exists but not in list)
    const providerTexts = await screen.findAllByText(/Deleted Provider/);
    expect(providerTexts.length).toBeGreaterThan(0);
  });

  it('shows "Deleted Provider" warning when provider has been deleted', async () => {
    const user = userEvent.setup();

    render(
      <ModelBadge
        model="gpt-4"
        providerConnectionId="deleted-provider-id"
        providers={mockProviders}
      />
    );

    const badge = screen.getByText('gpt-4');
    await user.hover(badge);

    // Should show deletion warning (multiple instances)
    const warnings = await screen.findAllByText(/This provider configuration has been deleted/);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('shows "Unknown Provider" when providerConnectionId is undefined', async () => {
    const user = userEvent.setup();

    render(
      <ModelBadge
        model="gpt-4"
        providers={mockProviders}
      />
    );

    const badge = screen.getByText('gpt-4');
    await user.hover(badge);

    const providerTexts = await screen.findAllByText(/Unknown Provider/);
    expect(providerTexts.length).toBeGreaterThan(0);
  });

  it('displays both model and provider in tooltip', async () => {
    const user = userEvent.setup();

    render(
      <ModelBadge
        model="gpt-4-turbo"
        providerConnectionId="provider-1"
        providers={mockProviders}
      />
    );

    const badge = screen.getByText('gpt-4-turbo');
    await user.hover(badge);

    // Check tooltip contains both model and provider info (multiple instances)
    const modelLabels = await screen.findAllByText(/Model:/);
    expect(modelLabels.length).toBeGreaterThan(0);

    const providerLabels = await screen.findAllByText(/Provider:/);
    expect(providerLabels.length).toBeGreaterThan(0);

    const providerNames = await screen.findAllByText(/OpenAI GPT-4/);
    expect(providerNames.length).toBeGreaterThan(0);
  });

  it('renders with empty providers array', () => {
    render(
      <ModelBadge
        model="gpt-4"
        providerConnectionId="provider-1"
        providers={[]}
      />
    );

    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('has appropriate styling for badge', () => {
    const { container } = render(
      <ModelBadge
        model="gpt-4"
        providerConnectionId="provider-1"
        providers={mockProviders}
      />
    );

    // Check that badge has the outline variant class
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('cursor-help');
  });
});
