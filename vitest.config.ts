import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // happy-dom permite parsear los fixtures de HTML real sin navegador.
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
