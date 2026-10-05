<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Exposes protected abstract method implementations for direct assertion.
 */
class ClubBlocksTestProxy extends Velora_Club_Blocks
{
    public static function public_editor_script_handle(): string { return static::editor_script_handle(); }
    public static function public_editor_js_url(): string        { return static::editor_js_url(); }
}

/**
 * Points editor_js_path() at a file that exists on disk (the PHPUnit
 * bootstrap) so enqueue_editor_assets() runs past the file_exists() guard.
 * Handle, text domain and languages path stay as shipped.
 */
class ClubBlocksTranslationsProxy extends Velora_Club_Blocks
{
    protected static function editor_js_path(): string { return __DIR__ . '/../bootstrap.php'; }
}

/**
 * Tests for Velora_Club_Blocks.
 *
 * Mirrors BreederBlocksTest for the club plugin.
 * register_block_type is a user-defined stub in bootstrap.php that writes to
 * $velora_test_registered_blocks — no Brain Monkey override needed.
 */
class ClubBlocksTest extends TestCase
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
        Velora_Club_Blocks::init();
        self::assertSame([Velora_Club_Blocks::class, 'register_blocks'],        $registered['init']);
        self::assertSame([Velora_Club_Blocks::class, 'enqueue_editor_assets'], $registered['enqueue_block_editor_assets']);
    }

    // -----------------------------------------------------------------------
    // register_blocks()
    // -----------------------------------------------------------------------

    public function test_register_blocks_registers_eight_blocks(): void
    {
        global $velora_test_registered_blocks;
        Velora_Club_Blocks::register_blocks();
        self::assertCount(8, $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/about',     $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/breeders',  $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/listings',  $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/posts',     $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/events',    $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/documents', $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/gallery',   $velora_test_registered_blocks);
        self::assertArrayHasKey('velora-club/contact',   $velora_test_registered_blocks);
    }

    public function test_register_blocks_each_has_callable_render_callback(): void
    {
        global $velora_test_registered_blocks;
        Velora_Club_Blocks::register_blocks();
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
        Velora_Club_Blocks::register_blocks();
        return $velora_test_registered_blocks;
    }

    public function test_render_callback_builds_shortcode_with_attrs(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-club/about']['render_callback'](['slug' => 'my-club', 'theme' => 'auto']);
        self::assertStringContainsString('[velora-club-about', $result);
        self::assertStringContainsString('slug="my-club"', $result);
        self::assertStringContainsString('theme="auto"', $result);
    }

    public function test_render_callback_skips_empty_string_attrs(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-club/about']['render_callback'](['slug' => '', 'theme' => 'dark']);
        self::assertStringNotContainsString('slug=""', $result);
        self::assertStringContainsString('theme="dark"', $result);
    }

    public function test_render_callback_escapes_xss_in_attrs(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->returnArg(1);

        $result = $callbacks['velora-club/about']['render_callback']([
            'slug'  => '"><script>xss</script>',
            'theme' => 'auto',
        ]);
        self::assertStringNotContainsString('<script>', $result);
    }

    public function test_render_callback_returns_do_shortcode_output(): void
    {
        $callbacks = $this->captureCallbacks();
        Functions\when('do_shortcode')->justReturn('<div>club breeders</div>');

        $result = $callbacks['velora-club/breeders']['render_callback'](['slug' => 'gff', 'limit' => 50, 'layout' => 'auto', 'theme' => 'light']);
        self::assertSame('<div>club breeders</div>', $result);
    }

    // -----------------------------------------------------------------------
    // enqueue_editor_assets()
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Abstract method implementations — editor_script_handle / editor_js_url
    // -----------------------------------------------------------------------

    public function test_editor_script_handle_returns_correct_value(): void
    {
        self::assertSame('velora-club-blocks-editor', ClubBlocksTestProxy::public_editor_script_handle());
    }

    public function test_editor_js_url_contains_plugin_url_and_path(): void
    {
        $url = ClubBlocksTestProxy::public_editor_js_url();
        self::assertStringContainsString(VELORA_CLUB_PLUGIN_URL, $url);
        self::assertStringContainsString('blocks/editor.js', $url);
    }

    public function test_enqueue_editor_assets_skips_when_file_missing(): void
    {
        $enqueued = [];
        Functions\when('wp_enqueue_script')->alias(function ($handle) use (&$enqueued) {
            $enqueued[] = $handle;
        });
        // VELORA_CLUB_PLUGIN_DIR = '/plugins/velora-club-widgets/' — does not exist.
        Velora_Club_Blocks::enqueue_editor_assets();
        self::assertEmpty($enqueued, 'wp_enqueue_script must not be called when editor.js is absent');
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

        ClubBlocksTranslationsProxy::enqueue_editor_assets();

        self::assertCount(1, $calls);
        self::assertSame('velora-club-blocks-editor', $calls[0][0]);
        self::assertSame('velora-club-widgets',       $calls[0][1]);
        self::assertSame(VELORA_CLUB_PLUGIN_DIR . 'languages', $calls[0][2]);
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
            Velora_Club_Blocks::register_blocks();
        } finally {
            Patchwork\restore($patch);
        }
        self::assertSame([], $velora_test_registered_blocks, 'No block may be registered on pre-Gutenberg WordPress');
    }
}
