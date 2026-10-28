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

### Content language

Events, posts, listings and the profile description can exist in several
language versions. The routes that serve them take an optional `lang` query
parameter (two-letter ISO 639-1 code; anything else is answered with `400`):
`/v1/{breeders,clubs}/:slug`, `/v1/{breeders,clubs}/:slug/{events,posts,listings}`
and `/v1/public/{events,listings}`.

- The plugin publishes the site's language (`get_locale()`, e.g. `de_DE` ->
  `de`; locales without a two-letter code, such as `fil`, publish nothing) to
  the embed as `contentLang`, and the embed appends `lang=<contentLang>` to
  those requests. This is separate from the plugin's own `locale` setting
  (Polish/English), which only sets the widget's labels.
- When `contentLang` is absent, no `lang` is sent and the API falls back to the
  visitor's `Accept-Language` header.
- The version shown is chosen in this order: the site's language, then English,
  then the author's original.
- The base fields (`title`, `description`, `content`, ...) always carry the
  original. For events, posts and listings the response adds
  `localized: { language, <same fields> }` and `availableLanguages: string[]`.
  A field the chosen version has no text for is `null` there, and the original
  is shown.
- A profile (`/v1/{breeders,clubs}/:slug`) groups its fields, so the description
  is read from `localizedGroups.profile.localized.description` (with
  `localizedGroups.profile.availableLanguages`), not from a top-level `localized`.
  The profile name is not translated.
- Widgets show the version's text where there is one, else the base field, and
  set `lang` on the element only when the text really came from the version.

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
