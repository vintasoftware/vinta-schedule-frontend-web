import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` is a Next.js guard that throws at runtime when imported in
    // a client context. Vitest/jsdom is neither client nor server — alias it to
    // an empty no-op module so server-side modules can be tested without the
    // guard triggering. The build-time enforcement in Next.js is unaffected.
    alias: {
      'server-only': new URL('src/__mocks__/server-only.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
