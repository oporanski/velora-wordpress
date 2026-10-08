<?php
/**
 * @package VeloraClubWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}

class Velora_Club_Plugin extends Velora_Club_Base_Plugin
{
    const OPTION_API_BASE     = 'velora_club_api_base';
    const OPTION_PROFILE_BASE = 'velora_club_profile_base';
    const OPTION_API_KEY      = 'velora_club_api_key';
    const OPTION_DEFAULT_SLUG = 'velora_club_default_slug';
    const OPTION_LOCALE       = 'velora_club_locale';
    const OPTION_SHOW_CREDIT  = 'velora_club_show_credit';

    // -----------------------------------------------------------------------
    // Identity — abstract method implementations
    // -----------------------------------------------------------------------

    protected static function option_group(): string
    {
        return 'velora_club';
    }

    protected static function text_domain(): string
    {
        return 'velora-club-widgets';
    }

    protected static function asset_handle(): string
    {
        return 'velora-club-embed-core';
    }

    protected static function config_global_name(): string
    {
        return 'VeloraClubEmbedConfig';
    }

    protected static function menu_title(): string
    {
        return __('Velora Club', 'velora-club-widgets');
    }

    protected static function menu_slug(): string
    {
        return 'velora-club';
    }

    protected static function menu_icon(): string
    {
        return 'dashicons-groups';
    }

    protected static function menu_priority(): int
    {
        return 31;
    }

    protected static function plugin_dir(): string
    {
        return VELORA_CLUB_PLUGIN_DIR;
    }

    protected static function plugin_url(): string
    {
        return VELORA_CLUB_PLUGIN_URL;
    }

    protected static function plugin_version(): string
    {
        return VELORA_CLUB_PLUGIN_VERSION;
    }

    protected static function contact_proxy_namespace(): string
    {
        return 'velora-club/v1';
    }

    protected static function admin_hook(): string
    {
        return 'toplevel_page_velora-club';
    }

    protected static function admin_script_handle(): string
    {
        return 'velora-club-admin-test';
    }

    protected static function option_api_base(): string
    {
        return self::OPTION_API_BASE;
    }

    protected static function option_profile_base(): string
    {
        return self::OPTION_PROFILE_BASE;
    }

    protected static function option_api_key(): string
    {
        return self::OPTION_API_KEY;
    }

    protected static function option_default_slug(): string
    {
        return self::OPTION_DEFAULT_SLUG;
    }

    protected static function option_locale(): string
    {
        return self::OPTION_LOCALE;
    }

    protected static function option_show_credit(): string
    {
        return self::OPTION_SHOW_CREDIT;
    }

    protected static function admin_test_config(): array
    {
        return [
            'fieldIds' => [
                'apiBase' => self::OPTION_API_BASE,
                'slug'    => self::OPTION_DEFAULT_SLUG,
                'apiKey'  => self::OPTION_API_KEY,
            ],
            'i18n' => [
                'testing' => __('Checking connection…', 'velora-club-widgets'),
                /* translators: %s is the club name returned by the Velora API. */
                'success' => __('Connected. Club: %s', 'velora-club-widgets'),
                /* translators: %s is the club name returned by the Velora API. */
                'connectedNoKey'            => __('Club "%s" found, but no API key was entered — the contact form needs one and was not checked.', 'velora-club-widgets'),
                /* translators: %s is the club slug entered in the settings form. */
                'slugNotFound'              => __('Slug "%s" does not exist. Check the spelling (compare it with the club profile URL in Velora).', 'velora-club-widgets'),
                'invalidApiKey'             => __('The API key was rejected. Copy it again from the Velora panel, under Developers.', 'velora-club-widgets'),
                /* translators: %s is the club slug entered in the settings form. */
                'keyOrgMismatch'            => __('This API key belongs to a different organisation than "%s".', 'velora-club-widgets'),
                'invalidApiBase'            => __('"API base URL" must be a full http:// or https:// address.', 'velora-club-widgets'),
                'apiUnreachable'            => __('The API server is not responding — check "API base URL".', 'velora-club-widgets'),
                'unexpectedResponse'        => __('The server returned an unexpected response — check that "API base URL" points to the Velora API.', 'velora-club-widgets'),
                'networkError'              => __('Network error', 'velora-club-widgets'),
                'missingApiBase'            => __('Enter the "API base URL".', 'velora-club-widgets'),
                'missingSlug'               => __('Enter the "Default club slug".', 'velora-club-widgets'),
            ],
        ];
    }

    protected static function register_shortcodes(): void
    {
        add_shortcode('velora-club-about',     [self::class, 'shortcode_about']);
        add_shortcode('velora-club-breeders',  [self::class, 'shortcode_breeders']);
        add_shortcode('velora-club-contact',   [self::class, 'shortcode_contact']);
        add_shortcode('velora-club-events',    [self::class, 'shortcode_events']);
        add_shortcode('velora-club-listings',  [self::class, 'shortcode_listings']);
        add_shortcode('velora-club-posts',     [self::class, 'shortcode_posts']);
        add_shortcode('velora-club-documents', [self::class, 'shortcode_documents']);
        add_shortcode('velora-club-gallery',   [self::class, 'shortcode_gallery']);
        add_shortcode('velora-club-member-area', [self::class, 'shortcode_member_area']);
    }

    // -----------------------------------------------------------------------
    // Helpers for the static members' area block
    // -----------------------------------------------------------------------

    /**
     * Public portal base URL for member-facing links, with no trailing slash.
     *
     * Reuses the option the embed bundle already uses for profile links, so a
     * site pointed at a staging portal keeps every link consistent. The option
     * is sometimes stored as an empty string (a settings page saved while the
     * field was absent), hence the explicit empty check next to the default:
     * get_option()'s default only covers a missing option, not an empty one.
     * rtrim() keeps a configured "https://velora.pet/" from producing "//login".
     */
    private static function portal_base(): string
    {
        $base = (string) get_option(self::OPTION_PROFILE_BASE, '');

        return rtrim($base !== '' ? $base : 'https://velora.pet', '/');
    }

    /**
     * Enqueues the stylesheet only, deliberately leaving the bundle alone.
     *
     * The members' area is static markup: it carries no data-velora-widget
     * mount point, so embed.js would find nothing to hydrate and its CAPTCHA
     * wasm payload would be pure dead weight on the page. The stylesheet is
     * still needed — the markup is built from the shared .velora-w tokens.
     *
     * Mirrors ensure_assets_enqueued() in the base class minus the script.
     */
    private static function ensure_styles_only(): void
    {
        $handle = static::asset_handle();
        if (!wp_style_is($handle, 'enqueued')) {
            wp_enqueue_style($handle);
        }
    }

    /**
     * Builds one portal link that opens in a new browser window.
     *
     * target="_blank" without rel="noopener" hands the opened page a usable
     * window.opener reference, so both always travel together here. The hidden
     * suffix is what tells a screen-reader user the link leaves this page —
     * the new window is otherwise announced by nothing at all.
     */
    private static function portal_link(string $url, string $label, string $class): string
    {
        return '<a class="' . esc_attr($class) . '" href="' . esc_url($url) . '"'
            . ' target="_blank" rel="noopener noreferrer">'
            . esc_html($label)
            . '<span class="velora-sr-only"> '
            . esc_html(__('(opens in a new window)', 'velora-club-widgets'))
            . '</span></a>';
    }

    /** Maps the theme attribute onto the explicit-theme class, if any. */
    private static function theme_class(string $theme): string
    {
        if ($theme === 'light') {
            return ' velora-w-explicit-light';
        }
        if ($theme === 'dark') {
            return ' velora-w-explicit-dark';
        }

        return '';
    }

    // -----------------------------------------------------------------------
    // Shortcode handlers
    // -----------------------------------------------------------------------

    public static function shortcode_about($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'theme' => 'auto',
        ], $atts, 'velora-club-about');

        self::ensure_assets_enqueued();

        return self::widget_markup('about', [
            'data-source' => 'clubs',
            'data-slug'   => $atts['slug'],
            'data-theme'  => $atts['theme'],
        ]);
    }

    public static function shortcode_breeders($atts): string
    {
        $atts = shortcode_atts([
            'slug'   => static::default_slug(),
            'limit'  => 200,
            'layout' => 'auto', // auto | cards | table
            'theme'  => 'auto',
        ], $atts, 'velora-club-breeders');

        self::ensure_assets_enqueued();

        return self::widget_markup('club-breeders', [
            'data-club'   => $atts['slug'],
            'data-limit'  => (string) intval($atts['limit']),
            'data-layout' => $atts['layout'],
            'data-theme'  => $atts['theme'],
        ]);
    }

    public static function shortcode_contact($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'theme' => 'auto',
        ], $atts, 'velora-club-contact');

        self::ensure_assets_enqueued();

        return self::widget_markup('club-contact', [
            'data-club'  => $atts['slug'],
            'data-theme' => $atts['theme'],
        ]);
    }

    public static function shortcode_events($atts): string
    {
        $atts = shortcode_atts([
            'slug'        => static::default_slug(),
            'limit'       => 12,
            'when'        => 'upcoming',
            'show_filter' => 'true',
            'show_poster' => 'true',
            'theme'       => 'auto',
        ], $atts, 'velora-club-events');

        self::ensure_assets_enqueued();

        return self::widget_markup('events', [
            'data-source'      => 'clubs',
            'data-slug'        => $atts['slug'],
            'data-limit'       => (string) intval($atts['limit']),
            'data-when'        => $atts['when'],
            'data-show-filter' => $atts['show_filter'],
            'data-show-poster' => $atts['show_poster'],
            'data-theme'       => $atts['theme'],
        ]);
    }

    public static function shortcode_listings($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'limit' => 24,
            'theme' => 'auto',
        ], $atts, 'velora-club-listings');

        self::ensure_assets_enqueued();

        return self::widget_markup('listings', [
            'data-source' => 'clubs',
            'data-slug'   => $atts['slug'],
            'data-limit'  => (string) intval($atts['limit']),
            'data-theme'  => $atts['theme'],
        ]);
    }

    public static function shortcode_posts($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'limit' => 6,
            'theme' => 'auto',
        ], $atts, 'velora-club-posts');

        self::ensure_assets_enqueued();

        return self::widget_markup('posts', [
            'data-source' => 'clubs',
            'data-slug'   => $atts['slug'],
            'data-limit'  => (string) intval($atts['limit']),
            'data-theme'  => $atts['theme'],
        ]);
    }

    public static function shortcode_documents($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'limit' => 100,
            'theme' => 'auto',
        ], $atts, 'velora-club-documents');

        self::ensure_assets_enqueued();

        return self::widget_markup('club-documents', [
            'data-club'  => $atts['slug'],
            'data-limit' => (string) intval($atts['limit']),
            'data-theme' => $atts['theme'],
        ]);
    }

    public static function shortcode_gallery($atts): string
    {
        $atts = shortcode_atts([
            'slug'             => static::default_slug(),
            'photos_per_album' => 30,
            'theme'            => 'auto',
        ], $atts, 'velora-club-gallery');

        self::ensure_assets_enqueued();

        return self::widget_markup('gallery', [
            'data-source'           => 'clubs',
            'data-slug'             => $atts['slug'],
            'data-photos-per-album' => (string) intval($atts['photos_per_album']),
            'data-theme'            => $atts['theme'],
        ]);
    }

    /**
     * Static sign-in panel pointing club members at their Velora account.
     *
     * Intentionally renders no mount point and loads no bundle: there is
     * nothing here to fetch, so a club page carrying only this block makes no
     * API request at all. heading and text are editable so a club can word it
     * in its own voice; empty values fall back to the translated defaults.
     */
    public static function shortcode_member_area($atts): string
    {
        $atts = shortcode_atts([
            'heading' => '',
            'text'    => '',
            'theme'   => 'auto',
        ], $atts, 'velora-club-member-area');

        self::ensure_styles_only();

        $heading = (string) $atts['heading'];
        if ($heading === '') {
            $heading = __('Club members’ area', 'velora-club-widgets');
        }

        $text = (string) $atts['text'];
        if ($text === '') {
            $text = __(
                'Velora is a portal for breeders and owners of purebred animals, and it is where your club keeps its paperwork. Sign in with the account your club has for you and your own things are in one place: your cattery and your animals, your litters, and the people interested in them — alongside the application you sent to the club and your membership. The portal opens in a new window, so this page stays open behind it.',
                'velora-club-widgets'
            );
        }

        $portal = self::portal_base();

        return '<div class="velora-w velora-member-area' . esc_attr(self::theme_class((string) $atts['theme'])) . '">'
            . '<h2 class="velora-member-area-title">' . esc_html($heading) . '</h2>'
            // nl2br AFTER esc_html, never before: the escaping has to see the raw
            // text, and the <br /> it then inserts is the only markup we add. The
            // editor offers a textarea, so the line breaks a club typed survive as
            // line breaks instead of collapsing into one run-on line.
            . '<p class="velora-member-area-text">' . nl2br(esc_html($text)) . '</p>'
            . '<p class="velora-member-area-actions">'
            . self::portal_link(
                $portal . '/login?redirect=%2Fmy-panels',
                __('Sign in to Velora', 'velora-club-widgets'),
                'velora-btn velora-member-area-cta'
            )
            . '</p>'
            . '<p class="velora-member-area-links">'
            . self::portal_link(
                $portal . '/register?redirect=%2Fmy-panels',
                __('No account yet? Create one', 'velora-club-widgets'),
                'velora-member-area-link'
            )
            . self::portal_link(
                $portal . '/forgot-password',
                __('Forgot your password?', 'velora-club-widgets'),
                'velora-member-area-link'
            )
            . '</p>'
            . '</div>';
    }
}
