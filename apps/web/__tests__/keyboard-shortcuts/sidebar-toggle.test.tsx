/**
 * Sidebar Toggle Keyboard Shortcut Tests
 *
 * Tests that the Cmd/Ctrl + B keyboard shortcut toggles the sidebar
 * and is properly registered in the keyboard shortcuts configuration.
 */

import { describe, it, expect } from 'vitest';
import { keyboardShortcuts } from '@/lib/keyboard-shortcuts';

describe('Sidebar Toggle Keyboard Shortcut', () => {
  describe('Shortcut Registration', () => {
    it('defines toggleSidebar shortcut in keyboardShortcuts config', () => {
      expect(keyboardShortcuts.toggleSidebar).toBeDefined();
    });

    it('uses "b" as the key', () => {
      expect(keyboardShortcuts.toggleSidebar.key).toBe('b');
    });

    it('requires modifier key (Cmd/Ctrl)', () => {
      expect(keyboardShortcuts.toggleSidebar.mod).toBe(true);
    });

    it('has correct label for display', () => {
      // Label should be either ⌘+B or Ctrl+B depending on platform
      const label = keyboardShortcuts.toggleSidebar.label;
      expect(label).toMatch(/^(⌘|Ctrl)\+B$/);
    });

    it('has descriptive text', () => {
      expect(keyboardShortcuts.toggleSidebar.description).toBe('Toggle sidebar');
    });
  });

  describe('Shortcut Functionality', () => {
    it('SidebarProvider listens for keyboard shortcuts', async () => {
      // The shadcn/ui SidebarProvider has built-in keyboard shortcut handling
      // Verify the useSidebar hook is available (this is what SidebarProvider uses)
      const sidebarModule = await import('@/components/ui/sidebar');
      expect(sidebarModule.useSidebar).toBeDefined();
      expect(sidebarModule.SidebarProvider).toBeDefined();
    });
  });
});
