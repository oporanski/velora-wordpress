<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Tests for Velora_Club_Rest — mirrors BreederRestTest.
 * Verifies club-specific behaviour: /v1/clubs/ entity path, club rate-limit
 * prefix and the club-scoped name of the proxy-trust filter.
 */
class ClubRestTest extends TestCase
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

    public function test_rate_limit_blocks_after_five_hits(): void
    {
        Functions\when('get_transient')->justReturn(5);

        $result = Velora_Club_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_Error::class, $result);
        self::assertSame('rate_limited', $result->code);
        self::assertSame(429, $result->data['status']);
    }

    public function test_missing_api_base_returns_500(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias(function (string $key, mixed $default = ''): mixed {
            return $key === Velora_Club_Plugin::OPTION_API_BASE ? '' : 'some-key';
        });

        $result = Velora_Club_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_Error::class, $result);
        self::assertSame('misconfigured', $result->code);
        self::assertSame(500, $result->data['status']);
    }

    public function test_upstream_wp_error_returns_502(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias($this->configuredOptions());
        Functions\when('wp_remote_post')->justReturn(new WP_Error('http_request_failed', 'cURL error'));

        $result = Velora_Club_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_Error::class, $result);
        self::assertSame('upstream_unreachable', $result->code);
        self::assertSame(502, $result->data['status']);
    }

    public function test_proxy_uses_clubs_entity_path(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias($this->configuredOptions());
        Functions\expect('wp_remote_post')
            ->once()
            ->with(Mockery::pattern('#/v1/clubs/my-club/contact$#'), Mockery::type('array'))
            ->andReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{}');

        $result = Velora_Club_Rest::handle_contact($this->request(['slug' => 'my-club']));

        self::assertInstanceOf(WP_REST_Response::class, $result);
    }

    public function test_rate_limit_key_uses_club_prefix(): void
    {
        $_SERVER['REMOTE_ADDR'] = '5.5.5.5';
        $expectedKey = 'velora_club_contact_rl_' . hash('sha256', '5.5.5.5');

        Functions\when('get_transient')->justReturn(0);
        Functions\expect('set_transient')
            ->once()
            ->with($expectedKey, 1, HOUR_IN_SECONDS);
        Functions\when('get_option')->justReturn('');

        Velora_Club_Rest::handle_contact($this->request());
        $this->addToAssertionCount(1);
    }

    public function test_successful_proxy_relays_status_and_body(): void
    {
        Functions\when('get_transient')->justReturn(0);
        Functions\when('set_transient')->justReturn(true);
        Functions\when('get_option')->alias($this->configuredOptions());
        Functions\when('wp_remote_post')->justReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{"sent":true}');

        $result = Velora_Club_Rest::handle_contact($this->request());

        self::assertInstanceOf(WP_REST_Response::class, $result);
        self::assertSame(['sent' => true], $result->data);
    }

    // -----------------------------------------------------------------------
    // client_ip() — tested indirectly via the rate-limit key.
    //
    // The rate limit is per client IP, so picking the wrong candidate lets a
    // visitor keep submitting under a fresh key. The club plugin ships its own
    // copy of the base class (Velora_Club_Base_Rest), so this precedence is
    // asserted here too and not only on the breeder side.
    // -----------------------------------------------------------------------

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
    // init() + register_routes() — covers club route_namespace concrete method
    // -----------------------------------------------------------------------

    public function test_init_registers_rest_api_hook(): void
    {
        $registered = [];
        Functions\when('add_action')->alias(function () use (&$registered) {
            [$hook, $callback] = func_get_args();
            $registered[$hook] = $callback;
        });
        Velora_Club_Rest::init();
        self::assertSame([Velora_Club_Rest::class, 'register_routes'], $registered['rest_api_init']);
    }

    public function test_register_routes_uses_club_namespace(): void
    {
        $routes = $this->captureRegisteredRoutes();

        self::assertSame(['velora-club/v1'], array_values(array_unique(array_column($routes, 'namespace'))));
        self::assertSame(['/contact', '/test-connection'], array_keys($routes));
    }

    public function test_register_routes_permission_callback_requires_captcha_token(): void
    {
        // Invoke the registered permission_callback directly — a route that
        // accepted an empty captcha token would let the proxy be used as an
        // open relay to the Velora contact endpoint.
        $permissionCallback = $this->captureRegisteredRoutes()['/contact']['args']['permission_callback'];
        self::assertIsCallable($permissionCallback);

        self::assertTrue(
            $permissionCallback(new WP_REST_Request(['captchaToken' => 'tok-abc'])),
            'Non-empty token must be allowed',
        );
        self::assertFalse(
            $permissionCallback(new WP_REST_Request([])),
            'Empty token must be denied',
        );
    }

    // -----------------------------------------------------------------------
    // /test-connection — administrator-only diagnostic
    //
    // BreederRestTest covers every branch of the shared logic; asserted here is
    // what differs per plugin (the clubs entity path) plus the guard, because
    // the club plugin ships its own copy of the base class.
    // -----------------------------------------------------------------------

    public function test_test_connection_is_denied_without_manage_options(): void
    {
        Functions\when('current_user_can')->justReturn(false);
        Functions\when('wp_verify_nonce')->justReturn(1);

        self::assertFalse(Velora_Club_Rest::can_test_connection($this->testRequest()));
    }

    public function test_test_connection_is_denied_when_the_nonce_is_wrong(): void
    {
        Functions\when('current_user_can')->justReturn(true);
        Functions\when('wp_verify_nonce')->justReturn(false);

        self::assertFalse(Velora_Club_Rest::can_test_connection($this->testRequest()));
    }

    public function test_test_connection_is_allowed_for_an_admin_with_a_valid_nonce(): void
    {
        Functions\when('current_user_can')->justReturn(true);
        Functions\when('wp_verify_nonce')->justReturn(1);

        self::assertTrue(Velora_Club_Rest::can_test_connection($this->testRequest()));
    }

    public function test_test_connection_uses_the_clubs_entity_path_with_a_bearer_token(): void
    {
        $captured = [];
        $this->stubUrlHelpers();
        Functions\when('wp_remote_get')->alias(function ($url, $args) use (&$captured) {
            $captured = ['url' => $url, 'args' => $args];
            return ['stub'];
        });
        Functions\when('wp_remote_retrieve_response_code')->justReturn(200);
        Functions\when('wp_remote_retrieve_body')->justReturn('{"name":"Kot Klub"}');

        $response = Velora_Club_Rest::handle_test_connection($this->testRequest());

        self::assertSame('https://api.velora.pet/v1/clubs/test-club', $captured['url']);
        self::assertSame('Bearer vk_live_abcdef1234567890', $captured['args']['headers']['Authorization']);
        self::assertSame(['state' => 'success', 'code' => 'ok', 'name' => 'Kot Klub'], $response->data);
    }

    /**
     * The club plugin runs its own generated copy of the base class, so the
     * whole result mapping is exercised here too — a divergence between the two
     * copies would otherwise surface only on a user's site.
     *
     * @dataProvider apiReplies
     * @param array<string,string> $expected
     */
    public function test_test_connection_maps_api_replies_to_result_codes(
        int $status,
        string $body,
        array $expected
    ): void {
        $this->stubUrlHelpers();
        Functions\when('wp_remote_get')->justReturn(['stub']);
        Functions\when('wp_remote_retrieve_response_code')->justReturn($status);
        Functions\when('wp_remote_retrieve_body')->justReturn($body);

        $response = Velora_Club_Rest::handle_test_connection($this->testRequest());

        self::assertSame($expected, $response->data);
    }

    /** @return array<string,array{0:int,1:string,2:array<string,string>}> */
    public static function apiReplies(): array
    {
        return [
            'rejected key'       => [401, '{}', ['state' => 'error', 'code' => 'invalid_api_key']],
            'key of another org' => [403, '{}', ['state' => 'error', 'code' => 'key_org_mismatch']],
            'unknown slug'       => [404, '{}', ['state' => 'error', 'code' => 'slug_not_found']],
            'server error'       => [500, '',   ['state' => 'error', 'code' => 'api_unreachable']],
            'not the Velora API' => [200, '<html></html>', ['state' => 'error', 'code' => 'unexpected_response']],
        ];
    }

    public function test_test_connection_reports_an_unreachable_api_on_transport_failure(): void
    {
        $this->stubUrlHelpers();
        Functions\when('wp_remote_get')->justReturn(new WP_Error('http_request_failed', 'cURL error'));

        $response = Velora_Club_Rest::handle_test_connection($this->testRequest());

        self::assertSame(['state' => 'error', 'code' => 'api_unreachable'], $response->data);
    }

    public function test_test_connection_rejects_an_api_base_that_is_not_http(): void
    {
        $this->stubUrlHelpers();
        Functions\expect('wp_remote_get')->never();

        $response = Velora_Club_Rest::handle_test_connection(
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

        $response = Velora_Club_Rest::handle_test_connection(
            $this->testRequest(['apiBase' => '//attacker.example']),
        );

        self::assertSame(['state' => 'error', 'code' => 'invalid_api_base'], $response->data);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

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

    /** @return array<string,array{namespace:string,args:array}> keyed by route */
    private function captureRegisteredRoutes(): array
    {
        $routes = [];
        Functions\when('register_rest_route')->alias(
            function (string $namespace, string $route, array $args) use (&$routes): void {
                $routes[$route] = ['namespace' => $namespace, 'args' => $args];
            },
        );
        Velora_Club_Rest::register_routes();
        return $routes;
    }

    private function testRequest(array $params = []): WP_REST_Request
    {
        return new WP_REST_Request(
            array_merge([
                'apiBase' => 'https://api.velora.pet/',
                'slug'    => 'test-club',
                'apiKey'  => 'vk_live_abcdef1234567890',
            ], $params),
            ['X-WP-Nonce' => 'nonce-abc'],
        );
    }

    private function assertRateLimitKeyContainsIp(string $ip, bool $trustProxyHeaders = false): void
    {
        Filters\expectApplied('velora_club_trust_proxy_headers')
            ->andReturn($trustProxyHeaders);

        $expectedKey = 'velora_club_contact_rl_' . hash('sha256', $ip);

        Functions\when('get_transient')->justReturn(0);
        Functions\expect('set_transient')
            ->once()
            ->with($expectedKey, 1, HOUR_IN_SECONDS);
        Functions\when('get_option')->justReturn('');

        Velora_Club_Rest::handle_contact($this->request());
        $this->addToAssertionCount(1);
    }

    private function request(array $params = []): WP_REST_Request
    {
        return new WP_REST_Request(array_merge([
            'name'         => 'Anna Nowak',
            'email'        => 'anna@example.com',
            'message'      => 'Dzień dobry',
            'captchaToken' => 'tok-456',
            'slug'         => 'test-club',
        ], $params));
    }

    private function configuredOptions(): callable
    {
        return fn(string $k, mixed $d = '') => match ($k) {
            Velora_Club_Plugin::OPTION_API_BASE => 'https://api.velora.pet',
            Velora_Club_Plugin::OPTION_API_KEY  => 'key-abc',
            default                             => $d,
        };
    }
}
