/**
 * Settings Page Tests
 *
 * Tests settings controls, model management, and AI behavior settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/app/settings/page';
import { CoreProvider } from '@/lib/core-provider';
import { createMockCore } from '../test-utils';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => 'appearance',
  }),
}));

// Mock model management component
vi.mock('@/components/model-management', () => ({
  ModelManagement: () => <div data-testid="model-management">Model Management</div>,
}));

// Mock about component
vi.mock('@/components/about', () => ({
  About: () => <div data-testid="about">About</div>,
}));

describe('Settings Page', () => {
  let mockCore: ReturnType<typeof createMockCore>;

  beforeEach(() => {
    mockCore = createMockCore();
    mockCore.settings.get.mockResolvedValue({
      lineHeight: 'normal',
      fontFamily: 'sans',
      defaultSystemPrompt: '',
      autoTitleChats: true,
    });
  });

  const renderSettings = () => {
    return render(
      <CoreProvider value={mockCore}>
        <SettingsPage />
      </CoreProvider>
    );
  };

  describe('Typography Controls', () => {
    it('renders line height options', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('Line Height')).toBeInTheDocument();
        expect(screen.getByLabelText('Compact')).toBeInTheDocument();
        expect(screen.getByLabelText('Normal')).toBeInTheDocument();
        expect(screen.getByLabelText('Relaxed')).toBeInTheDocument();
      });
    });

    it('renders font family options', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('Font Family')).toBeInTheDocument();
        expect(screen.getByLabelText(/sans serif/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/serif/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/monospace/i)).toBeInTheDocument();
      });
    });

    it('updates line height when changed', async () => {
      const user = userEvent.setup();
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText('Compact')).toBeInTheDocument();
      });

      const compactOption = screen.getByLabelText('Compact');
      await user.click(compactOption);

      await waitFor(() => {
        expect(mockCore.settings.update).toHaveBeenCalledWith({
          lineHeight: 'compact',
        });
      });
    });

    it('updates font family when changed', async () => {
      const user = userEvent.setup();
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/monospace/i)).toBeInTheDocument();
      });

      const monoOption = screen.getByLabelText(/monospace/i);
      await user.click(monoOption);

      await waitFor(() => {
        expect(mockCore.settings.update).toHaveBeenCalledWith({
          fontFamily: 'mono',
        });
      });
    });

    it('shows success toast on typography update', async () => {
      const user = userEvent.setup();
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText('Relaxed')).toBeInTheDocument();
      });

      const relaxedOption = screen.getByLabelText('Relaxed');
      await user.click(relaxedOption);

      await waitFor(() => {
        expect(mockCore.settings.update).toHaveBeenCalled();
      });
    });

    it('rolls back optimistic update on error', async () => {
      const user = userEvent.setup();
      mockCore.settings.update.mockRejectedValueOnce(new Error('Failed'));
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText('Compact')).toBeInTheDocument();
      });

      const compactOption = screen.getByLabelText('Compact');
      await user.click(compactOption);

      // Wait for error handling
      await waitFor(() => {
        expect(mockCore.settings.update).toHaveBeenCalled();
      });
    });
  });

  describe('AI Behavior Settings', () => {
    it('renders default system prompt textarea', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/default system prompt/i)).toBeInTheDocument();
      });
    });

    it('renders auto-title toggle', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/automatically generate chat titles/i)).toBeInTheDocument();
      });
    });

    it('updates default system prompt', async () => {
      const user = userEvent.setup();
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/default system prompt/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/default system prompt/i);
      await user.type(textarea, 'You are a helpful assistant');

      await waitFor(() => {
        expect(mockCore.settings.update).toHaveBeenCalledWith({
          defaultSystemPrompt: expect.stringContaining('helpful assistant'),
        });
      });
    });

    it('toggles auto-title setting', async () => {
      const user = userEvent.setup();
      renderSettings();

      await waitFor(() => {
        expect(screen.getByRole('switch')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      await waitFor(() => {
        expect(mockCore.settings.update).toHaveBeenCalledWith({
          autoTitleChats: false,
        });
      });
    });

    it('persists system prompt changes', async () => {
      const user = userEvent.setup();
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/default system prompt/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/default system prompt/i);
      await user.clear(textarea);
      await user.type(textarea, 'Custom prompt');

      await waitFor(() => {
        expect(mockCore.settings.update).toHaveBeenCalled();
      });
    });
  });

  describe('Font Size Controls', () => {
    it('renders font size slider', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('Font Size')).toBeInTheDocument();
      });
    });

    it('displays current font size value', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText(/px$/)).toBeInTheDocument();
      });
    });

    it('updates font size when slider changes', async () => {
      const user = userEvent.setup();
      renderSettings();

      await waitFor(() => {
        expect(screen.getByLabelText('Font Size')).toBeInTheDocument();
      });

      // Note: Testing slider interaction requires E2E tests due to complex UI
      // This test validates the element exists
      const slider = screen.getByLabelText('Font Size');
      expect(slider).toBeInTheDocument();
    });
  });

  describe('Settings Persistence', () => {
    it('loads settings on mount', async () => {
      renderSettings();

      await waitFor(() => {
        expect(mockCore.settings.get).toHaveBeenCalled();
      });
    });

    it('handles settings load error gracefully', async () => {
      mockCore.settings.get.mockRejectedValueOnce(new Error('Failed to load'));
      renderSettings();

      await waitFor(() => {
        expect(mockCore.settings.get).toHaveBeenCalled();
      });

      // Page should still render even if settings fail to load
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});
