<?php
/**
 * Abstract base class for Velora WP plugin singletons.
 *
 * Extracts all shared WordPress integration logic (hooks, settings,
 * admin menu, asset enqueueing) into one place. Concrete subclasses
 * (Velora_Breeder_Plugin, Velora_Club_Plugin) provide only the
 * plugin-specific identity through abstract methods.
 *
 * Distribution note: WordPress.org forbids a plugin from depending on another
 * plugin, so each plugin ships its own copy of this class. `make wp-plugins-build`
 * generates those copies with a per-plugin class prefix (Velora_Breeder_Base_*,
 * Velora_Club_Base_*): two plugins declaring the same global class name is a
 * fatal error the moment both are active on one site.
 * This file: GENERATED from shared/class-base-plugin.php by `make build-base`. DO NOT EDIT.
 *
 * @package VeloraWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}

abstract class Velora_Club_Base_Plugin
{
    // -----------------------------------------------------------------------
    // Abstract identity — each concrete class implements these
    // -----------------------------------------------------------------------

    /** WP settings option group name, e.g. 'velora_breeder'. */
    abstract protected static function option_group(): string;

    /** Plugin text domain as a plain string literal, e.g. 'velora-breeder-widgets'. */
    abstract protected static function text_domain(): string;

    /**
     * Script AND style handle for this plugin's embed bundle,
     * e.g. 'velora-breeder-embed-core'.
     *
     * Must be unique per plugin: the breeder and club plugins update
     * independently on WordPress.org, so a shared handle would let one
     * plugin's bundle render the other plugin's widgets at a version it was
     * never tested against.
     *
     * The price is real and accepted: a page running both plugins loads two
     * copies of embed.js and downloads the Cap.js wasm binary twice (~36 kB).
     * That is safe (Cap.js guards with customElements.get(), widgets guard
     * with data-velora-mounted) and it is NOT to be "optimised" back into one
     * shared handle — that shared handle is what silently lost contact-form
     * submissions before 2026-08-09.
     */
    abstract protected static function asset_handle(): string;

    /**
     * Name of the global object carrying this plugin's runtime config,
     * e.g. 'VeloraBreederEmbedConfig'.
     *
     * Must be unique per plugin: both plugins can run on one page, and
     * contactProxyUrl points at THIS plugin's REST route. A shared global
     * would send breeder inquiries to the club proxy, where they are lost.
     */
    abstract protected static function config_global_name(): string;

    /**
     * Already translated admin menu page title, e.g. __('Velora Breeder', 'velora-breeder-widgets').
     * Concrete classes must call __() themselves so the text domain stays a
     * string literal — the gettext parser cannot follow it through a method call.
     */
    abstract protected static function menu_title(): string;

    /** Admin menu slug, e.g. 'velora-breeder'. */
    abstract protected static function menu_slug(): string;

    /** Dashicon identifier, e.g. 'dashicons-pets'. */
    abstract protected static function menu_icon(): string;

    /** Menu position (integer), e.g. 30. */
    abstract protected static function menu_priority(): int;

    /** Absolute filesystem path to the plugin directory (with trailing /). */
    abstract protected static function plugin_dir(): string;

    /** Public URL of the plugin directory (with trailing /). */
    abstract protected static function plugin_url(): string;

    /** Plugin version string (e.g. VELORA_BREEDER_PLUGIN_VERSION). */
    abstract protected static function plugin_version(): string;

    /** WP REST route namespace for the contact proxy, e.g. 'velora-breeder/v1'. */
    abstract protected static function contact_proxy_namespace(): string;

    /** Admin page hook name, e.g. 'toplevel_page_velora-breeder'. */
    abstract protected static function admin_hook(): string;

    /** Script handle for the admin test-connection script. */
    abstract protected static function admin_script_handle(): string;

    /**
     * Returns the VeloraAdminTestConfig array (fieldIds, i18n).
     * enqueue_admin_assets() adds restUrl + nonce before injecting it via
     * wp_add_inline_script into the admin page.
     */
    abstract protected static function admin_test_config(): array;

    /** WP option name for the API base URL. */
    abstract protected static function option_api_base(): string;

    /** WP option name for the profile base URL. */
    abstract protected static function option_profile_base(): string;

    /** WP option name for the API key. */
    abstract protected static function option_api_key(): string;

    /** WP option name for the default entity slug. */
    abstract protected static function option_default_slug(): string;

    /** WP option name for the locale setting. */
    abstract protected static function option_locale(): string;

    /** WP option name for the opt-in "Powered by Velora" credit flag. */
    abstract protected static function option_show_credit(): string;

    /**
     * Register all shortcodes provided by this plugin.
     * Called from init() after hooks are registered.
     */
    abstract protected static function register_shortcodes(): void;

    // -----------------------------------------------------------------------
    // Shared helpers
    // -----------------------------------------------------------------------

    /** Returns the default slug option value (empty string if not set). */
    protected static function default_slug(): string
    {
        return (string) get_option(static::option_default_slug(), '');
    }

    /**
     * Builds a widget mount point for a shortcode.
     *
     * Every mount point names the config global it must read
     * (data-velora-config). Without it a page running both Velora plugins
     * would hand every widget whichever config was injected last.
     *
     * @param string               $type       Widget type (data-velora-widget value).
     * @param array<string,string> $attributes Extra data-* attributes, escaped here.
     */
    protected static function widget_markup(string $type, array $attributes): string
    {
        $html = '<div data-velora-widget="' . esc_attr($type) . '"';
        foreach ($attributes as $name => $value) {
            $html .= ' ' . $name . '="' . esc_attr((string) $value) . '"';
        }
        return $html . ' data-velora-config="' . esc_attr(static::config_global_name()) . '"></div>';
    }

    // -----------------------------------------------------------------------
    // WordPress integration — hooks
    // -----------------------------------------------------------------------

    public static function init(): void
    {
        add_action('init', [static::class, 'load_textdomain']);
        add_action('admin_menu', [static::class, 'register_admin_menu']);
        add_action('admin_init', [static::class, 'register_settings']);
        add_action('admin_enqueue_scripts', [static::class, 'enqueue_admin_assets']);
        add_action('wp_enqueue_scripts', [static::class, 'enqueue_assets']);
        static::register_shortcodes();
    }

    /**
     * Loads the .mo file that ships INSIDE this plugin package.
     *
     * Do not remove this as "redundant since WordPress 4.6". Automatic loading
     * covers translations downloaded from translate.wordpress.org into
     * wp-content/languages/plugins/. Ours are bundled in the plugin's own
     * languages/ directory, and WP_Textdomain_Registry only ever looks in
     * WP_LANG_DIR plus the paths that load_plugin_textdomain() registers — the
     * "Domain Path" header does not register anything (WordPress 6.6 reads it
     * only when rendering the Plugins admin screen). Verified empirically on
     * WordPress 6.6: with the header alone, is_textdomain_loaded() stayed false
     * and every admin string rendered in English.
     *
     * Plugin Check reports this call under DiscouragedFunctions. That warning
     * is the accepted cost of translations that actually load.
     */
    public static function load_textdomain(): void
    {
        load_plugin_textdomain(
            static::text_domain(),
            false,
            plugin_basename(static::plugin_dir()) . '/languages'
        );
    }

    public static function register_settings(): void
    {
        $group = static::option_group();
        register_setting($group, static::option_api_base(),     ['type' => 'string', 'sanitize_callback' => 'esc_url_raw']);
        register_setting($group, static::option_profile_base(), ['type' => 'string', 'sanitize_callback' => 'esc_url_raw']);
        register_setting($group, static::option_api_key(),      ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field']);
        register_setting($group, static::option_default_slug(), ['type' => 'string', 'sanitize_callback' => 'sanitize_title']);
        register_setting($group, static::option_locale(),       ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field']);
        register_setting($group, static::option_show_credit(),  ['type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean', 'default' => false]);
    }

    public static function register_admin_menu(): void
    {
        $title = static::menu_title();
        add_menu_page(
            $title,
            $title,
            'manage_options',
            static::menu_slug(),
            [static::class, 'render_settings_page'],
            static::menu_icon(),
            static::menu_priority()
        );
    }

    public static function render_settings_page(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        include_once static::plugin_dir() . 'includes/view-settings.php';
    }

    public static function enqueue_assets(): void
    {
        $asset_url  = static::plugin_url() . 'assets/embed.js';
        $css_url    = static::plugin_url() . 'assets/embed.css';
        $asset_path = static::plugin_dir() . 'assets/embed.js';
        $css_path   = static::plugin_dir() . 'assets/embed.css';

        // Use filemtime() so any rebuild of the bundle busts the browser
        // cache automatically — relying on a hand-bumped const led to
        // "still seeing old code" on every TS edit.
        $js_ver  = file_exists($asset_path) ? (string) filemtime($asset_path) : static::plugin_version();
        $css_ver = file_exists($css_path)   ? (string) filemtime($css_path)   : static::plugin_version();

        $handle = static::asset_handle();
        wp_register_script($handle, $asset_url, [], $js_ver,  true);
        wp_register_style($handle,  $css_url,   [], $css_ver);

        $api_base     = get_option(static::option_api_base(),     'https://velora.pet');
        // An empty profile base produces relative profile links that resolve
        // to the WP host (e.g. balticfeline.pl/breeders/...) instead of the
        // public portal. That happens when the option was never configured OR
        // was wiped to '' by saving a settings page that lacked the field.
        // `?:` falls back to the portal for both null and empty string.
        $profile_base = get_option(static::option_profile_base(), '') ?: 'https://velora.pet';
        $locale       = get_option(static::option_locale(),       'pl');
        // WP.org guideline #10: credits on the public site are opt-in, so the
        // default is false and the link only appears once the site owner
        // ticks the checkbox in plugin settings.
        $show_credit  = (bool) get_option(static::option_show_credit(), false);

        // SECURITY: API key is intentionally NOT included here. Contact
        // form submissions go through the WP REST proxy
        // (see class-rest.php), which reads the key server-side and
        // forwards to Velora API. That keeps the key out of the page
        // source / DevTools network tab.
        //
        // Read-only widgets (animals, posts, listings, gallery, etc.)
        // hit api_base directly without auth — they're public endpoints.
        wp_add_inline_script(
            $handle,
            'window.' . static::config_global_name() . ' = ' . wp_json_encode([
                'apiBase'         => $api_base,
                'profileBase'     => $profile_base,
                'locale'          => $locale,
                'contactProxyUrl' => rest_url(static::contact_proxy_namespace() . '/contact'),
                'showCredit'      => $show_credit,
            ]) . ';',
            'before'
        );
    }

    public static function enqueue_admin_assets($hook): void
    {
        // Only load on our settings page.
        // The hook for add_menu_page is "toplevel_page_{slug}".
        if ($hook !== static::admin_hook()) {
            return;
        }

        wp_enqueue_script(
            static::admin_script_handle(),
            static::plugin_url() . 'admin/test-connection.js',
            [],
            static::plugin_version(),
            true
        );
        wp_enqueue_style(
            static::admin_script_handle(),
            static::plugin_url() . 'admin/test-connection.css',
            [],
            static::plugin_version()
        );
        // The "Test connection" button posts to this plugin's own REST route
        // rather than calling the Velora API from the browser: only the server
        // may hold the API key, and only the server can therefore prove that
        // the key works. The route is administrator-only and nonce-checked,
        // so both halves of that check travel with the config.
        $test_config            = static::admin_test_config();
        $test_config['restUrl'] = rest_url(static::contact_proxy_namespace() . '/test-connection');
        $test_config['nonce']   = wp_create_nonce('wp_rest');

        wp_add_inline_script(
            static::admin_script_handle(),
            'window.VeloraAdminTestConfig = ' . wp_json_encode($test_config) . ';',
            'before'
        );
    }

    protected static function ensure_assets_enqueued(): void
    {
        $handle = static::asset_handle();
        if (!wp_script_is($handle, 'enqueued')) {
            wp_enqueue_script($handle);
        }
        if (!wp_style_is($handle, 'enqueued')) {
            wp_enqueue_style($handle);
        }
    }
}
