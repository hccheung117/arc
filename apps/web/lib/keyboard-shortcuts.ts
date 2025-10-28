/**
 * Centralized keyboard shortcut definitions for Arc
 * Ensures consistency across all tooltips and keyboard handlers
 */

// Detect if running on macOS
export const isMac = typeof window !== 'undefined'
  ? /Mac|iPod|iPhone|iPad/.test(window.navigator.platform)
  : false;

// Modifier key label (Cmd on Mac, Ctrl elsewhere)
export const modKey = isMac ? '⌘' : 'Ctrl';
export const modKeyLong = isMac ? 'Cmd' : 'Ctrl';

/**
 * Keyboard shortcut definitions with display labels
 */
export const keyboardShortcuts = {
  // Global shortcuts
  newChat: {
    key: 'n',
    mod: true,
    label: `${modKey}+N`,
    description: 'Create new chat',
  },
  openSettings: {
    key: ',',
    mod: true,
    label: `${modKey}+,`,
    description: 'Open settings',
  },
  commandPalette: {
    key: 'k',
    mod: true,
    label: `${modKey}+K`,
    description: 'Open command palette',
  },
  inChatSearch: {
    key: 'f',
    mod: true,
    label: `${modKey}+F`,
    description: 'Search in current chat',
  },
  toggleSidebar: {
    key: 'b',
    mod: true,
    label: `${modKey}+B`,
    description: 'Toggle sidebar',
  },

  // Composer shortcuts
  sendMessage: {
    key: 'Enter',
    label: 'Enter',
    description: 'Send message',
  },
  newLine: {
    key: 'Enter',
    shift: true,
    label: 'Shift+Enter',
    description: 'New line',
  },
  attachImage: {
    key: 'u',
    mod: true,
    label: `${modKey}+U`,
    description: 'Attach image',
  },

  // Chat list shortcuts
  renameChat: {
    key: 'F2',
    label: 'F2',
    description: 'Rename chat',
  },
  deleteChat: {
    key: 'Delete',
    label: 'Delete',
    description: 'Delete chat',
  },

  // Message shortcuts
  copyMessage: {
    key: 'c',
    mod: true,
    label: `${modKey}+C`,
    description: 'Copy message',
  },
  deleteMessage: {
    key: 'Delete',
    label: 'Delete',
    description: 'Delete message',
  },

  // Navigation shortcuts
  nextMatch: {
    key: 'g',
    mod: true,
    label: `${modKey}+G`,
    description: 'Next search result',
  },
  previousMatch: {
    key: 'g',
    mod: true,
    shift: true,
    label: `${modKey}+Shift+G`,
    description: 'Previous search result',
  },
  escape: {
    key: 'Escape',
    label: 'Esc',
    description: 'Close dialog/cancel',
  },
} as const;

/**
 * Check if a keyboard event matches a shortcut definition
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: {
    key: string;
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
  }
): boolean {
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const modMatches = shortcut.mod ? modPressed : !modPressed;
  const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const altMatches = shortcut.alt ? event.altKey : !event.altKey;

  return keyMatches && modMatches && shiftMatches && altMatches;
}

/**
 * Format a keyboard shortcut for display in a tooltip
 */
export function formatShortcut(shortcut: {
  key?: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  label?: string;
}): string {
  if (shortcut.label) {
    return shortcut.label;
  }

  const parts: string[] = [];

  if (shortcut.mod) parts.push(modKey);
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.key) parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
}
