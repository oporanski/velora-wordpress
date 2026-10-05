# Velora WordPress Plugins

Two WordPress plugins plus the shared JavaScript bundle they ship, for embedding
Velora content — breeders, clubs, animals, listings, events — on an external
WordPress site or a plain HTML page.

This repository is **standalone**. It is not part of the Velora portal
monorepo: it only *consumes* the portal's public API. The plugins default to
`https://velora.pet` and call `/v1/...` on it; the same gateway also answers on
`https://api.velora.pet`.
What still ties the two together is written down in
[`docs/relacja-z-portalem.md`](docs/relacja-z-portalem.md).

License: **GPL v2 or later** — `LICENSE` at the repository root, plus a
byte-identical copy inside each plugin directory (WordPress.org wants one in
every ZIP).

## Structure

```
.
├── breeder/   velora-breeder-widgets  — PHP plugin for breeder sites
├── club/      velora-club-widgets     — PHP plugin for breeder-club sites
├── shared/    abstract PHP base classes — the single source of truth
├── core/      @velora/embed-core      — shared TypeScript bundle (embed.js)
├── tests/     PHPUnit suite (Brain Monkey, no WordPress install needed)
├── scripts/   coverage threshold checker
└── docker/    WordPress dev stack (wp-dev/) + its compose file
```

`breeder/includes/class-base-*.php` and `club/includes/class-base-*.php` are
**generated** from `shared/` by `make build-base`, with a per-plugin class-name
prefix. WordPress.org forbids one plugin depending on another, so each must
carry its own copy; the prefix is what lets both be active on one site without a
fatal class redeclaration. Edit `shared/`, never the copies.

## Requirements

| Tool | Needed for | Required? |
|---|---|---|
| Docker | PHPUnit, coverage, the WP dev stack | yes |
| Node 20+ / npm | building `core/`, running its Vitest suite | yes |
| Python 3 | the coverage threshold check, `.po` → `.mo` compilation | yes |
| `sonar-scanner` | `make sonar-scan` | optional |
| `osv-scanner` | `make security-scan` | optional (but the target FAILS without it, by design) |
| `gitleaks` | `make secret-scan` | optional (but the target FAILS without it, by design) |

No local PHP installation is needed — the test suite runs inside a `composer:2`
container.

## Tests

```bash
make test        # PHPUnit for both plugins — currently OK (156 tests, 394 assertions)
make test-core   # Vitest for core/ with coverage → core/coverage/lcov.info
make coverage    # PHPUnit + Clover coverage + threshold check (lines 99.77 / methods 100)
```

`make test` and `make coverage` both depend on `make build-base`, so they can
never run against a stale copy of the shared base classes. Both install
Composer's dev dependencies into `vendor/` and delete that directory again on
exit, pass or fail.

## Quality gates

```bash
make sonar-scan      # SonarQube — runs `coverage` and `test-core` first
make security-scan   # osv-scanner over core/package-lock.json + composer.lock
make secret-scan     # gitleaks over the full git history
```

`sonar-scan` needs `SONAR_TOKEN` in the environment and a SonarQube at
`http://localhost:9000`. The project key is `velora-wp-plugins` — unchanged from
the monorepo era, so the project's history survived the move.
The SonarQube project key is `velora-wp-plugins`.

`security-scan` deliberately **fails** when `osv-scanner` is absent instead of
skipping. This repository has exactly one dependency scanner; a skip would print
a green line while nothing had been checked. `core/package-lock.json` is the
specific lockfile that, while nobody was scanning it, hid a CVSS 9.8 in the build
tooling.

`secret-scan` exists for the same reason. In the monorepo gitleaks ran from two
husky hooks; this repository has none, so the gate becomes a target. It matters
more here, because this repository is public and the dev stack moves API keys
and WordPress salts around. It too fails when the binary is missing.

`.gitleaks.toml` carries exactly one waiver: the entropy rule `generic-api-key`
is silenced under `tests/`, where the PHPUnit suite feeds the plugins fabricated
`vk_live_…` constants. The waiver is scoped to that one rule and that one
directory, so a real provider key committed into `tests/` is still caught —
verified both ways.

## WordPress dev stack

```bash
make wp-up        # 4 containers: wp-breeder:8081, wp-club:8082, wp-html-test:8083, mariadb
make wp-down      # stop, keep data
make wp-rebuild   # rebuild core JS + restart containers (after a TypeScript change)
make wp-reset     # wipe volumes — next wp-up is a clean WP install
make wp-logs      # tail container logs
make wp-status    # container status
make wp-help      # full cheat-sheet
```

Pre-seeded sites:

- **wp-breeder** `:8081` → breeder `royal-whiskers-cattery` (PROFESJONALISTA tier)
- **wp-club** `:8082` → club `klub-hodowcow-elitarnych` (ELITE tier)
- **wp-html-test** `:8083` → every widget rendered on plain HTML, no WordPress

WP admin: `admin` / `admin` on both. Dev only — the containers are never
reachable from the internet.

**The backend is in another repository.** The widgets read from the Velora API.
For local work against local data, start the portal stack from your checkout of
the portal (`cd ../velora && make up`), then:

```bash
make wp-seed-keys   # issues dev API keys and writes them into both plugins
```

Against production data you need no local backend at all — leave the plugin's
API base at its default `https://velora.pet`.

