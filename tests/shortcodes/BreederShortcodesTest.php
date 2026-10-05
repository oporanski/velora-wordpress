<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Tests for Velora_Breeder_Plugin shortcode methods.
 *
 * Each shortcode must:
 *  1. Return a div with the correct data-velora-widget attribute.
 *  2. Apply esc_attr() to every user-supplied value (XSS protection).
 *  3. Fall back to the default slug from get_option() when none supplied.
 *  4. Coerce numeric attributes to integers (no float/string injection).
 */
class BreederShortcodesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
        Functions\stubs(['add_action', 'add_shortcode', 'wp_register_script',
            'wp_register_style', 'wp_script_is', 'wp_style_is',
            'wp_enqueue_script', 'wp_enqueue_style']);
        // esc_attr: real escaping behaviour
        Functions\when('esc_attr')->alias('htmlspecialchars');
        // wp_script_is returns false so assets get enqueued on each call
        Functions\when('wp_script_is')->justReturn(false);
        Functions\when('wp_style_is')->justReturn(false);
    }

    protected function tearDown(): void
    {
        Monkey\tearDown();
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // shortcode_about
    // -----------------------------------------------------------------------

    public function test_shortcode_about_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('my-cattery');

        $html = Velora_Breeder_Plugin::shortcode_about([]);

        self::assertStringContainsString('data-velora-widget="about"', $html);
        self::assertStringContainsString('data-source="breeders"', $html);
        self::assertStringContainsString('data-slug="my-cattery"', $html);
    }

    public function test_shortcode_about_uses_explicit_slug(): void
    {
        Functions\when('get_option')->justReturn('default-cattery');

        $html = Velora_Breeder_Plugin::shortcode_about(['slug' => 'explicit-cattery']);

        self::assertStringContainsString('data-slug="explicit-cattery"', $html);
        self::assertStringNotContainsString('default-cattery', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_animals
    // -----------------------------------------------------------------------

    public function test_shortcode_animals_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_animals(['slug' => 'velvet-paws', 'limit' => 6]);

        self::assertStringContainsString('data-velora-widget="breeder-animals"', $html);
        self::assertStringContainsString('data-breeder="velvet-paws"', $html);
        self::assertStringContainsString('data-limit="6"', $html);
    }

    public function test_shortcode_animals_coerces_limit_to_int(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_animals(['slug' => 's', 'limit' => '3.7']);

        // intval('3.7') = 3
        self::assertStringContainsString('data-limit="3"', $html);
    }

    public function test_shortcode_animals_escapes_xss_in_slug(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_animals(['slug' => '"><script>alert(1)</script>']);

        self::assertStringNotContainsString('<script>', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_gallery
    // -----------------------------------------------------------------------

    public function test_shortcode_gallery_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_gallery(['slug' => 'my-cattery']);

        self::assertStringContainsString('data-velora-widget="gallery"', $html);
        self::assertStringContainsString('data-source="breeders"', $html);
        self::assertStringContainsString('data-photos-per-album="30"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_contact
    // -----------------------------------------------------------------------

    public function test_shortcode_contact_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_contact(['slug' => 'my-cattery']);

        self::assertStringContainsString('data-velora-widget="breeder-contact"', $html);
        self::assertStringContainsString('data-breeder="my-cattery"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_listings
    // -----------------------------------------------------------------------

    public function test_shortcode_listings_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_listings(['slug' => 'my-cattery']);

        self::assertStringContainsString('data-velora-widget="listings"', $html);
        self::assertStringContainsString('data-source="breeders"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_posts
    // -----------------------------------------------------------------------

    public function test_shortcode_posts_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_posts(['slug' => 'my-cattery', 'limit' => 3]);

        self::assertStringContainsString('data-velora-widget="posts"', $html);
        self::assertStringContainsString('data-source="breeders"', $html);
        self::assertStringContainsString('data-limit="3"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_events
    // -----------------------------------------------------------------------

    public function test_shortcode_events_uses_breeders_source(): void
    {
        Functions\when('get_option')->justReturn('my-cattery');

        $html = Velora_Breeder_Plugin::shortcode_events([]);

        self::assertStringContainsString('data-velora-widget="events"', $html);
        self::assertStringContainsString('data-source="breeders"', $html);
        self::assertStringContainsString('data-slug="my-cattery"', $html);
    }

    public function test_shortcode_events_defaults_to_upcoming_with_filter(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_events(['slug' => 'my-cattery']);

        self::assertStringContainsString('data-when="upcoming"', $html);
        self::assertStringContainsString('data-show-filter="true"', $html);
        self::assertStringContainsString('data-limit="12"', $html);
    }

    public function test_shortcode_events_passes_when_and_show_filter_through(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Breeder_Plugin::shortcode_events([
            'slug'        => 'my-cattery',
            'when'        => 'past',
            'show_filter' => 'false',
            'limit'       => '5.9',
        ]);

        self::assertStringContainsString('data-when="past"', $html);
        self::assertStringContainsString('data-show-filter="false"', $html);
        self::assertStringContainsString('data-limit="5"', $html);
    }

    // -----------------------------------------------------------------------
    // register_shortcodes() — the events shortcode must actually be registered,
    // otherwise WordPress prints the raw "[velora-breeder-events]" text.
    // -----------------------------------------------------------------------

    public function test_register_shortcodes_registers_events(): void
    {
        $registered = [];
        Functions\when('add_shortcode')->alias(function ($tag, $callback) use (&$registered) {
            $registered[$tag] = $callback;
        });
        Functions\stubs(['add_action']);

        Velora_Breeder_Plugin::init();

        self::assertArrayHasKey('velora-breeder-events', $registered);
        self::assertSame([Velora_Breeder_Plugin::class, 'shortcode_events'], $registered['velora-breeder-events']);
        // Litter data is private — that shortcode must stay unregistered.
        self::assertArrayNotHasKey('velora-breeder-litters', $registered);
    }

    // -----------------------------------------------------------------------
    // init() — hook registration
    // -----------------------------------------------------------------------

    public function test_init_registers_wp_hooks(): void
    {
        $registeredActions = [];
        Functions\when('add_action')->alias(function ($hook, $callback) use (&$registeredActions) {
            $registeredActions[$hook] = $callback;
        });
        Functions\stubs(['add_shortcode']);
        Velora_Breeder_Plugin::init();

        // Bundled .mo files are invisible to WordPress until load_plugin_textdomain()
        // registers the plugin's languages/ directory — see load_textdomain().
        self::assertSame([Velora_Breeder_Plugin::class, 'load_textdomain'], $registeredActions['init']);
        self::assertSame([Velora_Breeder_Plugin::class, 'register_admin_menu'],  $registeredActions['admin_menu']);
        self::assertSame([Velora_Breeder_Plugin::class, 'register_settings'],    $registeredActions['admin_init']);
        self::assertSame([Velora_Breeder_Plugin::class, 'enqueue_admin_assets'], $registeredActions['admin_enqueue_scripts']);
        self::assertSame([Velora_Breeder_Plugin::class, 'enqueue_assets'],       $registeredActions['wp_enqueue_scripts']);
    }

    // -----------------------------------------------------------------------
    // load_textdomain() — the .mo ships inside the plugin, not in WP_LANG_DIR
    // -----------------------------------------------------------------------

    public function test_load_textdomain_points_at_the_bundled_languages_dir(): void
    {
        Functions\when('plugin_basename')->alias(static fn($path) => trim(str_replace('/plugins/', '', $path), '/'));
        $captured = [];
        Functions\when('load_plugin_textdomain')->alias(function (...$args) use (&$captured) {
            $captured = $args;
            return true;
        });

        Velora_Breeder_Plugin::load_textdomain();

        self::assertSame('velora-breeder-widgets', $captured[0]);
        self::assertFalse($captured[1]);
        self::assertSame('velora-breeder-widgets/languages', $captured[2]);
    }

    // -----------------------------------------------------------------------
    // Per-plugin identity — a page may run BOTH Velora plugins at once
    // -----------------------------------------------------------------------

    public function test_widget_markup_names_this_plugins_config_global(): void
    {
        Functions\when('get_option')->justReturn('some-slug');

        $html = Velora_Breeder_Plugin::shortcode_about([]);

        self::assertStringContainsString('data-velora-config="VeloraBreederEmbedConfig"', $html);
    }

    public function test_enqueue_assets_uses_this_plugins_handle_and_config_global(): void
    {
        Functions\when('get_option')->justReturn('');
        Functions\when('rest_url')->returnArg(1);
        $handles = [];
        Functions\when('wp_register_script')->alias(function ($handle) use (&$handles) {
            $handles[] = 'script:' . $handle;
        });
        Functions\when('wp_register_style')->alias(function ($handle) use (&$handles) {
            $handles[] = 'style:' . $handle;
        });
        $inlineScript = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript, &$handles) {
            $handles[] = 'inline:' . $handle;
            $inlineScript .= $code;
        });

        Velora_Breeder_Plugin::enqueue_assets();

        self::assertSame(['script:velora-breeder-embed-core', 'style:velora-breeder-embed-core', 'inline:velora-breeder-embed-core'], $handles);
        self::assertStringStartsWith('window.VeloraBreederEmbedConfig = ', $inlineScript);
    }

    // -----------------------------------------------------------------------
    // register_settings()
    // -----------------------------------------------------------------------

    public function test_register_settings_registers_six_settings(): void
    {
        $registered = [];
        Functions\when('register_setting')->alias(function ($group, $option, $args) use (&$registered) {
            $registered[] = [$group, $option];
        });
        Velora_Breeder_Plugin::register_settings();
        self::assertCount(6, $registered);
        $options = array_column($registered, 1);
        self::assertContains('velora_breeder_api_base',     $options);
        self::assertContains('velora_breeder_api_key',      $options);
        self::assertContains('velora_breeder_locale',       $options);
        self::assertContains('velora_breeder_default_slug', $options);
        self::assertContains('velora_breeder_profile_base', $options);
        self::assertContains('velora_breeder_show_credit',  $options);
        // All settings must belong to the velora_breeder group
        foreach ($registered as [$group, $_]) {
            self::assertSame('velora_breeder', $group);
        }
    }

    public function test_show_credit_setting_defaults_to_false(): void
    {
        $args = [];
        Functions\when('register_setting')->alias(function ($group, $option, $settingArgs) use (&$args) {
            $args[$option] = $settingArgs;
        });
        Velora_Breeder_Plugin::register_settings();
        // WP.org guideline #10 — the credit must default to hidden.
        self::assertFalse($args['velora_breeder_show_credit']['default']);
        self::assertSame('boolean', $args['velora_breeder_show_credit']['type']);
    }

    // -----------------------------------------------------------------------
    // register_admin_menu()
    // -----------------------------------------------------------------------

    public function test_register_admin_menu_adds_menu_page(): void
    {
        Functions\when('__')->returnArg(1);
        $captured = [];
        Functions\when('add_menu_page')->alias(function () use (&$captured) {
            $captured = func_get_args();
        });
        Velora_Breeder_Plugin::register_admin_menu();
        self::assertSame('Velora Breeder', $captured[0]);
        self::assertSame('Velora Breeder', $captured[1]);
        self::assertSame('manage_options', $captured[2]);
        self::assertSame('velora-breeder', $captured[3]);
        self::assertSame([Velora_Breeder_Plugin::class, 'render_settings_page'], $captured[4]);
        self::assertSame('dashicons-pets', $captured[5]);
        self::assertSame(30, $captured[6]);
    }

    // -----------------------------------------------------------------------
    // enqueue_assets() — API key MUST NOT appear in browser output
    // -----------------------------------------------------------------------

    public function test_enqueue_assets_does_not_expose_api_key(): void
    {
        Functions\when('get_option')->alias(function ($option, $default = '') {
            if ($option === 'velora_breeder_api_key') return 'secret-api-key-123';
            return $default;
        });
        Functions\stubs(['wp_register_script', 'wp_register_style']);
        // file_exists is a PHP internal — cannot be mocked via Patchwork.
        // enqueue_assets() falls back to plugin version when file not found on disk,
        // so we don't need to mock it; the method proceeds regardless.
        Functions\when('rest_url')->returnArg(1);
        $inlineScript = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript) {
            $inlineScript .= $code;
        });
        Velora_Breeder_Plugin::enqueue_assets();
        self::assertStringNotContainsString('secret-api-key-123', $inlineScript);
    }

    public function test_enqueue_assets_outputs_contact_proxy_url(): void
    {
        Functions\when('get_option')->justReturn('');
        Functions\stubs(['wp_register_script', 'wp_register_style']);
        Functions\when('rest_url')->returnArg(1);
        $inlineScript = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript) {
            $inlineScript .= $code;
        });
        Velora_Breeder_Plugin::enqueue_assets();
        self::assertStringContainsString('contactProxyUrl', $inlineScript);
        // wp_json_encode may escape "/" as "\/" — accept both forms
        self::assertMatchesRegularExpression('#velora-breeder(\\\\?)/v1(\\\\?)/contact#', $inlineScript);
    }

    public function test_enqueue_assets_falls_back_to_public_portal_when_profile_base_empty(): void
    {
        // Empty profile_base must not yield relative profile links.
        Functions\when('get_option')->justReturn('');
        Functions\stubs(['wp_register_script', 'wp_register_style']);
        Functions\when('rest_url')->returnArg(1);
        $inlineScript = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript) {
            $inlineScript .= $code;
        });
        Velora_Breeder_Plugin::enqueue_assets();
        self::assertMatchesRegularExpression('#"profileBase":"https:(\\\\?)/(\\\\?)/velora\.pet"#', $inlineScript);
    }

    public function test_enqueue_assets_uses_configured_profile_base(): void
    {
        Functions\when('get_option')->alias(function ($option, $default = '') {
            return $option === 'velora_breeder_profile_base' ? 'https://custom.example' : $default;
        });
        Functions\stubs(['wp_register_script', 'wp_register_style']);
        Functions\when('rest_url')->returnArg(1);
        $inlineScript = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript) {
            $inlineScript .= $code;
        });
        Velora_Breeder_Plugin::enqueue_assets();
        self::assertMatchesRegularExpression('#"profileBase":"https:(\\\\?)/(\\\\?)/custom\.example"#', $inlineScript);
    }

    // -----------------------------------------------------------------------
    // enqueue_assets() — "Powered by Velora" credit is opt-in (WP.org #10)
    // -----------------------------------------------------------------------

    private function captureEmbedConfig(callable $optionResolver): string
    {
        Functions\when('get_option')->alias($optionResolver);
        Functions\stubs(['wp_register_script', 'wp_register_style']);
        Functions\when('rest_url')->returnArg(1);
        $inlineScript = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript) {
            $inlineScript .= $code;
        });
        Velora_Breeder_Plugin::enqueue_assets();
        return $inlineScript;
    }

    public function test_enqueue_assets_disables_credit_by_default(): void
    {
        $inlineScript = $this->captureEmbedConfig(static fn($option, $default = '') => $default);
        self::assertStringContainsString('"showCredit":false', $inlineScript);
    }

    public function test_enqueue_assets_enables_credit_when_option_set(): void
    {
        $inlineScript = $this->captureEmbedConfig(
            static fn($option, $default = '') => $option === 'velora_breeder_show_credit' ? '1' : $default
        );
        self::assertStringContainsString('"showCredit":true', $inlineScript);
    }

    // -----------------------------------------------------------------------
    // enqueue_admin_assets() — only loads on correct hook
    // -----------------------------------------------------------------------

    public function test_enqueue_admin_assets_skips_wrong_hook(): void
    {
        $enqueued = [];
        Functions\when('wp_enqueue_script')->alias(function ($handle) use (&$enqueued) {
            $enqueued[] = $handle;
        });
        Functions\when('wp_enqueue_style')->alias(function ($handle) use (&$enqueued) {
            $enqueued[] = $handle;
        });
        Velora_Breeder_Plugin::enqueue_admin_assets('some_other_page');
        self::assertEmpty($enqueued, 'No scripts or styles should be enqueued on wrong hook');
    }

    // -----------------------------------------------------------------------
    // render_settings_page() — covers shared base; early-return path (no capability)
    // -----------------------------------------------------------------------

    public function test_render_settings_page_exits_without_manage_options(): void
    {
        Functions\when('current_user_can')->justReturn(false);
        Velora_Breeder_Plugin::render_settings_page();
        $this->addToAssertionCount(1); // reached and returned without crashing
    }

    public function test_render_settings_page_includes_view_when_authorized(): void
    {
        Functions\when('current_user_can')->justReturn(true);
        // The view file does not exist at the test path — include_once emits a
        // PHP warning and returns false, but does NOT throw an exception.
        // We suppress the warning to keep test output clean and assert the
        // method runs past the capability check without crashing.
        set_error_handler(static fn() => true, E_WARNING);
        try {
            Velora_Breeder_Plugin::render_settings_page();
        } finally {
            restore_error_handler();
        }
        $this->addToAssertionCount(1); // method reached include_once branch
    }

    public function test_enqueue_admin_assets_loads_on_correct_hook(): void
    {
        Functions\when('__')->returnArg(1);
        Functions\when('rest_url')->alias(fn(string $path) => 'https://example.com/wp-json/' . $path);
        Functions\when('wp_create_nonce')->justReturn('nonce-abc');
        $enqueued = [];
        Functions\when('wp_enqueue_script')->alias(function ($handle) use (&$enqueued) {
            $enqueued[] = 'script:' . $handle;
        });
        Functions\when('wp_enqueue_style')->alias(function ($handle) use (&$enqueued) {
            $enqueued[] = 'style:' . $handle;
        });
        $inline = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $data) use (&$inline) {
            $inline = (string) $data;
        });

        Velora_Breeder_Plugin::enqueue_admin_assets('toplevel_page_velora-breeder');

        self::assertNotEmpty($enqueued, 'Expected scripts/styles to be enqueued on correct hook');
        self::assertContains('script:velora-breeder-admin-test', $enqueued);
        self::assertContains('style:velora-breeder-admin-test', $enqueued);

        // The "Test connection" button reaches an administrator-only REST route
        // that rejects a request without the wp_rest nonce, so both the route
        // URL and the nonce have to travel in this config. Without them the
        // button would silently report a network error on every click.
        $config = json_decode(rtrim(substr($inline, (int) strpos($inline, '{')), ';'), true);
        self::assertSame(
            'https://example.com/wp-json/velora-breeder/v1/test-connection',
            $config['restUrl'],
        );
        self::assertSame('nonce-abc', $config['nonce']);
    }
}
