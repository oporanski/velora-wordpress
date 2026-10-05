# Open issues

Two measured, unclosed items. Both moved here on 2026-10-05 from the Velora
portal's backlog, which is where this code used to live; neither has been
worked on since it was measured.

## 1. Animal age renders in Polish even in an English embed

**Where:** the animal-list widget embedded on a breeder's site with the
language set to English.

**What happens:** every other visible string in that widget goes through the
translator — sex shows as "♂ Male" — but the age is assembled from Polish
numeral forms hard-coded in the source: `4 m-cy`, `1 rok`, `3 lata`, `5 lat`.
An English reader sees an English card with a Polish age on it.

**Effect on the reader:** cosmetic, but publicly visible — this is a breeder's
own website, not an admin panel.

**Scale (measured):** four numeral forms in one function; affects embeds with
`locale: 'en'` only.

**Effort:** small in itself, but the change touches the plugin's translation
layer and requires rebuilding `dist/embed.js`, which ships to the WordPress.org
directory — so it needs a release.

**What we do not know:** nothing; measured 2026-09-18.

⚠️ The tests added on 2026-09-18 **assert today's Polish forms under
`locale: 'en'`**, so they currently pin the defect in place. Fixing the code
means changing those tests in the same commit; a comment in the test says so.

## 2. The embed bundle's coverage is measured over a subset of the code

**Where:** the coverage gate for the `core` package (`core/vitest.config.ts`).

**What happens:** `about.ts`, `events.ts`, `gallery.ts` and `posts.ts` have no
dedicated tests, so nothing imports them, v8 never instruments them, and they
**never enter the denominator** — they do not even count as 0%. The less of a
file you test, the less it can hurt the number.

**Scale (measured 2026-09-18**, `npx vitest run --coverage
--coverage.include='src/**'` against the gate run; the numerator is identical,
only the denominator differs):

| metric | the gate reports | actual |
|---|---|---|
| branches | 90.56% (384/424) | **63.15% (384/608)** |
| statements | 99.45% (915/920) | **67.47% (915/1356)** |
| functions | 99.24% (131/132) | **71.97% (131/182)** |
| lines | 99.76% (849/851) | **68.46% (849/1240)** |

**436 statements and 184 branches** sit outside the measurement entirely, in
four widgets that each report `0 | 0 | 0 | 0`. Since 2026-07-02 the threshold
has climbed 55 → 60 → 89 → 90, which reads like a module being polished while
a third of it was never weighed. The same blind spot hid the absence of tests
for `breeder-animals.ts` for six weeks.

**The remedy is `coverage.include: ['src/**']`, NOT `coverage.all`.** Verified
experimentally: under Vitest 4.1.11 `--coverage.all=true` does not change the
result by a single statement — the option was removed in Vitest 3 and replaced
by `include`. Adding `all` would be a dead line that looks like a fix.

**Effort:** its own task. Turning `include` on blocks the gate immediately, so
one increment has to add tests for the four widgets **and** reset the
thresholds once to the measured level.

**What we do not know:** nothing; measured.
