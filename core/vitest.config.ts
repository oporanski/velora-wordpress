import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'src/i18n.ts',
        'src/styles/**',
        'src/styles.d.ts',
        'dist/**',
        '**/*.config.*',
        'src/__tests__/**',
      ],
      // Ratchet — these only ever go up. Raised when the two contact widgets
      // went from 0% to fully covered (2026-08-10); branches raised again the
      // same day after an unused breed pre-fill branch was deleted from
      // breeder-contact.ts (the basic contact form no longer takes any
      // portal context — see docs/backlog/wp-plugins-fixes.md history).
      // Raised again same day when listings.ts (a widgets/ member that had
      // 0% coverage) went to 100% lines/statements/functions, 96% branches.
      // Raised again on 2026-08-22 when club-breeders.ts went from 0% to 100%
      // lines/statements/functions and 89% branches (docs/backlog/wp-plugins-fixes.md
      // item 2). Note for the next bump: under the v8 provider a file at 0%
      // contributes no branches at all, so covering one for the first time can
      // LOWER the global branch percentage — measure before assuming.
      // That happened on 2026-09-13: a link-only test pulled club-documents.ts
      // in at 33% branches and dropped the total to 80%, blocking deploy-dev
      // until 2026-09-17, when the widget went to 100% and every figure was raised.
      // Raised again on 2026-09-18 when breeder-animals.ts (the widget behind the
      // [object Object] bug from commit 993af12a2, shipped without a test file)
      // went from untracked (0 tests -> not instrumented by v8 at all, so it
      // contributed nothing to any figure) to 100% lines/statements/functions,
      // 96.87% branches — measured global branches 90.56%.
      // 2026-10-08: events.ts (shared with the breeder plugin, previously
      // untested and so not instrumented) went to 100% lines/functions, 95.8%
      // branches with the club poster; global branches measured 91.44%.
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 91,
        statements: 99,
      },
    },
  },
})
