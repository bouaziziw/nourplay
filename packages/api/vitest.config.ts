import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/**/*.module.ts'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
    alias: {
      '@nourplay/db': resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
})
