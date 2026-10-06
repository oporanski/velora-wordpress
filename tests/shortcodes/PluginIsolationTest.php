<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * A single WordPress site may run the breeder AND the club plugin at once
 * (a breeder who also runs their club's website). Everything the two plugins
 * publish into the shared page namespace must therefore differ.
 *
 * The regression this guards against was silent, not loud: both plugins used
 * the handle 'velora-embed-core' and wrote window.VeloraEmbedConfig, so the
 * one enqueued later overwrote the other's contactProxyUrl. Breeder inquiries
 * were then POSTed to the club's REST proxy, which forwards them to the club
 * endpoint with the club's API key — the message was lost with no error shown.
 */
class PluginIsolationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
        Functions\stubs(['wp_register_script', 'wp_register_style', 'wp_script_is',
            'wp_style_is', 'wp_enqueue_script', 'wp_enqueue_style']);
        Functions\when('esc_attr')->alias('htmlspecialchars');
        Functions\when('wp_script_is')->justReturn(false);
        Functions\when('wp_style_is')->justReturn(false);
        Functions\when('get_option')->justReturn('');
        Functions\when('rest_url')->returnArg(1);
        Functions\when('__')->returnArg(1);
        Functions\when('esc_html')->alias('htmlspecialchars');
        Functions\when('esc_url')->returnArg(1);
    }

    protected function tearDown(): void
    {
        Monkey\tearDown();
        parent::tearDown();
    }

    /** Returns [handles, inlineScript] produced by one plugin's enqueue_assets(). */
    private function captureEnqueue(callable $enqueueAssets): array
    {
        $handles      = [];
        $inlineScript = '';
        Functions\when('wp_register_script')->alias(function ($handle) use (&$handles) {
            $handles[] = $handle;
        });
        Functions\when('wp_register_style')->alias(function ($handle) use (&$handles) {
            $handles[] = $handle;
        });
        Functions\when('wp_add_inline_script')->alias(function ($handle, $code, $position = '') use (&$inlineScript) {
            $inlineScript .= $code;
        });
        $enqueueAssets();
        return [array_unique($handles), $inlineScript];
    }

    public function test_the_two_plugins_register_different_asset_handles(): void
    {
        [$breederHandles] = $this->captureEnqueue([Velora_Breeder_Plugin::class, 'enqueue_assets']);
        [$clubHandles]    = $this->captureEnqueue([Velora_Club_Plugin::class, 'enqueue_assets']);

        self::assertSame(['velora-breeder-embed-core'], array_values($breederHandles));
        self::assertSame(['velora-club-embed-core'], array_values($clubHandles));
        self::assertEmpty(array_intersect($breederHandles, $clubHandles));
    }

    public function test_the_two_plugins_publish_different_config_globals(): void
    {
        [, $breederScript] = $this->captureEnqueue([Velora_Breeder_Plugin::class, 'enqueue_assets']);
        [, $clubScript]    = $this->captureEnqueue([Velora_Club_Plugin::class, 'enqueue_assets']);

        self::assertStringStartsWith('window.VeloraBreederEmbedConfig = ', $breederScript);
        self::assertStringStartsWith('window.VeloraClubEmbedConfig = ', $clubScript);
    }

    public function test_each_config_carries_its_own_contact_proxy_route(): void
    {
        [, $breederScript] = $this->captureEnqueue([Velora_Breeder_Plugin::class, 'enqueue_assets']);
        [, $clubScript]    = $this->captureEnqueue([Velora_Club_Plugin::class, 'enqueue_assets']);

        // wp_json_encode escapes "/" as "\/" — match both forms.
        self::assertMatchesRegularExpression('#velora-breeder(\\\\?)/v1(\\\\?)/contact#', $breederScript);
        self::assertMatchesRegularExpression('#velora-club(\\\\?)/v1(\\\\?)/contact#', $clubScript);
        self::assertStringNotContainsString('velora-club', $breederScript);
        self::assertStringNotContainsString('velora-breeder', $clubScript);
    }

    /**
     * Returns the shortcode callbacks a plugin actually registers.
     *
     * Derived from register_shortcodes() rather than from a list written out
     * here: a hand-kept list silently stops covering a shortcode the day one
     * is added, which is exactly the moment this test is supposed to speak up.
     */
    private function registeredShortcodeCallbacks(string $pluginClass): array
    {
        $callbacks = [];
        Functions\when('add_shortcode')->alias(function ($tag, $callback) use (&$callbacks) {
            $callbacks[$tag] = $callback;
        });
        // register_shortcodes() is protected — Reflection is the only way in.
        (new ReflectionMethod($pluginClass, 'register_shortcodes'))->invoke(null);
        return $callbacks;
    }

    public function test_every_widget_mount_point_names_its_own_config_global(): void
    {
        $expectedGlobals = [
            Velora_Breeder_Plugin::class => 'VeloraBreederEmbedConfig',
            Velora_Club_Plugin::class    => 'VeloraClubEmbedConfig',
        ];

        foreach ($expectedGlobals as $pluginClass => $configGlobal) {
            $callbacks = $this->registeredShortcodeCallbacks($pluginClass);
            self::assertNotEmpty($callbacks, $pluginClass . ' registers no shortcodes');

            foreach ($callbacks as $tag => $callback) {
                self::assertIsCallable($callback, $tag);
                $html = $callback([]);
                // A shortcode that renders static markup has no mount point and
                // therefore names no config global. The pairing is asserted both
                // ways round so this branch cannot quietly swallow a real mount
                // point whose config global went missing.
                if (!str_contains($html, 'data-velora-widget')) {
                    self::assertStringNotContainsString('data-velora-config', $html, $tag);
                    continue;
                }
                self::assertStringContainsString(
                    'data-velora-config="' . $configGlobal . '"',
                    $html,
                    $tag
                );
            }
        }
    }

    /**
     * Both plugins live on one page, so their shortcode tags share a namespace.
     * A collision would make WordPress keep whichever registered last.
     */
    public function test_the_two_plugins_register_disjoint_shortcode_tags(): void
    {
        $breederTags = array_keys($this->registeredShortcodeCallbacks(Velora_Breeder_Plugin::class));
        $clubTags    = array_keys($this->registeredShortcodeCallbacks(Velora_Club_Plugin::class));

        self::assertEmpty(array_intersect($breederTags, $clubTags));
    }
}
