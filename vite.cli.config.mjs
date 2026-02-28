import { defineConfig } from 'vite'
import path from 'node:path'

const entry = process.env.TASK
if (!entry) throw new Error('TASK env var required')

const basename = path.basename(entry, path.extname(entry))

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@main': path.resolve(import.meta.dirname, 'src/main'),
      '@cli': path.resolve(import.meta.dirname, 'src/cli'),
    },
  },
  build: {
    lib: { entry, formats: ['cjs'] },
    outDir: '.vite/cli',
    rollupOptions: {
      external: (id) => id === 'electron' || /^node:/.test(id) || (!id.startsWith('.') && !path.isAbsolute(id) && !id.startsWith('@shared') && !id.startsWith('@main') && !id.startsWith('@cli')),
      output: { entryFileNames: `${basename}.js` },
    },
    target: 'node20',
    minify: false,
    emptyOutDir: false,
  },
})
