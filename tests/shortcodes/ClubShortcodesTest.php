<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Tests for Velora_Club_Plugin shortcode methods.
 * Mirrors BreederShortcodesTest; focuses on club-specific widgets and
 * data-source="clubs" throughout.
 */
class ClubShortcodesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
        Functions\stubs(['add_action', 'add_shortcode', 'wp_register_script',
            'wp_register_style', 'wp_script_is', 'wp_style_is',
            'wp_enqueue_script', 'wp_enqueue_style']);
        Functions\when('esc_attr')->alias('htmlspecialchars');
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

    public function test_shortcode_about_uses_clubs_source(): void
    {
        Functions\when('get_option')->justReturn('my-club');

        $html = Velora_Club_Plugin::shortcode_about([]);

        self::assertStringContainsString('data-velora-widget="about"', $html);
        self::assertStringContainsString('data-source="clubs"', $html);
        self::assertStringContainsString('data-slug="my-club"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_breeders (club-specific — no breeder equivalent)
    // -----------------------------------------------------------------------

    public function test_shortcode_breeders_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_breeders(['slug' => 'gff', 'limit' => 50]);

        self::assertStringContainsString('data-velora-widget="club-breeders"', $html);
        self::assertStringContainsString('data-club="gff"', $html);
        self::assertStringContainsString('data-limit="50"', $html);
    }

    public function test_shortcode_breeders_coerces_limit_to_int(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_breeders(['slug' => 'c', 'limit' => '12.9']);

        self::assertStringContainsString('data-limit="12"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_contact (club-specific attributes)
    // -----------------------------------------------------------------------

    public function test_shortcode_contact_uses_club_widget_and_data_club(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_contact(['slug' => 'gff']);

        self::assertStringContainsString('data-velora-widget="club-contact"', $html);
        self::assertStringContainsString('data-club="gff"', $html);
        // Must NOT contain breeder-specific attributes
        self::assertStringNotContainsString('data-breeder=', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_events
    // -----------------------------------------------------------------------

    public function test_shortcode_events_uses_clubs_source(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_events(['slug' => 'gff']);

        self::assertStringContainsString('data-source="clubs"', $html);
        self::assertStringContainsString('data-velora-widget="events"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_documents (club-specific — no breeder equivalent)
    // -----------------------------------------------------------------------

    public function test_shortcode_documents_outputs_correct_widget(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_documents(['slug' => 'gff', 'limit' => 20]);

        self::assertStringContainsString('data-velora-widget="club-documents"', $html);
        self::assertStringContainsString('data-club="gff"', $html);
        self::assertStringContainsString('data-limit="20"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_listings
    // -----------------------------------------------------------------------

    public function test_shortcode_listings_uses_clubs_source(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_listings(['slug' => 'gff']);

        self::assertStringContainsString('data-source="clubs"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_gallery
    // -----------------------------------------------------------------------

    public function test_shortcode_gallery_uses_clubs_source(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_gallery(['slug' => 'gff']);

        self::assertStringContainsString('data-source="clubs"', $html);
        self::assertStringContainsString('data-velora-widget="gallery"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_posts
    // -----------------------------------------------------------------------

    public function test_shortcode_posts_uses_clubs_source(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_posts(['slug' => 'gff', 'limit' => 4]);

        self::assertStringContainsString('data-source="clubs"', $html);
        self::assertStringContainsString('data-limit="4"', $html);
    }

    // -----------------------------------------------------------------------
    // shortcode_member_area — a STATIC panel: no API call, no bundle, no slug
    // -----------------------------------------------------------------------

    /**
     * Renders the members' area with the escaping functions stubbed.
     *
     * @param array<string,string> $atts        Shortcode attributes.
     * @param string               $profileBase Stored velora_club_profile_base value.
     */
    private function renderMemberArea(array $atts = [], string $profileBase = 'https://portal.example'): string
    {
        Functions\when('get_option')->alias(
            fn($option, $default = '') => $option === 'velora_club_profile_base' ? $profileBase : $default
        );
        Functions\when('__')->returnArg(1);
        Functions\when('esc_html')->alias('htmlspecialchars');
        Functions\when('esc_url')->returnArg(1);

        return Velora_Club_Plugin::shortcode_member_area($atts);
    }

    public function test_member_area_keeps_the_line_breaks_a_club_typed(): void
    {
        // The editor offers a textarea, so a club writing two paragraphs must get
        // two paragraphs. Without nl2br the browser collapses the newline into a
        // space and the panel reads as one run-on line.
        $html = $this->renderMemberArea(['text' => "First line.\n\nSecond line."]);

        self::assertStringContainsString('First line.<br />', $html);
        self::assertStringContainsString('Second line.', $html);
    }

    public function test_member_area_escapes_before_it_inserts_line_breaks(): void
    {
        // nl2br must run AFTER esc_html. The reverse order is not an XSS hole —
        // esc_html would escape nl2br's own <br /> along with everything else —
        // but it does destroy the line break, so this pins the order down.
        $html = $this->renderMemberArea(['text' => "<script>alert(1)</script>\nnext"]);

        self::assertStringNotContainsString('<script>', $html);
        self::assertStringContainsString('&lt;script&gt;', $html);
        self::assertStringContainsString('<br />', $html);
    }

    public function test_member_area_main_action_points_at_the_configured_portal(): void
    {
        $html = $this->renderMemberArea();

        self::assertStringContainsString(
            'href="https://portal.example/login?redirect=%2Fmy-panels"',
            $html,
        );
    }

    public function test_member_area_falls_back_to_the_public_portal_when_option_is_empty(): void
    {
        // get_option()'s default argument does not cover an option stored as '',
        // which is what a settings page saved without the field leaves behind.
        $html = $this->renderMemberArea([], '');

        self::assertStringContainsString(
            'href="https://velora.pet/login?redirect=%2Fmy-panels"',
            $html,
        );
    }

    public function test_member_area_does_not_double_the_slash_on_a_trailing_slash_option(): void
    {
        $html = $this->renderMemberArea([], 'https://velora.pet/');

        self::assertStringContainsString('href="https://velora.pet/login?redirect=%2Fmy-panels"', $html);
        self::assertStringNotContainsString('velora.pet//login', $html);
    }

    public function test_member_area_opens_the_portal_in_a_new_window_safely(): void
    {
        $html = $this->renderMemberArea();

        // target="_blank" without rel="noopener" hands the opened page a live
        // window.opener reference back into the club's site.
        self::assertStringContainsString('target="_blank"', $html);
        self::assertStringContainsString('rel="noopener noreferrer"', $html);
    }

    public function test_member_area_offers_registration_and_password_recovery(): void
    {
        $html = $this->renderMemberArea();

        self::assertStringContainsString('href="https://portal.example/register?redirect=%2Fmy-panels"', $html);
        self::assertStringContainsString('href="https://portal.example/forgot-password"', $html);
        // Every portal link opens a new window, so every one needs the guard.
        self::assertSame(3, substr_count($html, 'rel="noopener noreferrer"'));
        self::assertSame(3, substr_count($html, 'target="_blank"'));
    }

    public function test_member_area_renders_no_widget_mount_point(): void
    {
        // data-velora-widget is embed.js's mount point. This panel is static
        // markup — a mount point here would make the bundle try to hydrate it.
        self::assertStringNotContainsString('data-velora-widget', $this->renderMemberArea());
    }

    public function test_member_area_enqueues_the_stylesheet_but_not_the_bundle(): void
    {
        $scripts = [];
        $styles  = [];
        Functions\when('wp_enqueue_script')->alias(function ($handle) use (&$scripts) {
            $scripts[] = $handle;
        });
        Functions\when('wp_enqueue_style')->alias(function ($handle) use (&$styles) {
            $styles[] = $handle;
        });

        $this->renderMemberArea();

        self::assertSame([], $scripts, 'The bundle has nothing to hydrate here and must stay off the page');
        self::assertSame(['velora-club-embed-core'], $styles, 'The markup uses the shared .velora-w tokens');
    }

    /**
     * Every visible string must reach the reader through the translator.
     *
     * The stub marks each translated string with its text domain, so a
     * hard-coded literal shows up as a missing marker rather than as text that
     * merely happens to be English.
     */
    public function test_member_area_sends_every_visible_string_through_the_translator(): void
    {
        Functions\when('get_option')->justReturn('https://portal.example');
        Functions\when('esc_html')->alias('htmlspecialchars');
        Functions\when('esc_url')->returnArg(1);
        Functions\when('__')->alias(
            fn($text, $domain = '') => '[[' . $domain . '|' . $text . ']]'
        );

        $html = Velora_Club_Plugin::shortcode_member_area([]);

        self::assertStringContainsString('[[velora-club-widgets|Club members’ area]]', $html);
        self::assertStringContainsString('[[velora-club-widgets|Velora is the portal your club runs', $html);
        self::assertStringContainsString('[[velora-club-widgets|Sign in to Velora]]', $html);
        self::assertStringContainsString('[[velora-club-widgets|No account yet? Create one]]', $html);
        self::assertStringContainsString('[[velora-club-widgets|Forgot your password?]]', $html);
        // The hidden hint is the only thing telling a screen-reader user that
        // the link replaces nothing — it is a visible string too.
        self::assertSame(3, substr_count($html, '[[velora-club-widgets|(opens in a new window)]]'));
    }

    public function test_member_area_uses_the_attributes_instead_of_the_defaults(): void
    {
        $html = $this->renderMemberArea([
            'heading' => 'Dla członków klubu',
            'text'    => 'Nasz klub prowadzi papiery w Velorze.',
        ]);

        self::assertStringContainsString('<h2 class="velora-member-area-title">Dla członków klubu</h2>', $html);
        self::assertStringContainsString('Nasz klub prowadzi papiery w Velorze.', $html);
        self::assertStringNotContainsString('Club members', $html);
        self::assertStringNotContainsString('Velora is the portal', $html);
    }

    public function test_member_area_escapes_xss_in_heading_and_text(): void
    {
        $html = $this->renderMemberArea([
            'heading' => '"><script>alert(1)</script>',
            'text'    => '<img src=x onerror=alert(2)>',
        ]);

        self::assertStringNotContainsString('<script>', $html);
        self::assertStringNotContainsString('<img', $html);
    }

    public function test_member_area_maps_the_theme_attribute_onto_an_explicit_class(): void
    {
        self::assertStringContainsString(
            'class="velora-w velora-member-area velora-w-explicit-light"',
            $this->renderMemberArea(['theme' => 'light']),
        );
        self::assertStringContainsString(
            'class="velora-w velora-member-area velora-w-explicit-dark"',
            $this->renderMemberArea(['theme' => 'dark']),
        );
        // "auto" means "inherit the host theme", so it adds nothing.
        self::assertStringContainsString(
            'class="velora-w velora-member-area"',
            $this->renderMemberArea(['theme' => 'auto']),
        );
    }

    // -----------------------------------------------------------------------
    // XSS protection
    // -----------------------------------------------------------------------

    public function test_shortcode_escapes_xss_in_slug(): void
    {
        Functions\when('get_option')->justReturn('');

        $html = Velora_Club_Plugin::shortcode_about(['slug' => '"><script>alert(1)</script>']);

        self::assertStringNotContainsString('<script>', $html);
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
        $registeredShortcodes = [];
        Functions\when('add_shortcode')->alias(function ($tag, $callback) use (&$registeredShortcodes) {
            $registeredShortcodes[$tag] = $callback;
        });
        Velora_Club_Plugin::init();

        self::assertSame(
            [Velora_Club_Plugin::class, 'shortcode_member_area'],
            $registeredShortcodes['velora-club-member-area'] ?? null,
            'The members\' area shortcode has to be registered or the block renders nothing',
        );

        // Bundled .mo files are invisible to WordPress until load_plugin_textdomain()
        // registers the plugin's languages/ directory — see load_textdomain().
        self::assertSame([Velora_Club_Plugin::class, 'load_textdomain'], $registeredActions['init']);
        self::assertSame([Velora_Club_Plugin::class, 'register_admin_menu'],  $registeredActions['admin_menu']);
        self::assertSame([Velora_Club_Plugin::class, 'register_settings'],    $registeredActions['admin_init']);
        self::assertSame([Velora_Club_Plugin::class, 'enqueue_admin_assets'], $registeredActions['admin_enqueue_scripts']);
        self::assertSame([Velora_Club_Plugin::class, 'enqueue_assets'],       $registeredActions['wp_enqueue_scripts']);
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

        Velora_Club_Plugin::load_textdomain();

        self::assertSame('velora-club-widgets', $captured[0]);
        self::assertFalse($captured[1]);
        self::assertSame('velora-club-widgets/languages', $captured[2]);
    }

    // -----------------------------------------------------------------------
    // Per-plugin identity — a page may run BOTH Velora plugins at once
    // -----------------------------------------------------------------------

    public function test_widget_markup_names_this_plugins_config_global(): void
    {
        Functions\when('get_option')->justReturn('some-slug');

        $html = Velora_Club_Plugin::shortcode_about([]);

        self::assertStringContainsString('data-velora-config="VeloraClubEmbedConfig"', $html);
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

        Velora_Club_Plugin::enqueue_assets();

        self::assertSame(['script:velora-club-embed-core', 'style:velora-club-embed-core', 'inline:velora-club-embed-core'], $handles);
        self::assertStringStartsWith('window.VeloraClubEmbedConfig = ', $inlineScript);
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
        Velora_Club_Plugin::register_settings();
        self::assertCount(6, $registered);
        $options = array_column($registered, 1);
        self::assertContains('velora_club_api_base',     $options);
        self::assertContains('velora_club_api_key',      $options);
        self::assertContains('velora_club_locale',       $options);
        self::assertContains('velora_club_default_slug', $options);
        self::assertContains('velora_club_profile_base', $options);
        self::assertContains('velora_club_show_credit',  $options);
        foreach ($registered as [$group, $_]) {
            self::assertSame('velora_club', $group);
        }
    }

    public function test_show_credit_setting_defaults_to_false(): void
    {
        $args = [];
        Functions\when('register_setting')->alias(function ($group, $option, $settingArgs) use (&$args) {
            $args[$option] = $settingArgs;
        });
        Velora_Club_Plugin::register_settings();
        // WP.org guideline #10 — the credit must default to hidden.
        self::assertFalse($args['velora_club_show_credit']['default']);
        self::assertSame('boolean', $args['velora_club_show_credit']['type']);
    }

    // -----------------------------------------------------------------------
    // enqueue_assets() — profileBase resolution
    // -----------------------------------------------------------------------

    /**
     * Captures the window.VeloraClubEmbedConfig inline script emitted by enqueue_assets.
     * @param callable $getOption alias for get_option($key, $default)
     */
    private function captureEmbedConfig(callable $getOption): string
    {
        Functions\when('get_option')->alias($getOption);
        Functions\stubs(['wp_register_script', 'wp_register_style']);
        Functions\when('rest_url')->returnArg(1);
        $inline = '';
        Functions\when('wp_add_inline_script')->alias(
            function ($handle, $code, $position = '') use (&$inline) {
                $inline .= $code;
            }
        );
        Velora_Club_Plugin::enqueue_assets();
        return $inline;
    }

    public function test_enqueue_assets_falls_back_to_public_portal_when_profile_base_empty(): void
    {
        // An empty profile_base option (never configured, or wiped by a save
        // that lacked the field) must not produce relative profile links.
        $inline = $this->captureEmbedConfig(fn($key, $default = '') => '');
        // wp_json_encode may escape "/" as "\/" — accept both forms.
        self::assertMatchesRegularExpression('#"profileBase":"https:(\\\\?)/(\\\\?)/velora\.pet"#', $inline);
    }

    public function test_enqueue_assets_uses_configured_profile_base(): void
    {
        $inline = $this->captureEmbedConfig(
            fn($key, $default = '') => $key === 'velora_club_profile_base'
                ? 'https://custom.example'
                : $default
        );
        self::assertMatchesRegularExpression('#"profileBase":"https:(\\\\?)/(\\\\?)/custom\.example"#', $inline);
    }

    // -----------------------------------------------------------------------
    // enqueue_assets() — "Powered by Velora" credit is opt-in (WP.org #10)
    // -----------------------------------------------------------------------

    public function test_enqueue_assets_disables_credit_by_default(): void
    {
        $inline = $this->captureEmbedConfig(fn($key, $default = '') => $default);
        self::assertStringContainsString('"showCredit":false', $inline);
    }

    public function test_enqueue_assets_enables_credit_when_option_set(): void
    {
        $inline = $this->captureEmbedConfig(
            fn($key, $default = '') => $key === 'velora_club_show_credit' ? '1' : $default
        );
        self::assertStringContainsString('"showCredit":true', $inline);
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
        Velora_Club_Plugin::register_admin_menu();
        self::assertSame('Velora Club',    $captured[0]);
        self::assertSame('Velora Club',    $captured[1]);
        self::assertSame('manage_options', $captured[2]);
        self::assertSame('velora-club',    $captured[3]);
        self::assertSame([Velora_Club_Plugin::class, 'render_settings_page'], $captured[4]);
        self::assertSame('dashicons-groups', $captured[5]);
        self::assertSame(31, $captured[6]);
    }

    // -----------------------------------------------------------------------
    // enqueue_assets() — API key MUST NOT appear in browser output
    // -----------------------------------------------------------------------

    public function test_enqueue_assets_does_not_expose_api_key(): void
    {
        Functions\when('get_option')->alias(function ($option, $default = '') {
            if ($option === 'velora_club_api_key') return 'secret-api-key-456';
            return $default;
        });
        Functions\stubs(['wp_register_script', 'wp_register_style']);
        // file_exists is a PHP internal — cannot be mocked via Patchwork.
        // enqueue_assets() falls back to plugin version when file not found on disk.
        Functions\when('rest_url')->returnArg(1);
        $inlineScript = '';
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript) {
            $inlineScript .= $code;
        });
        Velora_Club_Plugin::enqueue_assets();
        self::assertStringNotContainsString('secret-api-key-456', $inlineScript);
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
        Velora_Club_Plugin::enqueue_assets();
        self::assertStringContainsString('contactProxyUrl', $inlineScript);
        // wp_json_encode may escape "/" as "\/" — accept both forms
        self::assertMatchesRegularExpression('#velora-club(\\\\?)/v1(\\\\?)/contact#', $inlineScript);
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
        Velora_Club_Plugin::enqueue_admin_assets('some_other_page');
        self::assertEmpty($enqueued, 'No scripts or styles should be enqueued on wrong hook');
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

        Velora_Club_Plugin::enqueue_admin_assets('toplevel_page_velora-club');

        self::assertNotEmpty($enqueued, 'Expected scripts/styles to be enqueued on correct hook');
        self::assertContains('script:velora-club-admin-test', $enqueued);
        self::assertContains('style:velora-club-admin-test', $enqueued);

        // The "Test connection" button reaches an administrator-only REST route
        // that rejects a request without the wp_rest nonce, so both the route
        // URL and the nonce have to travel in this config. Without them the
        // button would silently report a network error on every click.
        $config = json_decode(rtrim(substr($inline, (int) strpos($inline, '{')), ';'), true);
        self::assertSame(
            'https://example.com/wp-json/velora-club/v1/test-connection',
            $config['restUrl'],
        );
        self::assertSame('nonce-abc', $config['nonce']);
    }

    // -----------------------------------------------------------------------
    // render_settings_page() — early-return without capability
    // -----------------------------------------------------------------------

    public function test_render_settings_page_exits_without_manage_options(): void
    {
        Functions\when('current_user_can')->justReturn(false);
        Velora_Club_Plugin::render_settings_page();
        $this->addToAssertionCount(1);
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
            Velora_Club_Plugin::render_settings_page();
        } finally {
            restore_error_handler();
        }
        $this->addToAssertionCount(1); // method reached include_once branch
    }
}
