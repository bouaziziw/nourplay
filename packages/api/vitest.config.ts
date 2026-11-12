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
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/**/*.module.ts',
        'src/**/*.controller.ts',
        'src/**/*.gateway.ts',
        'src/**/dto/**',
      ],
      thresholds: { lines: 45, functions: 50, branches: 60, statements: 45 },
    },
    alias: {
      '@nourplay/db': resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
})
