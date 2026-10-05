## =============================================================================
## Velora WordPress plugins — standalone repository
## =============================================================================
##
## Two WordPress plugins (breeder/ and club/) plus the shared TypeScript embed
## bundle (core/) they ship. This repository is independent of the Velora portal
## monorepo: it only CONSUMES the public API at api.velora.pet.
##
## `make help` prints the target list.

.DEFAULT_GOAL := help

.PHONY: help build-base wp-plugins-build test test-core coverage sonar-scan security-scan secret-scan secret-scan-test \
        wp-help wp-up wp-down wp-rebuild wp-reset wp-logs wp-status wp-build-core \
        wp-seed-keys wp-package-breeder wp-package-club wp-package \
        wp-shell-breeder wp-shell-club wp-debug

WP_COMPOSE := docker compose -f docker/docker-compose.wp-dev.yml

## =============================================================================
## BUILD
## =============================================================================

## Generate each plugin's own copy of the shared base classes.
##
## The copies are deliberately NOT byte-identical to shared/: every
## Velora_Base_* class name gets a per-plugin prefix (Velora_Breeder_Base_*,
## Velora_Club_Base_*). WordPress.org forbids a plugin from depending on another
## plugin, so both plugins must carry their own base classes — and two plugins
## declaring the same global class name is a fatal error the moment both are
## active on one site. The prefix makes that collision impossible by
## construction; a class_exists() guard would instead let the first-loaded
## plugin silently feed its (possibly older) base class to the second, since
## WP.org updates the two plugins independently.
##
## shared/ stays the single source of truth: edit there, never the copies.
## tests/bootstrap.php loads the generated copies, which is why the test and
## coverage targets depend on this one.
##
## $(1) = class-name prefix segment (Breeder | Club)
wp_plugins_gen_base = sed -e 's/Velora_Base_/Velora_$(1)_Base_/g' \
	-e 's|^ \* This file: shared/\(class-base-[a-z]*\)\.php .*| * This file: GENERATED from shared/\1.php by `make build-base`. DO NOT EDIT.|'

build-base:
	@echo "  === Generating prefixed base classes into breeder/ and club/ ==="
	$(call wp_plugins_gen_base,Breeder) shared/class-base-rest.php   > breeder/includes/class-base-rest.php
	$(call wp_plugins_gen_base,Breeder) shared/class-base-plugin.php > breeder/includes/class-base-plugin.php
	$(call wp_plugins_gen_base,Breeder) shared/class-base-blocks.php > breeder/includes/class-base-blocks.php
	$(call wp_plugins_gen_base,Club)    shared/class-base-rest.php   > club/includes/class-base-rest.php
	$(call wp_plugins_gen_base,Club)    shared/class-base-plugin.php > club/includes/class-base-plugin.php
	$(call wp_plugins_gen_base,Club)    shared/class-base-blocks.php > club/includes/class-base-blocks.php
	@echo "  === build-base done ==="

## Alias for the monorepo-era name. Kept deliberately: `make wp-plugins-build` is
## what older notes and the owner's muscle memory say, and typing it into a
## repository that silently has no such target reads like a broken checkout. Listed in `make help` so it
## is discoverable rather than folklore. Not a compatibility shim for code — no
## script in this repository calls it; package-plugin.sh calls `build-base`.
wp-plugins-build: build-base

## =============================================================================
## TESTS
## =============================================================================

## Run PHPUnit tests via Docker (no local PHP required).
## First run: installs Composer deps (~10s). Subsequent runs use Docker layer cache.
## Depends on build-base: tests/bootstrap.php loads the generated per-plugin base
## classes, so a fresh clone or an edit in shared/ would otherwise run against
## stale (or missing) copies.
## Usage: make test
## Composer installs its PHPUnit/Brain Monkey dev deps straight into vendor/
## (gitignored). One of those deps ships a docs/ build requirements.txt
## (Sphinx/pip pins) that trivy's `fs` scan reads as a pip manifest and flags
## with 9 HIGH CVEs we can never fix — we don't own that file, don't ship it
## anywhere, and don't even run the Python tool it pins. Left on disk, it is
## exactly the kind of artifact our OWN quality step produces that then makes
## the security step refuse a release.
## The `trap … EXIT` removes the directory the moment this recipe line's shell
## exits — pass or fail — so no run of this target can leave it behind. Failing
## tests are a PHP source problem, not a vendor/ problem, so there is nothing to
## gain by keeping a failed install around for inspection; the next run
## reinstalls it from the network in a few seconds.
test: build-base
	@echo ""
	@echo "  === WP Plugins — PHPUnit ==="
	@trap 'rm -rf "$(CURDIR)/vendor"' EXIT; \
	docker run --rm \
		-v "$(CURDIR):/app" \
		-w /app \
		composer:2 \
		sh -c "composer install --no-interaction --quiet && vendor/bin/phpunit --no-coverage --colors=always"
	@echo "  === WP Plugins tests done ==="

