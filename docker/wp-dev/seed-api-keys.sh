#!/usr/bin/env bash
# Generates Velora API keys for the dev WP sites and writes them into each WP's options table.
# Uses the backend's ApiKeysService via a direct Prisma seed INSIDE the backend container,
# then uses wp-cli in each WP container to store the key.
#
# Requires: the Velora PORTAL backend stack running (`make up` in the portal checkout —
# backend + postgres reachable as the velora-backend container on the docker_default network).
# This repository does not contain the backend; it only consumes its API.

set -euo pipefail

BREEDER_SLUG="${VELORA_BREEDER_SLUG:-royal-whiskers-cattery}"
CLUB_SLUG="${VELORA_CLUB_SLUG:-klub-hodowcow-elitarnych}"

log() { echo "[seed-api-keys] $*"; }

# Tiny Node script that uses Prisma (already installed in backend container)
# to generate a new API key for a given org and print "vk_live_..." to stdout.
generate_key() {
  local org_type="$1"   # BREEDER | CLUB
  local slug="$2"
  local name="$3"

  docker exec -i velora-backend node -e "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    (async () => {
      const db = new PrismaClient();
      const orgType = '$org_type';
      const slug = '$slug';
      const org = orgType === 'BREEDER'
        ? await db.breeder.findUnique({ where: { slug } })
        : await db.club.findUnique({ where: { slug } });
      if (!org) { console.error('ORG_NOT_FOUND'); process.exit(1); }

      const admin = await db.user.findUnique({ where: { email: 'portaladmin@velora.pet' } });
      if (!admin) { console.error('ADMIN_NOT_FOUND'); process.exit(1); }

      // Deactivate previous dev keys with the same name for idempotency.
      await db.apiKey.updateMany({
        where: { name: '$name', OR: [{ breederId: org.id }, { clubId: org.id }] },
        data: { isActive: false },
      });

      const random = crypto.randomBytes(24).toString('base64url').slice(0, 32);
      const fullKey = 'vk_live_' + random;
      const prefix = fullKey.slice(0, 16);
      const hash = await bcrypt.hash(fullKey, 10);

      await db.apiKey.create({
        data: {
          name: '$name',
          keyPrefix: prefix,
          keyHash: hash,
          orgType,
          breederId: orgType === 'BREEDER' ? org.id : null,
          clubId: orgType === 'CLUB' ? org.id : null,
          createdById: admin.id,
          scopes: ['READ_PUBLIC', 'WRITE_CONTACT'],
          // Deliberately empty = allow any origin. The same key serves the
          // plain-HTML pages on :8083, where the key sits in the browser and the
          // browser does send an Origin -- pinning the key to :8081 makes those
          // pages answer 403 Origin-not-allowed. The WordPress sites themselves
          // no longer care: since 2026-09-11 the gateway lets through a request
          // carrying no Origin at all, which is the server-to-server case the
          // plugin uses (wp_remote_post). Do not tighten this back.
          // No double quotes, backticks or $ in this comment: the whole script
          // is nested inside a double-quoted bash string passed to node -e.
          allowedOrigins: [],
          isActive: true,
        },
      });
      process.stdout.write(fullKey);
      await db.\$disconnect();
    })().catch(e => { console.error(e.message); process.exit(2); });
  " 2>/dev/null
}

log "Generating BREEDER key for $BREEDER_SLUG..."
BREEDER_KEY=$(generate_key BREEDER "$BREEDER_SLUG" "WP dev — breeder")
if [[ -z "$BREEDER_KEY" || "$BREEDER_KEY" == *"NOT_FOUND"* ]]; then
  log "Failed to generate breeder key. Is 'make up' running and seed data loaded?"
  exit 1
fi
log "  → ${BREEDER_KEY:0:16}… (hidden)"

log "Generating CLUB key for $CLUB_SLUG..."
CLUB_KEY=$(generate_key CLUB "$CLUB_SLUG" "WP dev — club")
if [[ -z "$CLUB_KEY" || "$CLUB_KEY" == *"NOT_FOUND"* ]]; then
  log "Failed to generate club key."
  exit 1
fi
log "  → ${CLUB_KEY:0:16}… (hidden)"

log "Writing breeder key into velora-wp-breeder..."
docker exec velora-wp-breeder wp option update velora_breeder_api_key "$BREEDER_KEY" --allow-root >/dev/null

log "Writing club key into velora-wp-club..."
docker exec velora-wp-club wp option update velora_club_api_key "$CLUB_KEY" --allow-root >/dev/null

log "Done. Contact forms should now submit successfully on:"
log "  http://localhost:8081/kontakt/  (breeder)"
log "  http://localhost:8082/kontakt/  (club)"
