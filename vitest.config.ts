import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    globalSetup: 'tests/globalSetup.ts',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@app': path.resolve(__dirname, 'src/app'),
      '@email': path.resolve(__dirname, 'src/email'),
    },
  },
});
