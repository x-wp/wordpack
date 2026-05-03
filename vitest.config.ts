import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    snapshotFormat: {
      printBasicPrototype: false,
    },
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
