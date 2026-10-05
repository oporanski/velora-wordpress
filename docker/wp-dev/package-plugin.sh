#!/usr/bin/env bash
# Builds a WP.org-ready distribution ZIP for one of the plugins.
#
# Usage: bash docker/wp-dev/package-plugin.sh breeder|club
#        (or `make wp-package-breeder` / `make wp-package-club`)
#
# Output: dist/velora-{breeder,club}-widgets-VERSION.zip
#
# Steps:
#   0. Regenerate the plugin's includes/class-base-*.php from shared/.
#   1. Build the @velora/embed-core JS bundle.
#   2. Copy the plugin source to a clean staging directory.
#   3. Copy the freshly built embed.js + embed.css into the plugin's assets/.
#   4. Strip files listed in .distignore.
#   5. Zip the result with the plugin slug as the top-level directory.
#   6. Publish the ZIP into the Velora portal checkout ($VELORA_PORTAL_DIR).

set -euo pipefail

PLUGIN="${1:-}"
if [[ "$PLUGIN" != "breeder" && "$PLUGIN" != "club" ]]; then
  echo "Usage: $0 breeder|club" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN_DIR="$REPO_ROOT/$PLUGIN"
CORE_DIR="$REPO_ROOT/core"
SLUG="velora-$PLUGIN-widgets"
OUT_DIR="$REPO_ROOT/dist"
STAGE_DIR="$REPO_ROOT/dist/.stage-$PLUGIN"

log() { echo "[package-$PLUGIN] $*"; }

if [[ ! -d "$PLUGIN_DIR" ]]; then
  echo "Plugin source not found: $PLUGIN_DIR" >&2
  exit 1
fi

# 0. Regenerate includes/class-base-*.php from shared/.
#    Those files are generated artifacts, not copies: `make build-base`
#    rewrites the class names with a per-plugin prefix so both plugins can be
#    active on one WordPress install. Regenerating here means a release ZIP can
#    never carry a base class that lags behind shared/ — a mismatch that would
#    only show up as broken behaviour on a user's site.
#    The transformation itself lives in the Makefile so it has exactly one
#    definition; this script must not reimplement it.
log "Regenerating shared base classes..."
make -C "$REPO_ROOT" build-base >/dev/null

# 1. Build core JS.
log "Building core JS..."
(cd "$CORE_DIR" && npm install --silent && npm run build >/dev/null)

# 1b. Compile .po -> .mo for every translation we ship. Pure-Python compiler
#     so we don't depend on `msgfmt` (gettext) being on the build machine.
#
#     The languages/*.json files (JavaScript translations for blocks/editor.js,
#     loaded via wp_set_script_translations) are committed artifacts, not built
#     here — generating them needs WP-CLI, which the build machine may not have.
#     Regenerate them whenever a translatable string in blocks/editor.js changes:
#       wp i18n make-pot <plugin-dir> <plugin-dir>/languages/<slug>.pot
#       wp i18n update-po <pot> <plugin-dir>/languages/
#       wp i18n make-json <plugin-dir>/languages --no-purge
#     They are copied into the ZIP by the plain directory copy in step 3.
LANG_DIR="$PLUGIN_DIR/languages"
if compgen -G "$LANG_DIR/*.po" >/dev/null; then
  log "Compiling translations..."
  for po in "$LANG_DIR"/*.po; do
    python "$REPO_ROOT/docker/wp-dev/compile-mo.py" "$po" >/dev/null
  done
fi

# 2. Read version from main plugin PHP file.
VERSION=$(grep -E '^[[:space:]]*\*[[:space:]]*Version:' "$PLUGIN_DIR/$SLUG.php" | head -1 | sed -E 's/.*Version:[[:space:]]*([^[:space:]]+).*/\1/')
log "Plugin version: $VERSION"

# 3. Clean stage + copy source.
mkdir -p "$OUT_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/$SLUG"
cp -R "$PLUGIN_DIR/." "$STAGE_DIR/$SLUG/"

# 4. Copy built JS bundle into assets/ (overwriting any stale dev volume mount).
#    cap_wasm_bg.wasm is the Cap.js proof-of-work solver. It MUST travel with
#    embed.js and land in the same directory: the bundle points the captcha
#    widget at a URL derived from its own location, and shipping the binary is
#    what keeps the widget from fetching it off a CDN on the visitor's site
#    (WP.org guideline #8 — see src/cap-wasm.ts).
mkdir -p "$STAGE_DIR/$SLUG/assets"
cp "$CORE_DIR/dist/embed.js" "$STAGE_DIR/$SLUG/assets/"
cp "$CORE_DIR/dist/embed.css" "$STAGE_DIR/$SLUG/assets/"
cp "$CORE_DIR/dist/cap_wasm_bg.wasm" "$STAGE_DIR/$SLUG/assets/"

