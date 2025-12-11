import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.spec.ts'],
    // Increase timeout for e2e tests
    testTimeout: 60000,
    hookTimeout: 60000,
    // Run tests sequentially since they share a server
    pool: 'forks',
    // Use maxWorkers: 1 to run tests sequentially (replaces poolOptions.forks.singleFork)
    maxWorkers: 1,
  },
})
