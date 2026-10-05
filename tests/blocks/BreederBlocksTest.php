<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Exposes protected abstract method implementations for direct assertion.
 * Production code never extends this — test-only subclass.
 */
class BreederBlocksTestProxy extends Velora_Breeder_Blocks
{
    public static function public_editor_script_handle(): string { return static::editor_script_handle(); }
    public static function public_editor_js_url(): string        { return static::editor_js_url(); }
}

/**
 * Test-only subclass that points editor_js_path() to a file that actually
 * exists on disk so enqueue_editor_assets() proceeds past the file_exists()
 * guard. Uses the PHPUnit bootstrap — guaranteed present during test runs.
 */
class BreederBlocksFileExistsProxy extends Velora_Breeder_Blocks
{
    protected static function editor_js_path(): string   { return __DIR__ . '/../bootstrap.php'; }
    protected static function editor_js_url(): string    { return 'https://example.com/editor.js'; }
    protected static function editor_script_handle(): string { return 'velora-test-editor-handle'; }
    protected static function get_blocks(): array        { return []; }
}

/**
 * Same trick as BreederBlocksFileExistsProxy, but keeps the real handle,
 * text domain and languages path so the wp_set_script_translations()
 * arguments can be asserted as shipped.
 */
class BreederBlocksTranslationsProxy extends Velora_Breeder_Blocks
{
    protected static function editor_js_path(): string { return __DIR__ . '/../bootstrap.php'; }
}

/**
 * Tests for Velora_Breeder_Blocks.
 *
 * register_block_type is declared in bootstrap.php (before Patchwork loads),
 * so it writes to the $velora_test_registered_blocks global instead of being
 * mocked via Brain Monkey. Tests reset that global in setUp.
 *
 * Verifies:
 *  1. init() registers the two expected WP hooks.
 *  2. register_blocks() registers all 7 expected blocks with render callbacks.
 *  3. The render_callback builds the shortcode string correctly.
 *  4. Empty / null attribute values are omitted from the shortcode string.
 *  5. Attribute values are XSS-escaped before inclusion.
 *  6. enqueue_editor_assets() skips when editor.js is missing.
 */
class BreederBlocksTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
        Functions\stubs(['add_action']);
        Functions\when('esc_attr')->alias('htmlspecialchars');
        // Reset the blocks capture global before each test.
        global $velora_test_registered_blocks;
        $velora_test_registered_blocks = [];
    }

    protected function tearDown(): void
    {
        Monkey\tearDown();
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // init()
    // -----------------------------------------------------------------------

    public function test_init_registers_two_hooks(): void
    {
        $registered = [];
        Functions\when('add_action')->alias(function ($hook, $callback) use (&$registered) {
            $registered[$hook] = $callback;
        });
        Velora_Breeder_Blocks::init();
        self::assertSame([Velora_Breeder_Blocks::class, 'register_blocks'],        $registered['init']);
        self::assertSame([Velora_Breeder_Blocks::class, 'enqueue_editor_assets'], $registered['enqueue_block_editor_assets']);
    }

    // -----------------------------------------------------------------------
    // register_blocks()
    // register_block_type is a user-defined stub in bootstrap.php that writes
    // to $velora_test_registered_blocks — no Brain Monkey override needed.
    // -----------------------------------------------------------------------

    public function test_register_blocks_registers_seven_blocks(): void
    {
        global $velora_test_registered_blocks;
        Velora_Breeder_Blocks::register_blocks();
        self::assertCount(7, $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-breeder/about',    $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-breeder/animals',  $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-breeder/gallery',  $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-breeder/listings', $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-breeder/posts',    $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-breeder/events',   $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-breeder/contact',  $velora_test_registered_blocks);
        // Litter data is private and must never get a public embed block.
        self::assertArrayNotHasKey('velora-breeder/litters', $velora_test_registered_blocks);
    }

    public function test_events_block_renders_the_events_shortcode(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-breeder/events']['render_callback']([
            'slug'        => 'my-cattery',
            'when'        => 'past',
            'show_filter' => 'false',
        ]);
        self::assertStringContainsString('[velora-breeder-events', $result);
        self::assertStringContainsString('when="past"', $result);
        self::assertStringContainsString('show_filter="false"', $result);
    }

    public function test_register_blocks_each_has_callable_render_callback(): void
    {
        global $velora_test_registered_blocks;
        Velora_Breeder_Blocks::register_blocks();
        foreach ($velora_test_registered_blocks as $name => $args) {
            self::assertArrayHasKey('render_callback', $args, "$name missing render_callback");
            self::assertIsCallable($args['render_callback'], "$name render_callback is not callable");
        }
    }

    // -----------------------------------------------------------------------
    // render_callback behaviour
    // -----------------------------------------------------------------------

    private function captureCallbacks(): array
    {
        global $velora_test_registered_blocks;
        Velora_Breeder_Blocks::register_blocks();
        return $velora_test_registered_blocks;
    }

    public function test_render_callback_builds_shortcode_with_attrs(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-breeder/about']['render_callback'](['slug' => 'my-cattery', 'theme' => 'auto']);
        self::assertStringContainsString('[velora-breeder-about', $result);
        self::assertStringContainsString('slug="my-cattery"', $result);
        self::assertStringContainsString('theme="auto"', $result);
    }

    public function test_render_callback_skips_empty_string_attrs(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-breeder/about']['render_callback'](['slug' => '', 'theme' => 'auto']);
        self::assertStringNotContainsString('slug=""', $result);
        self::assertStringContainsString('theme="auto"', $result);
    }

    public function test_render_callback_escapes_xss_in_attrs(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-breeder/about']['render_callback']([
            'slug'  => '"><script>xss</script>',
            'theme' => 'auto',
        ]);
        self::assertStringNotContainsString('<script>', $result);
    }

    public function test_render_callback_skips_null_attrs(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-breeder/animals']['render_callback']([
            'slug'  => 'my-cattery',
            'limit' => null,
            'theme' => 'auto',
        ]);
        self::assertStringNotContainsString('limit=', $result);
        self::assertStringContainsString('slug="my-cattery"', $result);
    }

    public function test_render_callback_returns_do_shortcode_output(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->justReturn('<div>rendered breeder about</div>');

        $result = $callbacks['velora-breeder/about']['render_callback'](['slug' => 's', 'theme' => 'light']);
        self::assertSame('<div>rendered breeder about</div>', $result);
    }

    // -----------------------------------------------------------------------
    // enqueue_editor_assets() — editor.js does not exist at test path
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Abstract method implementations — editor_script_handle / editor_js_url
    // -----------------------------------------------------------------------

    public function test_editor_script_handle_returns_correct_value(): void
    {
        self::assertSame('velora-breeder-blocks-editor', BreederBlocksTestProxy::public_editor_script_handle());
    }

    public function test_editor_js_url_contains_plugin_url_and_path(): void
    {
        $url = BreederBlocksTestProxy::public_editor_js_url();
        self::assertStringContainsString(VELORA_BREEDER_PLUGIN_URL, $url);
        self::assertStringContainsString('blocks/editor.js', $url);
    }

    public function test_enqueue_editor_assets_skips_when_file_missing(): void
    {
        $enqueued = [];
        Functions\when('wp_enqueue_script')->alias(function ($handle) use (&$enqueued) {
            $enqueued[] = $handle;
        });
        // VELORA_BREEDER_PLUGIN_DIR = '/plugins/velora-breeder-widgets/' — does not exist.
        Velora_Breeder_Blocks::enqueue_editor_assets();
        self::assertEmpty($enqueued, 'wp_enqueue_script must not be called when editor.js is absent');
    }

    // -----------------------------------------------------------------------
    // enqueue_editor_assets() — editor.js exists at test-proxy path
    //
    // BreederBlocksFileExistsProxy redirects editor_js_path() to bootstrap.php
    // (a real file on disk), so file_exists() returns true and the wp_enqueue_script
    // branch executes — covering the previously-uncovered lines 85-91.
    // -----------------------------------------------------------------------

    public function test_enqueue_editor_assets_enqueues_when_file_exists(): void
    {
        $enqueued = [];
        Functions\when('wp_enqueue_script')->alias(function ($handle) use (&$enqueued) {
            $enqueued[] = $handle;
        });
        Functions\stubs(['wp_set_script_translations']);

        BreederBlocksFileExistsProxy::enqueue_editor_assets();

        self::assertContains(
            'velora-test-editor-handle',
            $enqueued,
            'wp_enqueue_script must be called with the editor handle when editor.js exists',
        );
    }

    /**
     * The editor.js strings go through wp.i18n.__(), which needs the JSON
     * translation files — a .mo only reaches PHP. Without this call a Polish
     * user sees English block titles.
     */
    public function test_enqueue_editor_assets_registers_script_translations(): void
    {
        Functions\stubs(['wp_enqueue_script']);
        $calls = [];
        Functions\when('wp_set_script_translations')->alias(
            function ($handle, $domain, $path) use (&$calls) {
                $calls[] = [$handle, $domain, $path];
            }
        );

        BreederBlocksTranslationsProxy::enqueue_editor_assets();

        self::assertCount(1, $calls);
        self::assertSame('velora-breeder-blocks-editor', $calls[0][0]);
        self::assertSame('velora-breeder-widgets',       $calls[0][1]);
        self::assertSame(VELORA_BREEDER_PLUGIN_DIR . 'languages', $calls[0][2]);
    }

    // -----------------------------------------------------------------------
    // register_blocks() — pre-Gutenberg guard
    //
    // patchwork.json marks function_exists as redefinable, so we can simulate
    // a WordPress old enough to have no block editor and prove the guard
    // returns before touching register_block_type.
    // -----------------------------------------------------------------------

    public function test_register_blocks_returns_early_without_block_editor(): void
    {
        global $velora_test_registered_blocks;
        $patch = Patchwork\redefine('function_exists', function (string $name) {
            return $name === 'register_block_type' ? false : Patchwork\relay();
        });
        try {
            Velora_Breeder_Blocks::register_blocks();
        } finally {
            Patchwork\restore($patch);
        }
        self::assertSame([], $velora_test_registered_blocks, 'No block may be registered on pre-Gutenberg WordPress');
    }
}
