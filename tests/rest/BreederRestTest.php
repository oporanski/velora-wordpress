<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Tests for Velora_Breeder_Rest — the server-side proxy for the breeder
 * contact form plus the settings page's connection diagnostic.
 *
 * Security focus:
 *  - Rate limiting must block after 5 hits per IP.
 *  - Misconfigured plugin must return 500, never expose a partial proxy.
 *  - Upstream WP_Error must surface as 502, not a PHP crash.
 *  - client_ip() must ignore visitor-supplied proxy headers unless the site
 *    opted in, because the limit is keyed on whatever it returns.
 *  - /test-connection must be reachable only by an administrator holding a
 *    valid nonce, and must never echo the API key back.
 */
class BreederRestTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
        Functions\stubs(['add_action', 'add_filter', '__', 'esc_html__',
            'wp_unslash', 'sanitize_text_field']);
    }

    protected function tearDown(): void
    {
        Monkey\tearDown();
        parent::tearDown();
        unset(
            $_SERVER['HTTP_CF_CONNECTING_IP'],
            $_SERVER['HTTP_X_FORWARDED_FOR'],
            $_SERVER['REMOTE_ADDR'],
        );
    }

    // -----------------------------------------------------------------------
    // Rate limiting
    // -----------------------------------------------------------------------

    public function test_rate_limit_blocks_after_five_hits(): void
    {
        Functions\when('get_transient')->justReturn(5);

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_Error::class, $result);
        self::assertSame('rate_limited', $result->code);
        self::assertSame(429, $result->data['status']);
    }

    public function test_rate_limit_allows_first_hit(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        // returnArg() returns the first argument — the option key string, which is truthy
        Functions\when('get_option')->returnArg();

        Functions\when('wp_remote_post')->justReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{}');

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_REST_Response::class, $result);
        self::assertSame(200, $result->status);
    }

    public function test_rate_limit_increments_counter(): void
    {
        Functions\when('get_transient')->justReturn(2);
        Functions\expect('set_transient')
            ->once()
            ->with(Mockery::type('string'), 3, HOUR_IN_SECONDS);
        Functions\when('get_option')->returnArg();
        Functions\when('wp_remote_post')->justReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{}');

        Velora_Breeder_Rest::handle_contact($this->request());
        $this->addToAssertionCount(1); // Mockery expectation counts as 1
    }

    // -----------------------------------------------------------------------
    // Configuration validation
    // -----------------------------------------------------------------------

    public function test_missing_api_base_returns_500(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias(function (string $key, mixed $default = ''): mixed {
            return $key === Velora_Breeder_Plugin::OPTION_API_BASE ? '' : 'some-key';
        });

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_Error::class, $result);
        self::assertSame('misconfigured', $result->code);
        self::assertSame(500, $result->data['status']);
    }

    public function test_missing_api_key_returns_500(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias(function (string $key, mixed $default = ''): mixed {
            return $key === Velora_Breeder_Plugin::OPTION_API_KEY ? '' : 'https://api.velora.pet';
        });

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_Error::class, $result);
        self::assertSame('misconfigured', $result->code);
        self::assertSame(500, $result->data['status']);
    }

    // -----------------------------------------------------------------------
    // Upstream proxy behaviour
    // -----------------------------------------------------------------------

    public function test_upstream_wp_error_returns_502(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias($this->configuredOptions());
        Functions\when('wp_remote_post')->justReturn(new WP_Error('http_request_failed', 'cURL error'));

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_Error::class, $result);
        self::assertSame('upstream_unreachable', $result->code);
        self::assertSame(502, $result->data['status']);
    }

    public function test_successful_proxy_relays_status_and_body(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias($this->configuredOptions());
        Functions\when('wp_remote_post')->justReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(201);
        Functions\when('wp_remote_retrieve_body')->justReturn('{"ok":true}');

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_REST_Response::class, $result);
        self::assertSame(201, $result->status);
        self::assertSame(['ok' => true], $result->data);
    }

    public function test_proxy_forwards_slug_in_url(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias($this->configuredOptions());
        Functions\expect('wp_remote_post')
            ->once()
            ->with(Mockery::pattern('#/v1/breeders/my-cattery/contact$#'), Mockery::type('array'))
            ->andReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{}');

        $result = Velora_Breeder_Rest::handle_contact($this->request(['slug' => 'my-cattery']));

        self::assertInstanceOf(WP_REST_Response::class, $result);
    }

    public function test_proxy_strips_trailing_slash_from_api_base(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias(function (string $key, mixed $default = ''): mixed {
            return match ($key) {
                Velora_Breeder_Plugin::OPTION_API_BASE => 'https://api.velora.pet/',
                Velora_Breeder_Plugin::OPTION_API_KEY  => 'key-abc',
                default                                => $default,
            };
        });
        Functions\expect('wp_remote_post')
            ->once()
            ->with(Mockery::not(Mockery::pattern('#//v1/#')), Mockery::type('array'))
            ->andReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{}');

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_REST_Response::class, $result);
    }

    public function test_proxy_includes_bearer_auth_header(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias(function (string $key, mixed $default = ''): mixed {
            return match ($key) {
                Velora_Breeder_Plugin::OPTION_API_BASE => 'https://api.velora.pet',
                Velora_Breeder_Plugin::OPTION_API_KEY  => 'secret-key',
                default                                => $default,
            };
        });
        Functions\expect('wp_remote_post')
            ->once()
            ->with(
                Mockery::type('string'),
                Mockery::on(fn(array $args) => ($args['headers']['Authorization'] ?? '') === 'Bearer secret-key'),
            )
            ->andReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{}');

        $result = Velora_Breeder_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_REST_Response::class, $result);
    }

    // -----------------------------------------------------------------------
    // client_ip() — tested indirectly via the rate-limit key
    // -----------------------------------------------------------------------

    /**
     * The regression this guards: with the headers trusted unconditionally, a
     * visitor rotating X-Forwarded-For got a fresh rate-limit bucket on every
     * request — seven submissions all went through — and the forged value was
     * forwarded to the Velora API, which limits on it as well.
     */
    public function test_client_ip_ignores_visitor_supplied_proxy_headers_by_default(): void
    {
        $_SERVER['HTTP_CF_CONNECTING_IP'] = '9.9.9.9';
        $_SERVER['HTTP_X_FORWARDED_FOR']  = '8.8.8.8';
        $_SERVER['REMOTE_ADDR']           = '3.3.3.3';

        $this->assertRateLimitKeyContainsIp('3.3.3.3');
    }

    public function test_client_ip_prefers_cf_connecting_ip_when_proxy_trust_is_enabled(): void
    {
        $_SERVER['HTTP_CF_CONNECTING_IP'] = '1.1.1.1';
        $_SERVER['HTTP_X_FORWARDED_FOR']  = '2.2.2.2';
        $_SERVER['REMOTE_ADDR']           = '3.3.3.3';

        $this->assertRateLimitKeyContainsIp('1.1.1.1', true);
    }

    public function test_client_ip_falls_back_to_x_forwarded_for_when_proxy_trust_is_enabled(): void
    {
        unset($_SERVER['HTTP_CF_CONNECTING_IP']);
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '2.2.2.2, 10.0.0.1';
        $_SERVER['REMOTE_ADDR']          = '3.3.3.3';

        $this->assertRateLimitKeyContainsIp('2.2.2.2', true);
    }

    public function test_client_ip_falls_back_to_remote_addr(): void
    {
        unset($_SERVER['HTTP_CF_CONNECTING_IP'], $_SERVER['HTTP_X_FORWARDED_FOR']);
        $_SERVER['REMOTE_ADDR'] = '3.3.3.3';

        $this->assertRateLimitKeyContainsIp('3.3.3.3');
    }

    public function test_client_ip_skips_invalid_ip_in_cf_header(): void
    {
        $_SERVER['HTTP_CF_CONNECTING_IP'] = 'not-an-ip';
        $_SERVER['HTTP_X_FORWARDED_FOR']  = '2.2.2.2';
        unset($_SERVER['REMOTE_ADDR']);

        $this->assertRateLimitKeyContainsIp('2.2.2.2', true);
    }

    public function test_client_ip_returns_fallback_when_no_valid_ip(): void
    {
        unset($_SERVER['HTTP_CF_CONNECTING_IP'], $_SERVER['HTTP_X_FORWARDED_FOR'], $_SERVER['REMOTE_ADDR']);

        $this->assertRateLimitKeyContainsIp('0.0.0.0');
    }

    // -----------------------------------------------------------------------
    // init() + register_routes() — hook registration
    // -----------------------------------------------------------------------

    public function test_init_registers_rest_api_hook(): void
    {
        $registered = [];
        Functions\when('add_action')->alias(function () use (&$registered) {
            [$hook, $callback] = func_get_args();
            $registered[$hook] = $callback;
        });
        Velora_Breeder_Rest::init();
        self::assertSame([Velora_Breeder_Rest::class, 'register_routes'], $registered['rest_api_init']);
    }

    public function test_register_routes_uses_breeder_namespace(): void
    {
        $routes = $this->captureRegisteredRoutes();

        self::assertSame(['velora-breeder/v1'], array_values(array_unique(array_column($routes, 'namespace'))));
        self::assertSame(['/contact', '/test-connection'], array_keys($routes));
    }

    public function test_register_routes_permission_callback_requires_captcha_token(): void
    {
        // Capture the route definition so we can invoke the permission_callback
        // directly — this covers the closure body (lines 51-52 in class-base-rest.php)
        // that the stub-based namespace test leaves at count=0.
        $permissionCallback = $this->captureRegisteredRoutes()['/contact']['args']['permission_callback'];
        self::assertIsCallable($permissionCallback);

        $requestWithToken    = new WP_REST_Request(['captchaToken' => 'tok-abc']);
        $requestWithoutToken = new WP_REST_Request([]);

        self::assertTrue($permissionCallback($requestWithToken),    'Non-empty token must be allowed');
        self::assertFalse($permissionCallback($requestWithoutToken), 'Empty token must be denied');
    }

    public function test_test_connection_route_is_guarded_by_can_test_connection(): void
    {
        $route = $this->captureRegisteredRoutes()['/test-connection']['args'];

        self::assertSame('POST', $route['methods']);
        self::assertSame([Velora_Breeder_Rest::class, 'can_test_connection'], $route['permission_callback']);
    }

    // -----------------------------------------------------------------------
    // /test-connection — administrator-only diagnostic
    //
    // It makes the site issue an outbound request to an address the caller
    // chooses, and it is the only code path that handles the API key. Both
    // halves of its guard are asserted, and so is the promise that the key
    // never travels back to the browser.
    // -----------------------------------------------------------------------

    public function test_test_connection_is_denied_without_manage_options(): void
    {
        Functions\when('current_user_can')->justReturn(false);
        Functions\when('wp_verify_nonce')->justReturn(1);

        self::assertFalse(Velora_Breeder_Rest::can_test_connection($this->testRequest()));
    }

    public function test_test_connection_is_denied_when_the_nonce_is_wrong(): void
    {
        Functions\when('current_user_can')->justReturn(true);
        Functions\when('wp_verify_nonce')->justReturn(false);

        self::assertFalse(Velora_Breeder_Rest::can_test_connection($this->testRequest()));
    }

    public function test_test_connection_is_denied_when_the_nonce_header_is_absent(): void
    {
        Functions\when('current_user_can')->justReturn(true);
        Functions\when('wp_verify_nonce')->justReturn(1);

        self::assertFalse(Velora_Breeder_Rest::can_test_connection(new WP_REST_Request()));
    }

    public function test_test_connection_is_allowed_for_an_admin_with_a_valid_nonce(): void
    {
        Functions\when('current_user_can')->justReturn(true);
        Functions\when('wp_verify_nonce')->justReturn(1);

        self::assertTrue(Velora_Breeder_Rest::can_test_connection($this->testRequest()));
    }

    public function test_test_connection_sends_the_entered_key_as_a_bearer_token(): void
    {
        $this->stubUrlHelpers();
        $captured = [];
        Functions\when('wp_remote_get')->alias(function ($url, $args) use (&$captured) {
            $captured = ['url' => $url, 'args' => $args];
            return ['stub'];
        });
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{"name":"Kocia Dolina"}');

        Velora_Breeder_Rest::handle_test_connection($this->testRequest());

        self::assertSame('https://api.velora.pet/v1/breeders/test-cattery', $captured['url']);
        self::assertSame('Bearer vk_live_abcdef1234567890', $captured['args']['headers']['Authorization']);
    }

    public function test_test_connection_reports_a_rejected_key_on_401(): void
    {
        self::assertSame(
            ['state' => 'error', 'code' => 'invalid_api_key'],
            $this->runTestConnection(401, '{"message":"Invalid API key"}'),
        );
    }

    public function test_test_connection_reports_a_key_from_another_organisation_on_403(): void
    {
        self::assertSame(
            ['state' => 'error', 'code' => 'key_org_mismatch'],
            $this->runTestConnection(403, '{"message":"not authorized"}'),
        );
    }

    public function test_test_connection_reports_an_unknown_slug_on_404(): void
    {
        self::assertSame(
            ['state' => 'error', 'code' => 'slug_not_found'],
            $this->runTestConnection(404, '{}'),
        );
    }

    public function test_test_connection_reports_an_unreachable_api_on_500(): void
    {
        self::assertSame(
            ['state' => 'error', 'code' => 'api_unreachable'],
            $this->runTestConnection(500, ''),
        );
    }

    public function test_test_connection_reports_an_unexpected_response_when_the_body_has_no_name(): void
    {
        self::assertSame(
            ['state' => 'error', 'code' => 'unexpected_response'],
            $this->runTestConnection(200, '<html>not the API</html>'),
        );
    }

    public function test_test_connection_confirms_the_profile_and_the_key_on_200(): void
    {
        self::assertSame(
            ['state' => 'success', 'code' => 'ok', 'name' => 'Kocia Dolina'],
            $this->runTestConnection(200, '{"name":"Kocia Dolina"}'),
        );
    }

    public function test_test_connection_warns_when_no_key_was_entered(): void
    {
        // The profile is public, so a 200 without a key proves nothing about
        // the contact form — the only feature that needs the key.
        self::assertSame(
            ['state' => 'warning', 'code' => 'ok_no_key', 'name' => 'Kocia Dolina'],
            $this->runTestConnection(200, '{"name":"Kocia Dolina"}', ['apiKey' => '  ']),
        );
    }

    public function test_test_connection_omits_the_authorization_header_when_no_key_was_entered(): void
    {
        $this->stubUrlHelpers();
        $captured = [];
        Functions\when('wp_remote_get')->alias(function ($url, $args) use (&$captured) {
            $captured = $args;
            return ['stub'];
        });
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{"name":"Kocia Dolina"}');

        Velora_Breeder_Rest::handle_test_connection($this->testRequest(['apiKey' => '']));

        self::assertArrayNotHasKey('Authorization', $captured['headers']);
    }

    public function test_test_connection_reports_an_unreachable_api_on_transport_failure(): void
    {
        $this->stubUrlHelpers();
        Functions\when('wp_remote_get')->justReturn(new WP_Error('http_request_failed', 'cURL error'));

        $response = Velora_Breeder_Rest::handle_test_connection($this->testRequest());

        self::assertSame(['state' => 'error', 'code' => 'api_unreachable'], $response->data);
    }

    public function test_test_connection_rejects_an_api_base_that_is_not_http(): void
    {
        $this->stubUrlHelpers();
        Functions\expect('wp_remote_get')->never();

        $response = Velora_Breeder_Rest::handle_test_connection(
            $this->testRequest(['apiBase' => 'file:///etc/passwd']),
        );

        self::assertSame(['state' => 'error', 'code' => 'invalid_api_base'], $response->data);
    }

    public function test_test_connection_rejects_a_protocol_relative_api_base(): void
    {
        // esc_url_raw() leaves "//host" alone — it carries no bad protocol —
        // so the scheme check is what stops it becoming a relative request.
        $this->stubUrlHelpers();
        Functions\expect('wp_remote_get')->never();

        $response = Velora_Breeder_Rest::handle_test_connection(
            $this->testRequest(['apiBase' => '//attacker.example']),
        );

        self::assertSame(['state' => 'error', 'code' => 'invalid_api_base'], $response->data);
    }

    public function test_test_connection_never_returns_the_api_key(): void
    {
        $payload = $this->runTestConnection(200, '{"name":"Kocia Dolina"}');

        self::assertStringNotContainsString(
            'vk_live_abcdef1234567890',
            (string) wp_json_encode($payload),
        );
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function request(array $params = []): WP_REST_Request
    {
        return new WP_REST_Request(array_merge([
            'name'         => 'Jan Kowalski',
            'email'        => 'jan@example.com',
            'message'      => 'Dzień dobry',
            'captchaToken' => 'tok-123',
            'slug'         => 'test-cattery',
        ], $params));
    }

    private function configuredOptions(): callable
    {
        return fn(string $k, mixed $d = '') => match ($k) {
            Velora_Breeder_Plugin::OPTION_API_BASE => 'https://api.velora.pet',
            Velora_Breeder_Plugin::OPTION_API_KEY  => 'key-abc',
            default                                => $d,
        };
    }

    /** @return array<string,array{namespace:string,args:array}> keyed by route */
    private function captureRegisteredRoutes(): array
    {
        $routes = [];
        Functions\when('register_rest_route')->alias(
            function (string $namespace, string $route, array $args) use (&$routes): void {
                $routes[$route] = ['namespace' => $namespace, 'args' => $args];
            },
        );
        Velora_Breeder_Rest::register_routes();
        return $routes;
    }

    private function testRequest(array $params = []): WP_REST_Request
    {
        return new WP_REST_Request(
            array_merge([
                'apiBase' => 'https://api.velora.pet/',
                'slug'    => 'test-cattery',
                'apiKey'  => 'vk_live_abcdef1234567890',
            ], $params),
            ['X-WP-Nonce' => 'nonce-abc'],
        );
    }

    /**
     * Models the two WordPress URL helpers the diagnostic relies on.
     *
     * esc_url_raw() blanks a URL whose scheme is outside the allow-list but
     * passes a schemeless one through untouched — the behaviour that makes the
     * separate scheme check in normalize_api_base() necessary.
     */
    private function stubUrlHelpers(): void
    {
        Functions\when('esc_url_raw')->alias(
            function (string $url, array $protocols = ['http', 'https']): string {
                $scheme = parse_url($url, PHP_URL_SCHEME);
                if (!is_string($scheme)) {
                    return $url;
                }
                return in_array(strtolower($scheme), $protocols, true) ? $url : '';
            },
        );
        Functions\when('wp_parse_url')->alias(
            fn(string $url, int $component = -1) => parse_url($url, $component),
        );
    }

    /** Runs the diagnostic against a canned Velora API reply. */
    private function runTestConnection(int $status, string $body, array $params = []): array
    {
        $this->stubUrlHelpers();
        Functions\when('wp_remote_get')->justReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn($status);
        Functions\when('wp_remote_retrieve_body')->justReturn($body);

        return Velora_Breeder_Rest::handle_test_connection($this->testRequest($params))->data;
    }

    private function assertRateLimitKeyContainsIp(string $ip, bool $trustProxyHeaders = false): void
    {
        Filters\expectApplied('velora_breeder_trust_proxy_headers')
            ->andReturn($trustProxyHeaders);

        $expectedKey = 'velora_breeder_contact_rl_' . hash('sha256', $ip);

        Functions\when('get_transient')->justReturn(0);
        Functions\expect('set_transient')
            ->once()
            ->with($expectedKey, 1, HOUR_IN_SECONDS);
        Functions\when('get_option')->justReturn('');

        Velora_Breeder_Rest::handle_contact($this->request());
        $this->addToAssertionCount(1);
    }
}
