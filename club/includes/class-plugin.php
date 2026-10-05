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
            'theme'       => 'auto',
        ], $atts, 'velora-club-events');

        self::ensure_assets_enqueued();

        return self::widget_markup('events', [
            'data-source'      => 'clubs',
            'data-slug'        => $atts['slug'],
            'data-limit'       => (string) intval($atts['limit']),
            'data-when'        => $atts['when'],
            'data-show-filter' => $atts['show_filter'],
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
}
