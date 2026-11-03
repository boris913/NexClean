import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Les tests d'intégration partagent une base : exécution séquentielle des fichiers.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