## Run the core TypeScript test suite with coverage (Vitest).
## Produces core/coverage/lcov.info, which sonar-project.properties points at —
## without this target the Sonar scan reports 0% TypeScript coverage.
test-core:
	@echo ""
	@echo "  === embed-core — Vitest with coverage ==="
	@cd core && npm install --silent && npm run test:coverage
	@echo "  === embed-core coverage done ==="
	@echo "    core/coverage/lcov.info"

## Generate PHP coverage (Clover XML) via Docker + Xdebug.
## First run: builds the velora-php-test image (~2 min). Later runs use the cache.
## Depends on build-base for the same reason `test` does.
## Outputs: tests/reports/clover.xml
## Same vendor/ cleanup as `test` (see its comment).
coverage: build-base
	@echo ""
	@echo "  === Building PHP test image with Xdebug ==="
	@docker build -t velora-php-test -f Dockerfile.test .
	@mkdir -p tests/reports
	@echo "  === WP Plugins — PHPUnit with Coverage ==="
	@trap 'rm -rf "$(CURDIR)/vendor"' EXIT; \
	docker run --rm \
		-v "$(CURDIR):/app" \
		-w /app \
		velora-php-test \
		sh -c "composer install --no-interaction --quiet && vendor/bin/phpunit --coverage-clover=tests/reports/clover.xml --colors=always"
	@echo "  === Coverage threshold check ==="
	@python3 scripts/check-coverage-threshold.py \
		tests/reports/clover.xml \
		--lines=99.77 --methods=100
	@echo "  === WP Plugins coverage done ==="
	@echo "    tests/reports/clover.xml"

## =============================================================================
## QUALITY GATES
## =============================================================================

define check-sonar
	@if [ -z "$$SONAR_TOKEN" ]; then \
		echo "  ERROR: SONAR_TOKEN not set — add to ~/.zprofile"; \
		echo "  Generate at: http://localhost:9000/account/security (leave expiry blank = permanent)"; \
		exit 1; \
	fi
	@if ! command -v sonar-scanner >/dev/null 2>&1; then \
		echo "  ERROR: sonar-scanner not installed"; \
		echo "  Install: brew install sonar-scanner"; \
		exit 1; \
	fi
endef

## Scan the velora-wp-plugins project (PHP plugins + TypeScript core widgets).
## Both coverage reports must exist before the scan, or Sonar records 0% for the
## language whose report is missing: coverage → tests/reports/clover.xml (PHP),
## test-core → core/coverage/lcov.info (TypeScript).
sonar-scan: coverage test-core
	$(check-sonar)
	@echo ""
	@echo "  === SonarQube Scan: velora-wp-plugins ==="
	@sonar-scanner \
		-Dsonar.host.url=http://localhost:9000 \
		-Dsonar.token=$$SONAR_TOKEN
	@echo "  === Done — http://localhost:9000/dashboard?id=velora-wp-plugins ==="

## Known-CVE scan across this repository's lockfiles.
##
## core/package-lock.json used to be covered by the monorepo's
## scripts/security-scan.sh. It was missing from that list until 2026-08-06 and
## hid a CVSS 9.8 in the build tooling — the whole reason the list exists.
## Splitting this repository out removes it from that gate again, so the gate
## moves here with it.
##
## THE ONE RULE (inherited from the monorepo script):
##   tool not installed          → FAIL  (see below — this is the one difference)
##   tool ran and found nothing  → OK
##   tool ran and found anything → FAIL
##
## Unlike the monorepo gate, a MISSING osv-scanner fails here instead of
## skipping. The monorepo runs seven scanners, so a single absent binary still
## leaves six opinions; this repository has exactly one, and a skip would print
## a green line while nothing had been checked at all.
##
## Accepted findings go into an osv-scanner.toml next to the lockfile they
## concern — osv-scanner reads the config from each lockfile's own directory, so
## a waiver cannot leak between them.
security-scan:
	@echo ""
	@echo "  === Security scan — known CVEs in lockfiles ==="
	@if ! command -v osv-scanner >/dev/null 2>&1; then \
		echo "  ✗ FAIL: osv-scanner is not installed — NOTHING was scanned."; \
		echo "    This is a failure, not a skip: a missing scanner must never"; \
		echo "    look like a clean result."; \
		echo "    Install: brew install osv-scanner"; \
		exit 1; \
	fi
	@osv-scanner scan \
		--lockfile=core/package-lock.json \
		--lockfile=composer.lock \
		|| { echo "  ✗ FAIL: osv-scanner reported findings — read its output above."; \
		     echo "    Patch the dependency, or record a PATH-SCOPED waiver with a"; \
		     echo "    statement and an expiry in an osv-scanner.toml next to the"; \
		     echo "    lockfile. Do not silence this step."; exit 1; }
	@echo "  === Security scan complete — no findings ==="

