import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    include: ['test/**/*.e2e-spec.ts'],
    alias: {
      '@nourplay/db': resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
})
