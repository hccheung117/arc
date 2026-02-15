import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'src/renderer',
  plugins: [tailwindcss()],
});
