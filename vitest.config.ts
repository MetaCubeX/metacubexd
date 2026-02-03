import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['e2e/**/*.spec.ts', '**/__tests__/**/*.spec.ts'],
    // Increase timeout for e2e tests
    testTimeout: 60000,
    hookTimeout: 60000,
    // Run tests sequentially since they share a server
    pool: 'forks',
    // Use maxWorkers: 1 to run tests sequentially (replaces poolOptions.forks.singleFork)
    maxWorkers: 1,
    // Setup file for unit tests
    setupFiles: ['./test/setup.ts'],
    // Use jsdom environment for DOM API support
    environment: 'jsdom',
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['stores/**/*.ts', 'composables/**/*.ts', 'utils/**/*.ts'],
      exclude: ['**/__tests__/**', '**/index.ts', '**/*.d.ts'],
    },
  },
})
