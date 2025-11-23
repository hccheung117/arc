import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@arc-types': path.resolve(__dirname, './src/types'),
    },
  },
});
