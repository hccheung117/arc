import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.js';
import react from '@vitejs/plugin-react';
import path from 'path';

export default mergeConfig(
  rootConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    test: {
      setupFiles: ['./__tests__/setup.ts'],
      environment: 'happy-dom',
      globals: true,
      include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          '.next/',
          '__tests__/',
          '**/*.config.ts',
          '**/*.config.js',
          'scripts/',
        ],
      },
    },
  })
);
