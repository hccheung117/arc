import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  root: './src',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@arc-types': path.resolve(__dirname, './src/types'),
    },
  },
  build: {
    // Output to project root .vite/ (Electron Forge expects renderer here, not in src/.vite/)
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
});