**Why the contact form needs two things the read-only widgets do not.** Reading
(animals, listings, gallery) happens in the visitor's browser and needs no key.
Submitting the contact form goes through the site's own PHP, so the API key never
reaches the browser — and that has two consequences this stack has to reproduce:

- **`localhost:4000` must resolve from inside the WP container too.** The
  bootstrap scripts start a forwarder to the portal's `external-api` service for
  exactly this. Production has no such problem: both the browser and the
  breeder's server resolve `https://api.velora.pet`.
- **The dev API keys carry NO allowed origins** — because the same key also
  serves the plain-HTML pages on `:8083`, where the key sits in the browser and
  the browser therefore does send an `Origin`. A key pinned to
  `http://localhost:8081` answers `403 Origin not allowed` there. The plugin
  sites themselves no longer care: since 2026-09-11 the gateway lets a request
  through when it carries no `Origin` at all, which is exactly the
  server-to-server case.

## Building and releasing a package

```bash
make wp-package            # both plugins
make wp-package-breeder    # only the breeder plugin
make wp-package-club       # only the club plugin
```

Each run:

1. regenerates the per-plugin base classes from `shared/` (so a release ZIP can
   never carry a base class that lags behind);
2. builds `core/dist/` and compiles every `.po` to `.mo`;
3. stages the plugin, copies in `embed.js`, `embed.css` and `cap_wasm_bg.wasm`,
   strips everything listed in `.distignore`;
4. writes `dist/velora-<plugin>-widgets-<VERSION>.zip`;
5. **publishes that ZIP into the Velora portal checkout.**

### `VELORA_PORTAL_DIR` — the step that crosses repositories

Step 5 copies the ZIP into
`$VELORA_PORTAL_DIR/apps/frontend/public/downloads/`, under both its versioned
name and the stable `velora-<plugin>-widgets.zip` alias that the portal's `/help`
article links to.

| Value | Behaviour |
|---|---|
| unset | defaults to `../velora` — a sibling checkout of the portal |
| a path | publishes there |
| `none` | skips publishing on purpose, prints a note, exits 0 |

**If the directory does not exist, the script fails with a non-zero exit code.**
That is deliberate. The local `dist/` ZIP is written either way, but a silent
skip at this step means "I released a new plugin and users keep downloading the
old one from `velora.pet/downloads/`" — a failure nobody notices until somebody
reports a bug that was fixed weeks ago.

Publishing only copies the files into the portal's working tree. They reach
users when the **portal** repository is committed and deployed.

For WordPress.org itself the ZIP contents go to SVN (`trunk/` + `tags/<VERSION>/`);
icons, banners and screenshots belong in SVN `/assets/`, not in the ZIP. The
runbook is [`docs/wordpress-org-submission.md`](docs/wordpress-org-submission.md).

## Available widgets

**Breeder plugin (`velora-breeder-widgets`):**
| Shortcode | Widget | Pre-created WP page |
|-----------|--------|---------------------|
| `[velora-breeder-about]`    | Profile header (logo, breeds, location, founded, contacts, social) | `/o-hodowli` |
| `[velora-breeder-animals]`  | Grid of current animals (titles + color) | `/nasze-zwierzeta` |
| `[velora-breeder-listings]` | Active marketplace listings (kittens/puppies for sale) | `/oferta` |
| `[velora-breeder-posts]`    | Latest posts from the breeder | `/aktualnosci` |
| `[velora-breeder-events]`   | Events the breeder participates in (via club) | `/wystawy` |
| `[velora-breeder-contact]`  | Inquiry form → message lands in the breeder's Velora inbox (Bearer key required) | `/kontakt` |

**Club plugin (`velora-club-widgets`):**
| Shortcode | Widget | Pre-created WP page |
|-----------|--------|---------------------|
| `[velora-club-about]`     | Club profile header | `/o-klubie` |
| `[velora-club-breeders]`  | Member breeders, filterable + sortable, table/cards layout | `/nasi-hodowcy` |
| `[velora-club-listings]`  | Listings from all member breeders | `/oferta-hodowcow` |
| `[velora-club-posts]`     | Latest club news | `/aktualnosci` |
| `[velora-club-events]`    | Upcoming shows and exhibitions | `/wystawy-i-pokazy` |
| `[velora-club-documents]` | Downloadable docs (regulations, forms, statute) grouped by category | `/dokumenty` |
| `[velora-club-contact]`   | Contact form — visitor picks a topic for context; message lands in the club's Velora inbox (Bearer key required) | `/kontakt` |

All shortcodes accept optional `slug=`, `limit=`, `theme=auto|light|dark`. Slug
defaults to the value configured in plugin settings.

> **🔒 Privacy:** Litter data (planned matings, expected dates, kitten counts
> before placement) is **private breeder business intelligence** and is **never**
> exposed via the public embed. There is no `/v1/breeders/:slug/litters` route —
> and since 2026-09-13 no internal one either.

## Documentation

- [`docs/relacja-z-portalem.md`](docs/relacja-z-portalem.md) — what still connects this repository to the portal
- [`docs/wordpress-org-submission.md`](docs/wordpress-org-submission.md) — WordPress.org submission runbook
- [`docs/wporg-independent-check-2026-08-10.md`](docs/wporg-independent-check-2026-08-10.md) — adversarial readiness audit (2026-08-10)

Both of the last two files also exist in the portal repository, where they were
written. This is their home from 2026-10-05 on; the portal's copies are history.
