=== Velora Club Widgets ===
Contributors:      velorapet
Tags:              club, federation, cattery, kennel, pedigree
Requires at least: 6.0
Tested up to:      7.0
Requires PHP:      7.4
Stable tag:        1.2.0
License:           GPLv2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Embed your Velora breeder club content on WordPress — member breeders list, photo gallery, documents, events, posts, and a contact form.

== Description ==

**Velora Club Widgets** turns your WordPress club website into a synced front-end for your Velora club account. Update once in Velora; your member list, downloadable forms and event calendar appear automatically on the public site.

= What's included =

* **About** — club header with logo, location, founded year, contacts, social links
* **Member breeders** — filterable, sortable list (table for more than 20 entries, cards for smaller clubs)
* **Gallery** — photo albums from your Velora profile
* **Listings** — kittens or puppies for sale from all member breeders aggregated
* **Posts** — your latest club news
* **Events** — exhibitions, shows and meetings (with upcoming / past filter)
* **Documents** — regulations, application forms, statute, fee schedules — grouped by category
* **Contact form** — delivers the visitor's message to your club's Velora inbox
* **Club members' area** — a short sign-in panel that sends your members to their own Velora account

All widgets are theme-neutral — they pick up your WordPress theme's typography and colors automatically.

= How it works =

1. Install and activate.
2. Go to **Velora Club → Settings**, paste your API key (from Velora → Settings → Developers).
3. Set your default club slug.
4. Add shortcodes to pages:

`[velora-club-about]`
`[velora-club-breeders]`
`[velora-club-gallery]`
`[velora-club-listings]`
`[velora-club-posts]`
`[velora-club-events]`
`[velora-club-documents]`
`[velora-club-contact]`
`[velora-club-member-area]`

Most shortcodes accept optional `slug=`, `limit=`, `theme="auto|light|dark"`. Exceptions: `[velora-club-about]` and `[velora-club-contact]` do not accept `limit=`; `[velora-club-member-area]` accepts neither `slug=` nor `limit=` — it shows no club data, so it takes only `heading=`, `text=` and `theme=`; `[velora-club-breeders]` also accepts `layout="auto|cards|table"`; `[velora-club-gallery]` uses `photos_per_album=` instead of `limit=`; `[velora-club-events]` also accepts `when="upcoming|past|all"` and `show_filter="true|false"` and `show_poster="true|false"`.

= Migrating from a manually-maintained breeder list =

If your current site has a static table of member breeders that someone updates by hand, replace it with `[velora-club-breeders]` and let it sync from Velora forever. Same applies to documents, events and contact forms.

= External services =

This plugin connects to Velora's cloud services to display your club profile and to deliver contact form messages. The JavaScript that renders the widgets (`assets/embed.js`) ships inside the plugin and loads from your own WordPress site — it is never fetched from velora.pet.

**Velora API (read access)**
What: fetches your club profile, member breeders, gallery, listings, posts, events and documents.
When: every time a page containing a Velora shortcode is loaded, from the visitor's browser.
Data sent: only the club slug configured in the shortcode/settings — no visitor data.
Endpoint: the API base configured in plugin settings (defaults to `https://velora.pet`), e.g. `https://velora.pet/v1/clubs/{slug}/breeders`. Public, no authentication required.

**Velora image CDN (`images.velora.pet`)**
What: delivers the photos shown in the Member breeders, Gallery, Listings and Events widgets.
When: whenever a widget with images renders in the visitor's browser.

**Cap.js anti-spam challenge (part of the Velora API)**
What: a proof-of-work CAPTCHA that protects the contact form from automated submissions. No third-party account or sitekey is involved.
When: a challenge is requested when the contact form widget loads (`{apiBase}/v1/captcha/challenge`), and the solved token is verified when the visitor submits the form (`{apiBase}/v1/captcha/redeem`).

**Contact form submission**
What: delivers the visitor's message to your Velora inbox.
When: when a visitor submits the `[velora-club-contact]` form.
How: the visitor's browser POSTs to a REST route registered by this plugin on your own WordPress site. Your WordPress server then forwards the request server-side to the Velora API together with your API key (stored in `wp_options`, never sent to the browser) and the visitor's IP address (`X-Forwarded-For`, used for anti-spam rate limiting).
Data sent: name, email, phone (optional), subject, message, the CAPTCHA token, and the visitor's IP address.

By installing this plugin you agree that this data is exchanged with Velora (velora.pet) per its Privacy Policy and Terms of Service:
* Privacy: https://velora.pet/privacy
* Terms: https://velora.pet/terms

A consent checkbox is mandatory on the contact form before it can be submitted.

= Anti-spam and rate limiting =

The contact form is protected by a Cap.js proof-of-work challenge, a hidden honeypot field, and a limit of five submissions per hour per visitor IP address.