## Secret scanning over the whole git history.
##
## In the monorepo this ran from two husky hooks (pre-commit `gitleaks protect
## --staged`, pre-push `gitleaks detect --source .`). This repository has no
## husky, so the gate moves into a make target — the same reasoning as
## security-scan above: a gate that stays in the repository you left is a gate
## you no longer have.
##
## It matters more here than there: this repository is PUBLIC, and the dev stack
## it ships moves credentials around (seed-api-keys.sh writes vk_live_… keys into
## WordPress options, the bootstrap scripts generate WP salts).
##
## A MISSING gitleaks fails, for the same reason a missing osv-scanner does.
##
## .gitleaks.toml carries ONE waiver: the fabricated vk_live_… constants in
## tests/. Verified both ways on 2026-10-05 — without the waiver the scan
## reports those 2 fixtures; with it, a real provider key planted in tests/ is
## still caught.
## Prove the secret scan can go RED before trusting a green one.
## A gitleaks config without [extend] scans with ZERO rules and reports clean —
## the file looks fine and only a planted credential exposes it. This also pins
## the tests/ waiver's scope: a real provider key committed there must still be
## caught. Run it whenever .gitleaks.toml changes.
secret-scan-test:
	@bash scripts/test-gitleaks-config.sh

secret-scan: secret-scan-test
	@echo ""
	@echo "  === Secret scan — gitleaks over the full history ==="
	@if ! command -v gitleaks >/dev/null 2>&1; then \
		echo "  ✗ FAIL: gitleaks is not installed — NOTHING was scanned."; \
		echo "    This is a failure, not a skip: a missing scanner must never"; \
		echo "    look like a clean result."; \
		echo "    Install: brew install gitleaks"; \
		exit 1; \
	fi
	@gitleaks detect --source . --config .gitleaks.toml --no-banner --redact \
		|| { echo "  ✗ FAIL: gitleaks found a secret — read its output above."; \
		     echo "    This repository is PUBLIC. Rotate the credential FIRST,"; \
		     echo "    then remove it; history cannot be quietly edited away."; exit 1; }
	@echo "  === Secret scan complete — no findings ==="

## =============================================================================
## WORDPRESS DEV ENVIRONMENT — plugin testbeds
## =============================================================================
##
## 3 containers (see docker/docker-compose.wp-dev.yml):
##   wp-breeder    :8081  — plugin hodowcy → royal-whiskers-cattery (PROFESJONALISTA)
##   wp-club       :8082  — plugin klubu   → klub-hodowcow-elitarnych (ELITE)
##   wp-html-test  :8083  — plain-HTML test pages + embed.js bundle
##
## First `make wp-up` takes ~60s (downloads WP image, installs WP, creates pages).
## Subsequent starts are seconds.

## Build the core JS bundle (core/dist/embed.js)
wp-build-core:
	@cd core && npm install --silent && npm run build

## Start the WP dev stack (builds core first, brings up 4 containers)
wp-up: wp-build-core
	@$(WP_COMPOSE) up -d
	@echo ""
	@echo "  ================================================"
	@echo "  WP dev stack is starting..."
	@echo ""
	@echo "  WP Breeder:    http://localhost:8081   (admin/admin)"
	@echo "  WP Club:       http://localhost:8082   (admin/admin)"
	@echo "  HTML test:     http://localhost:8083"
	@echo ""
	@echo "  First boot: wait ~60s for bootstrap (WP install, pages)."
	@echo "  Follow progress:   make wp-logs"
	@echo "  ================================================"

## Stop the WP dev stack (volumes preserved — data survives)
wp-down:
	@$(WP_COMPOSE) down

## Rebuild the core bundle and restart containers (for code changes)
wp-rebuild: wp-build-core
	@$(WP_COMPOSE) restart
	@echo ""
	@echo "  Core rebuilt, containers restarted."
	@echo "  Hard-refresh your browser (Ctrl+Shift+R) to pick up the new bundle."

## Nuclear reset: wipe WP volumes for a clean install on next wp-up
wp-reset:
	@$(WP_COMPOSE) down -v
	@echo ""
	@echo "  Volumes wiped. Next 'make wp-up' = fresh WP install."

