import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Vitest config — unit tests for the pure "functional core" of PaperRadar.
// The alias mirrors the `@/*` -> `src/*` path in tsconfig so tests import the
// same way the app does. Coverage is scoped to the I/O-free modules under test
// (the imperative shell that talks to Supabase/AI/Stripe is integration-tested
// elsewhere, not here).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/lib/pipeline/score-dimensions.ts',
        'src/lib/pipeline/utils.ts',
        'src/lib/paywall/check.ts',
        'src/lib/email/unsubscribe-token.ts',
      ],
    },
  },
})
