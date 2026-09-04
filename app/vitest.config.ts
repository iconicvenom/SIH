import { defineConfig } from 'vitest/config';

/** Separate from vite.config.ts so the Tailwind plugin never runs in the node test env.
 *  Test scope is deliberately narrow (Part I §13): the ore-ramp parity test and the
 *  generator credibility gate. Nothing else. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
