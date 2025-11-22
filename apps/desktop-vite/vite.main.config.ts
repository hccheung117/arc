import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Native modules must be external - they can't be bundled
      external: ['better-sqlite3'],
    },
  },
});
