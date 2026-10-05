<?php
/**
 * @package VeloraBreederWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}

class Velora_Breeder_Plugin extends Velora_Breeder_Base_Plugin
{
    const OPTION_API_BASE     = 'velora_breeder_api_base';
    const OPTION_PROFILE_BASE = 'velora_breeder_profile_base';
    const OPTION_API_KEY      = 'velora_breeder_api_key';
    const OPTION_DEFAULT_SLUG = 'velora_breeder_default_slug';
    const OPTION_LOCALE       = 'velora_breeder_locale';
    const OPTION_SHOW_CREDIT  = 'velora_breeder_show_credit';

    // -----------------------------------------------------------------------
    // Identity — abstract method implementations
    // -----------------------------------------------------------------------

    protected static function option_group(): string
    {
        return 'velora_breeder';
    }

    protected static function text_domain(): string
    {
        return 'velora-breeder-widgets';
    }

    protected static function asset_handle(): string
    {
        return 'velora-breeder-embed-core';
    }

    protected static function config_global_name(): string
    {
        return 'VeloraBreederEmbedConfig';
    }

    protected static function menu_title(): string
    {
        return __('Velora Breeder', 'velora-breeder-widgets');
    }

    protected static function menu_slug(): string
    {
        return 'velora-breeder';
    }

    protected static function menu_icon(): string
    {
        return 'dashicons-pets';
    }

    protected static function menu_priority(): int
    {
        return 30;
    }

    protected static function plugin_dir(): string
    {
        return VELORA_BREEDER_PLUGIN_DIR;
    }

    protected static function plugin_url(): string
    {
        return VELORA_BREEDER_PLUGIN_URL;
    }

    protected static function plugin_version(): string
    {
        return VELORA_BREEDER_PLUGIN_VERSION;
    }

    protected static function contact_proxy_namespace(): string
    {
        return 'velora-breeder/v1';
    }

    protected static function admin_hook(): string
    {
        return 'toplevel_page_velora-breeder';
    }

    protected static function admin_script_handle(): string
    {
        return 'velora-breeder-admin-test';
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
                'testing' => __('Checking connection…', 'velora-breeder-widgets'),
                /* translators: %s is the breeder (cattery/kennel) name returned by the Velora API. */
                'success' => __('Connected. Breeder: %s', 'velora-breeder-widgets'),
                /* translators: %s is the breeder (cattery/kennel) name returned by the Velora API. */
                'connectedNoKey'            => __('Profile "%s" found, but no API key was entered — the contact form needs one and was not checked.', 'velora-breeder-widgets'),
                /* translators: %s is the breeder slug entered in the settings form. */
                'slugNotFound'              => __('Slug "%s" does not exist. Check the spelling (compare it with the profile URL in Velora).', 'velora-breeder-widgets'),
                'invalidApiKey'             => __('The API key was rejected. Copy it again from the Velora panel, under Developers.', 'velora-breeder-widgets'),
                /* translators: %s is the breeder slug entered in the settings form. */
                'keyOrgMismatch'            => __('This API key belongs to a different organisation than "%s".', 'velora-breeder-widgets'),
                'invalidApiBase'            => __('"API base URL" must be a full http:// or https:// address.', 'velora-breeder-widgets'),
                'apiUnreachable'            => __('The API server is not responding — check "API base URL".', 'velora-breeder-widgets'),
                'unexpectedResponse'        => __('The server returned an unexpected response — check that "API base URL" points to the Velora API.', 'velora-breeder-widgets'),
                'networkError'              => __('Network error', 'velora-breeder-widgets'),
                'missingApiBase'            => __('Enter the "API base URL".', 'velora-breeder-widgets'),
                'missingSlug'               => __('Enter the "Default breeder slug".', 'velora-breeder-widgets'),
            ],
        ];
    }

    protected static function register_shortcodes(): void
    {
        // NOTE: [velora-breeder-litters] intentionally absent — litter data is
        // private to the breeder and must not be embedded on public sites.
        add_shortcode('velora-breeder-about',    [self::class, 'shortcode_about']);
        add_shortcode('velora-breeder-animals',  [self::class, 'shortcode_animals']);
        add_shortcode('velora-breeder-gallery',  [self::class, 'shortcode_gallery']);
        add_shortcode('velora-breeder-contact',  [self::class, 'shortcode_contact']);
        add_shortcode('velora-breeder-events',   [self::class, 'shortcode_events']);
        add_shortcode('velora-breeder-listings', [self::class, 'shortcode_listings']);
        add_shortcode('velora-breeder-posts',    [self::class, 'shortcode_posts']);
    }

    // -----------------------------------------------------------------------
    // Shortcode handlers
    // -----------------------------------------------------------------------

    public static function shortcode_animals($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'limit' => 12,
            'theme' => 'auto',
        ], $atts, 'velora-breeder-animals');

        self::ensure_assets_enqueued();

        return self::widget_markup('breeder-animals', [
            'data-breeder' => $atts['slug'],
            'data-limit'   => (string) intval($atts['limit']),
            'data-theme'   => $atts['theme'],
        ]);
    }

    public static function shortcode_gallery($atts): string
    {
        $atts = shortcode_atts([
            'slug'             => static::default_slug(),
            'photos_per_album' => 30,
            'theme'            => 'auto',
        ], $atts, 'velora-breeder-gallery');

        self::ensure_assets_enqueued();

        return self::widget_markup('gallery', [
            'data-source'           => 'breeders',
            'data-slug'             => $atts['slug'],
            'data-photos-per-album' => (string) intval($atts['photos_per_album']),
            'data-theme'            => $atts['theme'],
        ]);
    }

    public static function shortcode_contact($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'theme' => 'auto',
        ], $atts, 'velora-breeder-contact');

        self::ensure_assets_enqueued();

        return self::widget_markup('breeder-contact', [
            'data-breeder' => $atts['slug'],
            'data-theme'   => $atts['theme'],
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
        ], $atts, 'velora-breeder-events');

        self::ensure_assets_enqueued();

        return self::widget_markup('events', [
            'data-source'      => 'breeders',
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
            'limit' => 12,
            'theme' => 'auto',
        ], $atts, 'velora-breeder-listings');

        self::ensure_assets_enqueued();

        return self::widget_markup('listings', [
            'data-source' => 'breeders',
            'data-slug'   => $atts['slug'],
            'data-limit'  => (string) intval($atts['limit']),
            'data-theme'  => $atts['theme'],
        ]);
    }

    public static function shortcode_about($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'theme' => 'auto',
        ], $atts, 'velora-breeder-about');

        self::ensure_assets_enqueued();

        return self::widget_markup('about', [
            'data-source' => 'breeders',
            'data-slug'   => $atts['slug'],
            'data-theme'  => $atts['theme'],
        ]);
    }

    public static function shortcode_posts($atts): string
    {
        $atts = shortcode_atts([
            'slug'  => static::default_slug(),
            'limit' => 6,
            'theme' => 'auto',
        ], $atts, 'velora-breeder-posts');

        self::ensure_assets_enqueued();

        return self::widget_markup('posts', [
            'data-source' => 'breeders',
            'data-slug'   => $atts['slug'],
            'data-limit'  => (string) intval($atts['limit']),
            'data-theme'  => $atts['theme'],
        ]);
    }
}