## Tail logs from all WP containers
wp-logs:
	@$(WP_COMPOSE) logs -f --tail=50

## Show WP container status
wp-status:
	@$(WP_COMPOSE) ps

## Generate Velora API keys for both dev WP sites and wire them into plugin settings.
## Needs the Velora PORTAL backend stack running (`make up` in the portal checkout) —
## this repository has no backend of its own. Idempotent: re-running revokes the
## previous dev keys and issues fresh ones. Required before contact forms can submit.
wp-seed-keys:
	@bash docker/wp-dev/seed-api-keys.sh

## Build a WP.org-ready ZIP of the breeder plugin (output: dist/velora-breeder-widgets-VERSION.zip)
## Also publishes into the portal checkout — see VELORA_PORTAL_DIR in README.md.
wp-package-breeder:
	@bash docker/wp-dev/package-plugin.sh breeder

## Build a WP.org-ready ZIP of the club plugin
wp-package-club:
	@bash docker/wp-dev/package-plugin.sh club

## Build both plugin ZIPs
wp-package: wp-package-breeder wp-package-club

## Open a bash shell inside the breeder WP container (debug, wp-cli, etc.)
wp-shell-breeder:
	@docker exec -it velora-wp-breeder bash

## Open a bash shell inside the club WP container
wp-shell-club:
	@docker exec -it velora-wp-club bash

## Tail the breeder WP container's PHP error log
wp-debug:
	@docker exec velora-wp-breeder tail -f /var/www/html/wp-content/debug.log 2>/dev/null || \
		echo "No debug.log yet — make sure WP_DEBUG_LOG is enabled in wp-config.php"

## Print full WP-dev cheat-sheet (containers, URLs, common workflows)
wp-help:
	@echo ""
	@echo "  ╔══════════════════════════════════════════════════════════════════════╗"
	@echo "  ║                  Velora WP-dev environment cheat-sheet              ║"
	@echo "  ╚══════════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "  CONTAINERS"
	@echo "  ──────────"
	@echo "    velora-wp-breeder   localhost:8081  (Velora Breeder Widgets plugin)"
	@echo "    velora-wp-club      localhost:8082  (Velora Club Widgets plugin)"
	@echo "    velora-wp-html-test localhost:8083  (plain HTML embed test pages)"
	@echo "    velora-wp-mariadb   internal        (shared MariaDB for both WPs)"
	@echo ""
	@echo "  WP ADMIN LOGIN  (both sites)"
	@echo "  ─────────────────────────────"
	@echo "    URL:       http://localhost:8081/wp-admin   (or :8082)"
	@echo "    User:      admin"
	@echo "    Password:  admin"
	@echo ""
	@echo "  TEST PAGES (already created by bootstrap)"
	@echo "  ──────────────────────────────────────────"
	@echo "    Breeder:   http://localhost:8081/sample-page  ← shortcode tests"
	@echo "    Club:      http://localhost:8082/sample-page"
	@echo "    HTML:      http://localhost:8083/             ← static HTML embeds"
	@echo ""
	@echo "  THE BACKEND LIVES IN ANOTHER REPOSITORY"
	@echo "  ───────────────────────────────────────"
	@echo "    The widgets talk to the Velora portal API. This repository does not"
	@echo "    contain it. Start it from your checkout of the portal:"
	@echo "      cd ../velora && make up      # backend + frontend + Velora API"
	@echo "    Against production data you need no local backend at all — point"
	@echo "    the plugin settings at https://api.velora.pet instead."
	@echo ""
	@echo "  TYPICAL WORKFLOW"
	@echo "  ────────────────"
	@echo "    1.  cd ../velora && make up    # portal backend (separate repository)"
	@echo "    2.  make wp-up                 # WP containers (depends on backend)"
	@echo "    3.  make wp-seed-keys          # creates API keys + writes them into plugins"
	@echo "    4.  Open  http://localhost:8081/sample-page  in your browser"
	@echo ""
	@echo "  WHEN YOU CHANGE CODE"
	@echo "  ────────────────────"
	@echo "    PHP files (includes/, blocks/editor.js):"
	@echo "      → live, just refresh the WP page"
	@echo ""
	@echo "    Shared base classes (shared/class-base-*.php):"
	@echo "      → make build-base           # regenerates the per-plugin copies"
	@echo ""
	@echo "    Embed bundle (core/src/*.ts, *.css):"
	@echo "      → make wp-rebuild           # rebuilds core/dist + restarts containers"
	@echo "      → then hard-refresh browser (Ctrl+Shift+R)"
	@echo ""
	@echo "    Plugin settings (slug, API key) got out of sync:"
	@echo "      → make wp-seed-keys         # idempotent — rewrites plugin options"
	@echo ""
	@echo "  TROUBLESHOOTING"
	@echo "  ───────────────"
	@echo "    Widgets render but show 'No data' or empty:"
	@echo "      • make wp-seed-keys         # API key / slug may be stale"
	@echo "      • Check  Settings → Velora …  in WP admin (Test connection button)"
	@echo "      • make wp-debug             # tails PHP error log"
	@echo ""
	@echo "    Embed.js loads stale code after a TS edit:"
	@echo "      • make wp-rebuild           # don't forget Ctrl+Shift+R after"
	@echo ""
	@echo "    'Cannot connect to database' / 500 errors:"
	@echo "      • docker compose -f docker/docker-compose.wp-dev.yml logs wp-mariadb"
	@echo "      • make wp-reset             # NUCLEAR — wipes volumes, fresh install"
	@echo ""
	@echo "    Need to inspect/edit DB directly:"
	@echo "      • make wp-shell-breeder     # then: wp db query 'SELECT …' --allow-root"
	@echo ""
	@echo "  PACKAGING & DISTRIBUTION"
	@echo "  ────────────────────────"
	@echo "    make wp-package              # builds BOTH ZIPs into dist/ and publishes"
	@echo "                                  # them into \$$VELORA_PORTAL_DIR (default ../velora)"
	@echo "                                  # apps/frontend/public/downloads/ — the files"
	@echo "                                  # /help links to. Missing directory = hard error."
	@echo "    VELORA_PORTAL_DIR=none make wp-package   # build only, skip publishing"
	@echo "    make wp-package-breeder      # only the breeder plugin ZIP"
	@echo "    make wp-package-club         # only the club plugin ZIP"
	@echo ""
	@echo "  ALL TARGETS"
	@echo "  ───────────"
	@echo "    make wp-up         start stack    make wp-down       stop stack (keep data)"
	@echo "    make wp-rebuild    rebuild bundle make wp-reset      wipe DB + plugins"
	@echo "    make wp-logs       tail logs      make wp-status     container ps"
	@echo "    make wp-debug      PHP error log  make wp-shell-*    bash inside container"
	@echo "    make wp-seed-keys  refresh keys   make wp-package    build distribution ZIPs"
	@echo ""

