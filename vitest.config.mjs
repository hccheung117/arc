import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@jsx': path.resolve(import.meta.dirname, 'src/main/jsx.js'),
    },
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from '@jsx'`,
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
