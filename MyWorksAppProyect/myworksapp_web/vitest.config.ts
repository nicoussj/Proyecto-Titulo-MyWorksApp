import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Pruebas unitarias con jsdom. Las de node:test (npm test) y las e2e siguen aparte. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@myworksapp/shared': path.resolve(import.meta.dirname, '../shared/src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.ts', 'src/vite-env.d.ts'],
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
      reportsDirectory: 'test-results/cobertura-unit',
    },
  },
});
