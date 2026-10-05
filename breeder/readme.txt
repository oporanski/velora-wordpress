=== Velora Breeder Widgets ===
Contributors:      velorapet
Tags:              cattery, kennel, breeder, pedigree, pets
Requires at least: 6.0
Tested up to:      7.0
Requires PHP:      7.4
Stable tag:        1.0.0
License:           GPLv2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Embed live content from your Velora cattery or kennel profile on your WordPress site — animals, photo gallery, listings, posts, contact form.

== Description ==

**Velora Breeder Widgets** lets you keep your WordPress website synced with your Velora breeder profile in real time. No more duplicate editing — update your animals, gallery and posts once in Velora, and they appear automatically on your site.

= What's included =

* **Profile / About** — header with logo, breeds, location, founded year, contacts, social links
* **Animals** — grid of your breeding animals with titles and coat color
* **Gallery** — photo albums from your Velora profile
* **Listings** — active marketplace listings (kittens or puppies you're placing)
* **Posts** — your latest blog posts pulled from Velora
* **Events** — shows and exhibitions you take part in (with upcoming / past filter)
* **Contact form** — messages are delivered to your Velora inbox

All widgets are theme-neutral — they inherit your WordPress theme's colors and typography automatically. No clashing palette issues.

= Privacy =

Litter data (planned matings, expected dates, kitten counts before placement) is **never** exposed by this plugin. That information stays inside your Velora panel where you decide who sees it.

= How it works =

1. Install and activate.
2. Go to **Velora Breeder → Settings**, paste your API key (generated in Velora → Settings → Developers).
3. Set your default breeder slug.
4. Use the shortcodes on any page or post:

`[velora-breeder-about]`
`[velora-breeder-animals]`
`[velora-breeder-gallery]`
`[velora-breeder-listings]`
`[velora-breeder-posts]`
`[velora-breeder-events]`
`[velora-breeder-contact]`

Most shortcodes accept optional `slug=`, `limit=`, `theme="auto|light|dark"`. Exceptions: `[velora-breeder-about]` and `[velora-breeder-contact]` do not accept `limit=`; `[velora-breeder-gallery]` uses `photos_per_album=` instead of `limit=`; `[velora-breeder-events]` also accepts `when="upcoming|past|all"` and `show_filter="true|false"`.

= External services =

This plugin connects to Velora's cloud services to display your breeder profile and to deliver contact form messages. The JavaScript that renders the widgets (`assets/embed.js`) ships inside the plugin and loads from your own WordPress site — it is never fetched from velora.pet.

**Velora API (read access)**
What: fetches your breeder profile, animals, gallery, listings, posts and events.
When: every time a page containing a Velora shortcode is loaded, from the visitor's browser.
Data sent: only the breeder slug configured in the shortcode/settings — no visitor data.
Endpoint: the API base configured in plugin settings (defaults to `https://velora.pet`), e.g. `https://velora.pet/v1/breeders/{slug}/animals`. Public, no authentication required.

**Velora image CDN (`images.velora.pet`)**
What: delivers the photos shown in the Animals, Gallery and Events widgets.
When: whenever a widget with images renders in the visitor's browser.

**Cap.js anti-spam challenge (part of the Velora API)**
What: a proof-of-work CAPTCHA that protects the contact form from automated submissions. No third-party account or sitekey is involved.
When: a challenge is requested when the contact form widget loads (`{apiBase}/v1/captcha/challenge`), and the solved token is verified when the visitor submits the form (`{apiBase}/v1/captcha/redeem`).

**Contact form submission**
What: delivers the visitor's message to your Velora inbox.
When: when a visitor submits the `[velora-breeder-contact]` form.
How: the visitor's browser POSTs to a REST route registered by this plugin on your own WordPress site. Your WordPress server then forwards the request server-side to the Velora API together with your API key (stored in `wp_options`, never sent to the browser) and the visitor's IP address (`X-Forwarded-For`, used for anti-spam rate limiting).
Data sent: name, email, phone (optional), subject, message, the CAPTCHA token, and the visitor's IP address.

By installing this plugin you agree that this data is exchanged with Velora (velora.pet) per its Privacy Policy and Terms of Service:
* Privacy: https://velora.pet/privacy
* Terms: https://velora.pet/terms

A consent checkbox is mandatory on the contact form before it can be submitted.

= Anti-spam and rate limiting =

The contact form is protected by a Cap.js proof-of-work challenge, a hidden honeypot field, and a limit of five submissions per hour per visitor IP address.

That IP address is the one your own web server saw (`REMOTE_ADDR`). Proxy headers such as `X-Forwarded-For` and `CF-Connecting-IP` are **ignored by default**: any visitor can set them, and rotating them would hand out a fresh rate-limit allowance on every request. If your site genuinely sits behind Cloudflare or another reverse proxy that overwrites those headers, opt in from your theme or a small mu-plugin:

`add_filter( 'velora_breeder_trust_proxy_headers', '__return_true' );`

Only enable it when the proxy is guaranteed to overwrite the headers — otherwise the limit goes back to being set by the visitor.

= Source of the bundled JavaScript and WebAssembly =

`assets/embed.js` is a single-file bundle produced from this plugin's TypeScript source with Vite. It is deliberately left unminified — variable names, function names, comments and structure are preserved — so the shipped code satisfies the requirement that plugin code be human-readable. `assets/embed.css` is built the same way.

`assets/cap_wasm_bg.wasm` is the CAPTCHA's proof-of-work solver, compiled from Rust. It ships inside the plugin on purpose: the upstream widget would otherwise download it from a public CDN onto your visitors' browsers, and a plugin must not load code from servers outside WordPress.org. It is the unmodified `browser/cap_wasm_bg.wasm` file from the `@cap.js/wasm` npm package; its Rust source ships in that same package and is public at https://github.com/tiagorangel1/cap.

= Third-party library licenses =

The bundle includes `@cap.js/widget` and `@cap.js/wasm` — Cap, by Tiago Rangel, https://github.com/tiagorangel1/cap — both licensed under the Apache License 2.0. Apache-2.0 is compatible with this plugin's "GPLv2 or later" license: the "or later" clause lets a recipient use the combined work under GPLv3, which is Apache-2.0 compatible.

The Cap widget draws a small "Secured by Cap" badge linking to its own website, and offers no setting to turn it off. This plugin hides that badge with CSS, because the WordPress plugin directory requires any credit shown on a visitor-facing page to be optional and off by default. Apache-2.0 permits the change; the credit is given here instead.

== Installation ==

1. Upload the `velora-breeder-widgets` folder to `/wp-content/plugins/`, or install via the WordPress plugin directory.
2. Activate the plugin through the **Plugins** menu.
3. Open **Velora Breeder** in the admin sidebar and configure:
   * **API base URL** — typically `https://velora.pet`
   * **Default breeder slug** — your cattery / kennel slug
   * **API key** — generate in Velora panel under Developers
   * **Language** — Polish or English
   * **Show "Powered by Velora" link** — off by default; tick it only if you want a small credit link under each widget on your public pages
4. Add shortcodes to your pages.

== Frequently Asked Questions ==

= Do I need a Velora account? =

Yes. The plugin embeds content from your Velora breeder profile, so you need an active profile at https://velora.pet/.

= Are the read-only widgets free? =

The animals, gallery, listings, posts and events widgets work without any API key — they read public profile data.

= Why does the contact form need an API key? =

The API key authenticates your WordPress site so incoming messages are tied to your breeder profile in Velora. Generate it in Velora → Settings → Developers; it's free.

= Will the widgets match my theme's colors? =

Yes. The widgets use `currentColor` and CSS custom properties so they inherit text color, backgrounds and typography from your active theme. Optional `theme="light"` or `theme="dark"` attributes override this.

= Where does the data live? =

Data shown by the widgets lives in your Velora account and is fetched via the Velora API every time a visitor loads the page — the plugin does not cache responses.

== Changelog ==

= 1.0.0 =
* Initial public release on the WordPress.org plugin directory.
* Seven widgets: about, animals, gallery, listings, posts, events (with upcoming/past filter), contact.
* Theme-neutral CSS — widgets inherit the host site's colors and typography automatically.
* Anti-spam protection on the contact form: Cap.js proof-of-work CAPTCHA (no third-party account required) plus a honeypot field.
* Contact form is submitted through a server-side proxy on your own WordPress site — your Velora API key never reaches the visitor's browser.

== Upgrade Notice ==

= 1.0.0 =
First public release on the WordPress.org plugin directory.
