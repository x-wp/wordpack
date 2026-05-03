import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  oxc: false,
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2022',
      },
    }),
  ],
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
