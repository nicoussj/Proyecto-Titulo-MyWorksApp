import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Pruebas de pantallas con jsdom. También corre las de node:test (src) para medir una sola cobertura. Las e2e siguen aparte. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@myworksapp/shared', replacement: path.resolve(import.meta.dirname, '../shared/src') },
      { find: /^node:test$/, replacement: path.resolve(import.meta.dirname, 'tests/unit/node_test_vitest.ts') },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'pantallas', environment: 'jsdom', include: ['tests/unit/**/*.test.{ts,tsx}'], setupFiles: ['tests/unit/setup.ts'] },
      },
      {
        extends: true,
        test: { name: 'logica', environment: 'node', include: ['src/**/*.test.ts'] },
      },
    ],
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
