/**
 * Test Setup
 *
 * Global test configuration and custom matchers for vitest.
 * This file is loaded before all test files.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock CSS imports to avoid PostCSS/Tailwind CSS 4 compatibility issues
vi.mock('yet-another-react-lightbox/styles.css', () => ({}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.electron for electron detection tests
globalThis.window = globalThis.window || ({} as Window & typeof globalThis);
