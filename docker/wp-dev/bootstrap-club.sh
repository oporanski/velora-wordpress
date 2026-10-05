#!/usr/bin/env bash
# Bootstrap for wp-club container (MariaDB-backed) — mirror of bootstrap-breeder.sh.
set -euo pipefail

WP_PATH="/var/www/html"
CLUB_SLUG="${VELORA_CLUB_SLUG:-klub-hodowcow-elitarnych}"
SITE_URL="http://localhost:8082"
SITE_TITLE="Klub Hodowców Elitarnych (dev)"
ADMIN_USER="admin"
ADMIN_PASS="admin"
ADMIN_EMAIL="admin@velora-dev.local"

log() { echo "[bootstrap-club] $*"; }

for i in {1..60}; do
  if [ -f "$WP_PATH/wp-load.php" ]; then break; fi
  sleep 1
done

if [ ! -f "$WP_PATH/wp-load.php" ]; then
  log "wp-load.php not found after 60s — aborting."
  exit 0
fi

if ! command -v less >/dev/null 2>&1; then
  log "Installing less + default-mysql-client..."
  apt-get update -qq
  apt-get install -y -qq less default-mysql-client >/dev/null
fi

if ! command -v wp >/dev/null 2>&1; then
  log "Installing wp-cli..."
  curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp
  chmod +x /usr/local/bin/wp
fi


# Make http://localhost:4000 reachable from INSIDE this container.
#
# One option — the plugin's API base URL — is read by two consumers with
# different views of the network: the visitor's BROWSER (embed.js fetches the
# Cap.js challenge directly) and this container's PHP (wp_remote_post sends the
# contact form server-to-server, because the API key must never reach the
# browser). In production both resolve https://api.velora.pet and the question
# does not arise. Locally no single hostname serves both: the browser cannot
# resolve `external-api` or `host.docker.internal`, and inside the container
# `localhost` is the container itself.
#
# Forwarding localhost:4000 to the external-api service gives both consumers one
# address, exactly as production does. Without it the captcha widget solves
# normally and the submit then fails with 502 "Could not reach Velora API" —
# the state this stack was in until 2026-09-10, which is why the plugin contact
# path had never been measured end-to-end here. Setting the option to
# `host.docker.internal` instead only moves the breakage to the browser (tried,
# and reverted, in an earlier session).
#
# Runs on EVERY start, before the "already bootstrapped" early exit below: the
# WP volume survives restarts, the forwarder process does not.
if ! command -v socat >/dev/null 2>&1; then
  log "Installing socat (localhost:4000 -> external-api:4000 forwarder)..."
  apt-get update -qq
  apt-get install -y -qq socat >/dev/null
fi
# A second instance simply fails on the busy port, which makes this idempotent.
socat TCP-LISTEN:4000,fork,reuseaddr TCP:external-api:4000 >/dev/null 2>&1 &

cd "$WP_PATH"

if [ -f "$WP_PATH/.velora-bootstrapped" ]; then
  log "Already bootstrapped — skipping."
  exit 0
fi

log "Bootstrapping fresh WP install..."

for i in {1..30}; do
  if mysqladmin ping -h "${WORDPRESS_DB_HOST}" -u"${WORDPRESS_DB_USER}" -p"${WORDPRESS_DB_PASSWORD}" --silent 2>/dev/null; then
    log "MariaDB is reachable."
    break
  fi
  log "Waiting for MariaDB ($i/30)..."
  sleep 2
done

# Remove SQLite leftovers from previous broken installs.
rm -f "$WP_PATH/wp-content/db.php"
rm -rf "$WP_PATH/wp-content/database"
rm -rf "$WP_PATH/wp-content/plugins/sqlite-database-integration"

log "Writing wp-config.php..."
KEYS=""
for k in AUTH_KEY SECURE_AUTH_KEY LOGGED_IN_KEY NONCE_KEY AUTH_SALT SECURE_AUTH_SALT LOGGED_IN_SALT NONCE_SALT; do
  V=$(head -c 64 /dev/urandom | base64 | tr -d '\n/+=' | head -c 64)
  KEYS+="define('$k', '$V');\n"
done

cat > "$WP_PATH/wp-config.php" <<PHP
<?php
define('DB_NAME',     '${WORDPRESS_DB_NAME}');
define('DB_USER',     '${WORDPRESS_DB_USER}');
define('DB_PASSWORD', '${WORDPRESS_DB_PASSWORD}');
define('DB_HOST',     '${WORDPRESS_DB_HOST}');
define('DB_CHARSET',  'utf8mb4');
define('DB_COLLATE',  '');

\$table_prefix = 'wp_';

define('WP_DEBUG',         true);
define('WP_DEBUG_LOG',     true);
define('WP_DEBUG_DISPLAY', false);

$(printf "$KEYS")

if (!defined('ABSPATH')) define('ABSPATH', __DIR__ . '/');
require_once ABSPATH . 'wp-settings.php';
PHP
chown www-data:www-data "$WP_PATH/wp-config.php"

mkdir -p "$WP_PATH/wp-content/uploads"
chown www-data:www-data "$WP_PATH/wp-content/uploads"

log "Running wp core install..."
wp core install \
  --url="$SITE_URL" \
  --title="$SITE_TITLE" \
  --admin_user="$ADMIN_USER" \
  --admin_password="$ADMIN_PASS" \
  --admin_email="$ADMIN_EMAIL" \
  --skip-email \
  --allow-root || log "wp core install failed (may already be installed)"

log "Activating velora-club-widgets..."
wp plugin activate velora-club-widgets --allow-root || true

log "Pre-filling plugin settings..."
wp option update velora_club_api_base "http://localhost:4000" --allow-root || true
wp option update velora_club_profile_base "http://localhost:5173" --allow-root || true
wp option update velora_club_default_slug "$CLUB_SLUG" --allow-root || true
wp option update velora_club_locale "pl" --allow-root || true

log "Creating pages..."
wp post create --post_type=page --post_title="O klubie" --post_status=publish --post_content="[velora-club-about]" --allow-root || true
wp post create --post_type=page --post_title="Nasi hodowcy" --post_status=publish --post_content="[velora-club-breeders]" --allow-root || true
wp post create --post_type=page --post_title="Galeria" --post_status=publish --post_content="<p>Galeria klubu — wystawy, zjazdy, archiwum.</p>
[velora-club-gallery]" --allow-root || true
wp post create --post_type=page --post_title="Aktualności" --post_status=publish --post_content="[velora-club-posts]" --allow-root || true
wp post create --post_type=page --post_title="Wystawy i pokazy" --post_status=publish --post_content="<p>Najbliższe wystawy organizowane przez nasz klub.</p>
[velora-club-events]" --allow-root || true
wp post create --post_type=page --post_title="Oferta hodowców" --post_status=publish --post_content="<p>Aktualne ogłoszenia naszych hodowców.</p>
[velora-club-listings]" --allow-root || true
wp post create --post_type=page --post_title="Dokumenty" --post_status=publish --post_content="<p>Regulaminy, formularze i statut do pobrania.</p>
[velora-club-documents]" --allow-root || true
wp post create --post_type=page --post_title="Kontakt" --post_status=publish --post_content="<p>Masz pytania? Skorzystaj z formularza — wiadomość trafi do właściwego działu.</p>
[velora-club-contact]" --allow-root || true

wp option update permalink_structure '/%postname%/' --allow-root || true

touch "$WP_PATH/.velora-bootstrapped"
log "Bootstrap complete. Admin: $SITE_URL/wp-admin  user: $ADMIN_USER  pass: $ADMIN_PASS"
log "Club slug configured: $CLUB_SLUG"
