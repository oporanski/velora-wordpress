<?php
/**
 * PHPUnit bootstrap — simulates the WordPress environment without loading WP.
 *
 * Strategy:
 *  - Define WP constants (ABSPATH, HOUR_IN_SECONDS, plugin constants).
 *  - Provide minimal stubs for WP classes (WP_Error, WP_REST_Request,
 *    WP_REST_Response) and a handful of WP functions that the test cannot
 *    reasonably mock per-test (e.g. is_wp_error).
 *  - All other WP functions (get_option, get_transient, wp_remote_post, …)
 *    are mocked per-test with Brain\Monkey — never stubbed globally here so
 *    each test stays explicit about what it expects.
 *  - Load plugin class files AFTER constants & stubs so their ABSPATH guard
 *    passes and they can reference the stub classes.
 */

require_once __DIR__ . '/../vendor/autoload.php';

// antecedent/patchwork ships without a composer autoload entry, so it has to be
// pulled in explicitly. It must load BEFORE the plugin class files below: only
// files included after this point get instrumented, and that instrumentation is
// what lets a test redefine an internal such as function_exists()
// (see patchwork.json → redefinable-internals).
require_once __DIR__ . '/../vendor/antecedent/patchwork/Patchwork.php';

// ---------------------------------------------------------------------------
// WordPress constants
// ---------------------------------------------------------------------------
define('ABSPATH', '/');
define('HOUR_IN_SECONDS', 3600);

// Breeder plugin constants
define('VELORA_BREEDER_PLUGIN_VERSION', '0.1.1');
define('VELORA_BREEDER_PLUGIN_DIR', '/plugins/velora-breeder-widgets/');
define('VELORA_BREEDER_PLUGIN_URL', 'https://example.com/wp-content/plugins/velora-breeder-widgets/');

// Club plugin constants
define('VELORA_CLUB_PLUGIN_VERSION', '0.1.1');
define('VELORA_CLUB_PLUGIN_DIR', '/plugins/velora-club-widgets/');
define('VELORA_CLUB_PLUGIN_URL', 'https://example.com/wp-content/plugins/velora-club-widgets/');

// ---------------------------------------------------------------------------
// WP class stubs
// ---------------------------------------------------------------------------

class WP_REST_Request
{
    private array $params;
    private array $headers;

    /**
     * @param array<string,mixed>  $params
     * @param array<string,string> $headers Header names as the plugin asks for
     *                                      them, e.g. 'X-WP-Nonce'.
     */
    public function __construct(array $params = [], array $headers = [])
    {
        $this->params  = $params;
        $this->headers = $headers;
    }

    public function get_param(string $key): mixed
    {
        return $this->params[$key] ?? null;
    }

    public function get_header(string $key): ?string
    {
        return $this->headers[$key] ?? null;
    }
}

class WP_REST_Response
{
    public function __construct(
        public readonly mixed $data,
        public readonly int   $status = 200,
    ) {}
}

class WP_Error
{
    public function __construct(
        public readonly string $code    = '',
        public readonly string $message = '',
        public readonly array  $data    = [],
    ) {}
}

// ---------------------------------------------------------------------------
// WP functions that are too fundamental to mock per-test
// ---------------------------------------------------------------------------

/**
 * Implemented here (not mocked) so assertions in tests can do:
 *   assertInstanceOf(WP_Error::class, $result)
 * instead of having to know Brain Monkey's mock return value.
 */
function is_wp_error(mixed $thing): bool
{
    return $thing instanceof WP_Error;
}

/**
 * Merge user-defined attributes into defaults array (real WP behaviour).
 * Defined here — not mocked — because shortcode tests assert on its output.
 */
function shortcode_atts(array $pairs, mixed $atts, string $shortcode = ''): array
{
    $atts = (array) $atts;
    $out  = [];
    foreach ($pairs as $key => $default) {
        $out[$key] = array_key_exists($key, $atts) ? $atts[$key] : $default;
    }
    return $out;
}

/** wp_json_encode — alias for json_encode (same behaviour for our use cases). */
function wp_json_encode(mixed $data, int $flags = 0, int $depth = 512): string|false
{
    return json_encode($data, $flags, $depth);
}

// ---------------------------------------------------------------------------
// Additional WP function stubs needed for blocks tests.
//
// register_block_type is declared here so function_exists('register_block_type')
// returns true in all tests. Brain Monkey cannot override it (defined before
// Patchwork), so tests use the global $velora_test_registered_blocks capture
// array instead of Functions\when('register_block_type').
// ---------------------------------------------------------------------------

$velora_test_registered_blocks = [];

if (!function_exists('register_block_type')) {
    function register_block_type(string $name, array $args): void
    {
        global $velora_test_registered_blocks;
        $velora_test_registered_blocks[$name] = $args;
    }
}

// ---------------------------------------------------------------------------
// Load plugin classes (AFTER constants & stubs)
// ---------------------------------------------------------------------------

// Base classes — must come first (concrete classes extend them).
//
// These are the GENERATED per-plugin copies (make wp-plugins-build), never
// shared/ itself. Loading both copies into one PHP process reproduces exactly
// what WordPress does when a site has both plugins active, which makes this
// bootstrap a regression test for the class-name collision that used to fatal
// such a site: if the Breeder and Club prefixes ever converge again, PHP throws
// "Cannot declare class ... already in use" and the whole suite dies on start.
// Do NOT "simplify" this back to loading shared/ once — that arrangement exists
// on no user's installation and is precisely why the collision shipped.
//
// Consequence: `make wp-plugins-build` must run before PHPUnit. The
// test-wp-plugins and coverage-wp-plugins targets depend on it.
require_once __DIR__ . '/../breeder/includes/class-base-rest.php';
require_once __DIR__ . '/../breeder/includes/class-base-plugin.php';
require_once __DIR__ . '/../breeder/includes/class-base-blocks.php';
require_once __DIR__ . '/../club/includes/class-base-rest.php';
require_once __DIR__ . '/../club/includes/class-base-plugin.php';
require_once __DIR__ . '/../club/includes/class-base-blocks.php';

require_once __DIR__ . '/../breeder/includes/class-plugin.php';
require_once __DIR__ . '/../breeder/includes/class-rest.php';
require_once __DIR__ . '/../breeder/includes/class-blocks.php';
require_once __DIR__ . '/../club/includes/class-plugin.php';
require_once __DIR__ . '/../club/includes/class-rest.php';
require_once __DIR__ . '/../club/includes/class-blocks.php';
