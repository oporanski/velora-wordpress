# How these plugins relate to the Velora portal

For the developer who, six months from now, wonders why this repository still
knows anything about another one. State: 2026-10-05, just after the split.

- **This repository** (`velora-wordpress`) — two WordPress plugins and the
  JavaScript bundle they share. Public, GPL v2.
- **The portal** (`velora.pet`) — the service whose content the plugins embed.

There is **no code dependency** between them. Everything below is an operational
one.

## 1. The public API is the only runtime dependency

The plugins have no backend of their own. Everything they display comes from the
portal's public gateway:

- default base: `https://velora.pet`, configurable per site (options
  `velora_{breeder,club}_api_base`); the same gateway also answers on
  `https://api.velora.pet`;
- paths: `/v1/breeders/:slug/…`, `/v1/clubs/:slug/…`, `/v1/captcha/…`;
- **reads** (animals, listings, gallery, events) are made **from the visitor's
  browser** and need no key;
- a **contact-form submission** is made **from the site's server**
  (`wp_remote_post`) with a `vk_live_…` key in the `Authorization` header, so
  the key never reaches a browser.

**Consequence:** changing the shape of a `/v1/*` response breaks the plugins,
and this repository has no way to know. The contract is unwritten — treat
`core/src/api-client.ts` as its specification.

One widget is deliberately outside that dependency: the club plugin's members'
area (`[velora-club-member-area]`) is static markup with links to the portal's
`/login`, `/register` and `/forgot-password` pages. It calls no API, mounts
nothing for `embed.js` and loads only the stylesheet — so it keeps working on a
site whose API key was never configured. What it does depend on is those three
routes continuing to exist, plus `/my-panels` as the post-login destination.

## 2. Releases go through WordPress.org, not through velora.pet

`make wp-package` builds a distribution ZIP per plugin into `dist/`. Those ZIPs
are a **convenience download** linked from the portal's help page. They are
**not** an update channel, and publishing one does not release anything.

The release channel is the WordPress.org SVN repository (`trunk/` plus a tag per
version). A plugin in the directory is updated by the directory.

## 3. What the plugins deliberately cannot do

- **No self-update mechanism.** `Velora_Base_Updater` and `update-manifest.json`
  were removed when the plugins were prepared for the directory: guideline 8
  forbids a hosted plugin updating itself from outside, and Plugin Check has a
  dedicated rule for it (`plugin_updater_detected`). Restoring either means
  rejection.
- **No access to the portal's database.** The plugins see exactly what `/v1/*`
  exposes and nothing else. A breeder's operational data — litters, planned
  matings — is not there, and must never be put there.
- **No shared dependencies.** This repository installs its own npm and Composer
  packages; nothing is hoisted from anywhere else.

## 4. Running the plugins against real data

Point the plugin's API base at `https://velora.pet` (the default) and the
widgets work against production data immediately. A local portal is only needed
to exercise the contact form end to end, which requires an API key.