## =============================================================================
## HELP
## =============================================================================

help:
	@echo ""
	@echo "  Velora WordPress plugins — standalone repository"
	@echo ""
	@echo "  BUILD"
	@echo "    make build-base        Generate per-plugin copies of shared/class-base-*.php"
	@echo "                           (alias: make wp-plugins-build — the monorepo-era name)"
	@echo "    make wp-build-core     Build the embed JS bundle (core/dist/)"
	@echo ""
	@echo "  TESTS"
	@echo "    make test              PHPUnit for both plugins (Docker, no local PHP)"
	@echo "    make test-core         Vitest for core/ with coverage (core/coverage/lcov.info)"
	@echo "    make coverage          PHPUnit + Clover coverage + threshold check"
	@echo ""
	@echo "  QUALITY GATES"
	@echo "    make sonar-scan        SonarQube scan (runs coverage + test-core first)"
	@echo "    make security-scan     osv-scanner over core/package-lock.json + composer.lock"
	@echo "    make secret-scan       gitleaks over the full git history"
	@echo ""
	@echo "  WORDPRESS DEV STACK"
	@echo "    make wp-up             Start the 4-container WP testbed"
	@echo "    make wp-down           Stop it (volumes kept)"
	@echo "    make wp-rebuild        Rebuild the bundle and restart containers"
	@echo "    make wp-reset          Wipe volumes (fresh WP install next wp-up)"
	@echo "    make wp-logs           Tail container logs"
	@echo "    make wp-status         Container status"
	@echo "    make wp-seed-keys      Issue dev API keys (needs the portal backend running)"
	@echo "    make wp-shell-breeder  Shell inside the breeder container"
	@echo "    make wp-shell-club     Shell inside the club container"
	@echo "    make wp-debug          Tail the breeder PHP error log"
	@echo "    make wp-help           Full WP-dev cheat-sheet"
	@echo ""
	@echo "  RELEASE"
	@echo "    make wp-package           Build both ZIPs and publish to the portal checkout"
	@echo "    make wp-package-breeder   Only the breeder ZIP"
	@echo "    make wp-package-club      Only the club ZIP"
	@echo "    VELORA_PORTAL_DIR=none make wp-package   # build only, skip publishing"
	@echo ""
