/**
 * Test Setup
 *
 * Global test configuration and custom matchers for vitest.
 * This file is loaded before all test files.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.electron for electron detection tests
globalThis.window = globalThis.window || ({} as Window & typeof globalThis);