# 5. Strip files listed in .distignore.
if [[ -f "$STAGE_DIR/$SLUG/.distignore" ]]; then
  log "Applying .distignore..."
  while IFS= read -r line; do
    # skip comments + blank lines
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    # remove file or directory if present
    rm -rf "$STAGE_DIR/$SLUG/$line"
  done < "$STAGE_DIR/$SLUG/.distignore"
  rm -f "$STAGE_DIR/$SLUG/.distignore"
fi

# 6. Build ZIP — try `zip`, fall back to PowerShell Compress-Archive (Windows), then 7z.
ZIP_NAME="${SLUG}-${VERSION}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"
rm -f "$ZIP_PATH"
log "Creating $ZIP_NAME..."
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGE_DIR" && zip -rq "$ZIP_PATH" "$SLUG")
elif command -v powershell.exe >/dev/null 2>&1; then
  # Windows fallback — PowerShell ships everywhere.
  WIN_STAGE=$(cygpath -w "$STAGE_DIR/$SLUG" 2>/dev/null || echo "$STAGE_DIR/$SLUG")
  WIN_OUT=$(cygpath -w "$ZIP_PATH" 2>/dev/null || echo "$ZIP_PATH")
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$WIN_STAGE' -DestinationPath '$WIN_OUT' -Force" >/dev/null
elif command -v 7z >/dev/null 2>&1; then
  (cd "$STAGE_DIR" && 7z a -tzip -bso0 -bsp0 "$ZIP_PATH" "$SLUG")
else
  echo "ERROR: no zip tool found (tried: zip, powershell.exe, 7z)" >&2
  exit 1
fi

# 7. Cleanup stage.
rm -rf "$STAGE_DIR"

SIZE=$(du -h "$ZIP_PATH" | cut -f1)
log "✓ Done: $ZIP_PATH ($SIZE)"

# 8. Publish to the Velora portal checkout so the /help page can link both a
#    versioned ZIP and a stable "latest" alias. Since the plugins live in their
#    own repository, the portal is a SEPARATE checkout and its location is an
#    explicit parameter:
#
#      VELORA_PORTAL_DIR=../velora   (default — sibling checkout of the portal)
#      VELORA_PORTAL_DIR=none        (skip publishing on purpose, exit 0)
#
#    If the directory is missing this step FAILS LOUDLY. A silent skip here
#    means "I released a new plugin, and users keep downloading the old ZIP
#    from velora.pet/downloads/" — the one failure mode nobody notices.
VELORA_PORTAL_DIR="${VELORA_PORTAL_DIR:-$REPO_ROOT/../velora}"

if [[ "$VELORA_PORTAL_DIR" == "none" ]]; then
  log "  → portal publish skipped on request (VELORA_PORTAL_DIR=none)"
  log "    ZIP is still available at: $ZIP_PATH"
else
  PUBLIC_DIR="$VELORA_PORTAL_DIR/apps/frontend/public/downloads"
  if [[ ! -d "$PUBLIC_DIR" ]]; then
    echo "" >&2
    echo "ERROR: cannot publish to the portal — directory does not exist:" >&2
    echo "         $PUBLIC_DIR" >&2
    echo "" >&2
    echo "  The ZIP was built successfully and is at:" >&2
    echo "         $ZIP_PATH" >&2
    echo "" >&2
    echo "  Point VELORA_PORTAL_DIR at your checkout of the Velora portal:" >&2
    echo "         VELORA_PORTAL_DIR=/path/to/velora bash $0 $PLUGIN" >&2
    echo "  or skip publishing deliberately:" >&2
    echo "         VELORA_PORTAL_DIR=none bash $0 $PLUGIN" >&2
    echo "" >&2
    echo "  Not failing here would ship a release that users never receive:" >&2
    echo "  velora.pet/downloads/ would keep serving the previous ZIP." >&2
    exit 1
  fi
  cp -f "$ZIP_PATH" "$PUBLIC_DIR/$ZIP_NAME"
  cp -f "$ZIP_PATH" "$PUBLIC_DIR/$SLUG.zip"
  log "  → published $PUBLIC_DIR/$ZIP_NAME (+ $SLUG.zip alias)"
  log "    Commit and deploy the PORTAL repository for this to reach users."
fi

# The plugin no longer ships a self-hosted updater — WordPress.org hosted
# plugins are not permitted to auto-update from outside the directory
# (WP.org guideline #8). Updates for end users are served by WordPress.org
# itself once a new version is committed to SVN; the ZIP published above is
# only a convenience download for the /help page, not an update feed.
log "  Upload ZIP contents to WP.org SVN: trunk/ + tags/$VERSION/"
log "  Asset files (icon/banner/screenshots) belong in SVN /assets/, not the ZIP."
