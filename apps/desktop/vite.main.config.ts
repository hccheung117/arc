import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, './src/main'),
      '@arc-types': path.resolve(__dirname, './src/types'),
    },
  },
  build: {
    rollupOptions: {
      // Native modules must be external - they can't be bundled
      external: ['better-sqlite3'],
    },
  },
});