That IP address is the one your own web server saw (`REMOTE_ADDR`). Proxy headers such as `X-Forwarded-For` and `CF-Connecting-IP` are **ignored by default**: any visitor can set them, and rotating them would hand out a fresh rate-limit allowance on every request. If your site genuinely sits behind Cloudflare or another reverse proxy that overwrites those headers, opt in from your theme or a small mu-plugin:

`add_filter( 'velora_club_trust_proxy_headers', '__return_true' );`

Only enable it when the proxy is guaranteed to overwrite the headers — otherwise the limit goes back to being set by the visitor.

= Source of the bundled JavaScript and WebAssembly =

`assets/embed.js` is a single-file bundle produced from this plugin's TypeScript source with Vite. It is deliberately left unminified — variable names, function names, comments and structure are preserved — so the shipped code satisfies the requirement that plugin code be human-readable. `assets/embed.css` is built the same way.

`assets/cap_wasm_bg.wasm` is the CAPTCHA's proof-of-work solver, compiled from Rust. It ships inside the plugin on purpose: the upstream widget would otherwise download it from a public CDN onto your visitors' browsers, and a plugin must not load code from servers outside WordPress.org. It is the unmodified `browser/cap_wasm_bg.wasm` file from the `@cap.js/wasm` npm package; its Rust source ships in that same package and is public at https://github.com/tiagorangel1/cap.

= Third-party library licenses =

The bundle includes `@cap.js/widget` and `@cap.js/wasm` — Cap, by Tiago Rangel, https://github.com/tiagorangel1/cap — both licensed under the Apache License 2.0. Apache-2.0 is compatible with this plugin's "GPLv2 or later" license: the "or later" clause lets a recipient use the combined work under GPLv3, which is Apache-2.0 compatible.

The Cap widget draws a small "Secured by Cap" badge linking to its own website, and offers no setting to turn it off. This plugin hides that badge with CSS, because the WordPress plugin directory requires any credit shown on a visitor-facing page to be optional and off by default. Apache-2.0 permits the change; the credit is given here instead.

== Installation ==

1. Upload the `velora-club-widgets` folder to `/wp-content/plugins/`, or install via the WordPress plugin directory.
2. Activate.
3. **Velora Club → Settings**: paste API key, set club slug, choose language.
   The **Show "Powered by Velora" link** option is off by default — tick it only if you want a small credit link under each widget on your public pages.
4. Add shortcodes to your pages.

== Frequently Asked Questions ==

= Do I need a Velora account? =

Yes — your club must have a profile at https://velora.pet/.

= Can I show only upcoming events? =

Yes. Use `[velora-club-events when="upcoming"]` (this is the default). For an archive page use `when="past"`. Set `show_filter="false"` to hide the toolbar. Upcoming events show the poster of the nearest event with an image above the list; set `show_poster="false"` to turn that off.

= How do my members sign in? =

Add `[velora-club-member-area]` to a page — usually "For members" or similar. It renders a short explanation of what Velora is and a button that opens the Velora sign-in page in a new browser window, so your club page stays open behind it. There are also links for members who have no account yet and for a forgotten password.

The panel is plain static text and links: it contacts no server, needs no API key and works even before you have configured one. Reword the heading and the paragraph with `heading="…"` and `text="…"`, or in the block editor's sidebar.

= Will widgets match my club website's branding? =

Yes — they use `color: inherit` and CSS custom properties so they pick up your WordPress theme's colors. Force a specific palette with `theme="light"` or `theme="dark"`.

== Changelog ==

= 1.2.0 =
* The events widget shows the poster of the nearest upcoming event above the list, whole and uncropped. It picks the earliest event that has a poster and is not over yet, and links to its page on Velora.
* New `show_poster="true|false"` attribute (and a block setting) to turn the poster off. Default: on.

= 1.1.0 =
* New widget: **Club members' area** (`[velora-club-member-area]` and a matching block) — a static sign-in panel that explains what Velora is and points members at their own account. Makes no API request and loads no JavaScript.
* Editable heading and text, so each club can word the invitation in its own voice.
* Links to the portal open in a new window and announce that to screen readers.

= 1.0.0 =
* Initial public release on the WordPress.org plugin directory.
* Eight widgets: about, member breeders (table + cards), gallery, listings, posts, events (with upcoming/past filter), documents (categorized), contact.
* Theme-neutral CSS — widgets inherit the host site's colors and typography automatically.
* Anti-spam protection on the contact form: Cap.js proof-of-work CAPTCHA (no third-party account required) plus a honeypot field.
* Contact form is submitted through a server-side proxy on your own WordPress site — your Velora API key never reaches the visitor's browser.

== Upgrade Notice ==

= 1.2.0 =
The events widget now shows the next event's poster above the list. Add show_poster="false" to the shortcode to keep the old look.

= 1.1.0 =
Adds the Club members' area panel. Nothing existing changes.

= 1.0.0 =
First public release on the WordPress.org plugin directory.
