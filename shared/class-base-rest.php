<?php
/**
 * Abstract base for the server-side contact-form proxy.
 *
 * Each concrete subclass provides three pieces of plugin-specific identity
 * (route namespace, entity type, rate-limit key prefix), the names of the two
 * WP options that hold the API credentials, and the three already translated
 * error messages.  All proxy logic — rate limiting, config validation, HTTP
 * forwarding, IP extraction — lives here exactly once.
 *
 * Distribution note: WordPress.org forbids a plugin from depending on another
 * plugin, so each plugin ships its own copy of this class. `make wp-plugins-build`
 * generates those copies with a per-plugin class prefix (Velora_Breeder_Base_*,
 * Velora_Club_Base_*): two plugins declaring the same global class name is a
 * fatal error the moment both are active on one site.
 * This file: shared/class-base-rest.php (EDIT HERE, then run `make wp-plugins-build`).
 *
 * @package VeloraWidgets
 */

if (!defined('ABSPATH')) { exit; }

abstract class Velora_Base_Rest
{
    private const CONTENT_TYPE_JSON = 'application/json';

    /**
     * HTTP status returned by the Velora API -> settings-page result code.
     *
     * A lookup rather than a chain of early returns: the mapping is data, and
     * keeping it as data is what lets interpret_test_response() stay a single
     * decision with one error exit.
     */
    private const STATUS_FAILURE_CODES = [
        401 => 'invalid_api_key',
        403 => 'key_org_mismatch',
        404 => 'slug_not_found',
    ];

    /** REST route namespace, e.g. 'velora-breeder/v1'. */
    abstract protected static function route_namespace(): string;

    /** API entity segment, e.g. 'breeders' or 'clubs'. */
    abstract protected static function entity_type(): string;

    /** Transient key prefix for per-IP rate limiting. */
    abstract protected static function rate_limit_prefix(): string;

    /**
     * Whether this site opted into trusting reverse-proxy IP headers.
     *
     * Implemented in the concrete classes — never here — for the same reason
     * the translated messages below live there: the filter name has to be a
     * string literal. PHPCS reads apply_filters() statically and cannot resolve
     * a hook name assembled from a method call, so building it here would raise
     * PrefixAllGlobals.DynamicHooknameFound on a name that is in fact correctly
     * prefixed. See client_ip() for what the answer is used for.
     */
    abstract protected static function trust_proxy_headers(): bool;

    /** WP option name for the API base URL. */
    abstract protected static function api_base_option(): string;

    /** WP option name for the API key. */
    abstract protected static function api_key_option(): string;

    // -----------------------------------------------------------------------
    // Translated error messages.
    //
    // These live in the concrete classes — never here — because the gettext
    // parser reads __() statically and cannot resolve a text domain returned
    // by a method call.
    // -----------------------------------------------------------------------

    /** Message shown when the Velora API cannot be reached. */
    abstract protected static function upstream_unreachable_message(): string;

    /** Message shown when the per-IP submission rate limit is exceeded. */
    abstract protected static function rate_limited_message(): string;

    /** Message shown when API base or API key is missing from the settings. */
    abstract protected static function not_configured_message(): string;

    public static function init(): void
    {
        add_action('rest_api_init', [static::class, 'register_routes']);
    }

    public static function register_routes(): void
    {
        register_rest_route(static::route_namespace(), '/contact', [
            'methods'             => 'POST',
            'callback'            => [static::class, 'handle_contact'],
            'permission_callback' => function (\WP_REST_Request $request) {
                $token = $request->get_param('captchaToken');
                return !empty($token);
            },
            'args' => [
                'name'         => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'email'        => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_email'],
                'message'      => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'],
                'subject'      => ['required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'phone'        => ['required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'captchaToken' => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'slug'         => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_title'],
            ],
        ]);

        // Diagnostic behind the settings page's "Test connection" button.
        //
        // It runs server-side for one reason: the API key can only be checked
        // by sending it to the Velora API, and the browser must never hold it.
        // The values come from the settings form rather than from wp_options,
        // so an administrator can test a key they have pasted but not saved.
        register_rest_route(static::route_namespace(), '/test-connection', [
            'methods'             => 'POST',
            'callback'            => [static::class, 'handle_test_connection'],
            'permission_callback' => [static::class, 'can_test_connection'],
            'args' => [
                'apiBase' => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'esc_url_raw'],
                'slug'    => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_title'],
                'apiKey'  => ['required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);
    }

    /**
     * Only a settings-page administrator may run the diagnostic: it makes the
     * site issue an outbound request to an address chosen by the caller.
     *
     * WordPress already treats a cookie-authenticated REST call with a missing
     * nonce as logged out and rejects a wrong one, so `manage_options` alone
     * would be enough. The nonce is verified here as well so the requirement is
     * stated at the route instead of inherited from a global filter.
     */
    public static function can_test_connection(WP_REST_Request $request): bool
    {
        if (!current_user_can('manage_options')) {
            return false;
        }
        $nonce = $request->get_header('X-WP-Nonce');
        return is_string($nonce) && (bool) wp_verify_nonce($nonce, 'wp_rest');
    }

    /**
     * Asks the Velora API whether this API base, slug and key work together.
     *
     * One GET does all of it. The Velora API lets an unauthenticated GET
     * through, but once an Authorization header is present it validates the key
     * fully and checks that the key belongs to the organisation named by the
     * slug — so the single request separates "wrong slug" (404) from "bad key"
     * (401) from "key belongs to a different organisation" (403).
     *
     * The key itself never appears in the response or in any log line: the
     * result is a fixed machine-readable code, and the settings page turns that
     * code into a translated sentence.
     */
    public static function handle_test_connection(WP_REST_Request $request): WP_REST_Response
    {
        $api_base = static::normalize_api_base((string) $request->get_param('apiBase'));
        if ($api_base === null) {
            return new WP_REST_Response(['state' => 'error', 'code' => 'invalid_api_base'], 200);
        }

        $slug    = (string) $request->get_param('slug');
        $api_key = trim((string) $request->get_param('apiKey'));

        $headers = ['Accept' => self::CONTENT_TYPE_JSON];
        if ($api_key !== '') {
            $headers['Authorization'] = 'Bearer ' . $api_key;
        }

        $response = wp_remote_get(
            $api_base . '/v1/' . static::entity_type() . '/' . rawurlencode($slug),
            ['headers' => $headers, 'timeout' => 15]
        );

        if (is_wp_error($response)) {
            return new WP_REST_Response(['state' => 'error', 'code' => 'api_unreachable'], 200);
        }

        return new WP_REST_Response(
            static::interpret_test_response(
                (int) wp_remote_retrieve_response_code($response),
                (string) wp_remote_retrieve_body($response),
                $api_key !== ''
            ),
            200
        );
    }

    /**
     * Turns the Velora API's reply into the settings page's result code.
     *
     * @return array{state:string,code:string,name?:string}
     */
    private static function interpret_test_response(int $status, string $body, bool $key_sent): array
    {
        $data    = json_decode($body, true);
        $name    = is_array($data) && isset($data['name']) ? (string) $data['name'] : '';
        $failure = self::STATUS_FAILURE_CODES[$status] ?? null;

        if ($failure === null && ($status < 200 || $status > 299)) {
            $failure = 'api_unreachable';
        }
        if ($failure === null && $name === '') {
            $failure = 'unexpected_response';
        }
        if ($failure !== null) {
            return ['state' => 'error', 'code' => $failure];
        }

        // Without a key the profile lookup proves nothing about the contact
        // form, which is the only feature that needs one — say so rather than
        // reporting an unqualified success.
        return $key_sent
            ? ['state' => 'success', 'code' => 'ok',        'name' => $name]
            : ['state' => 'warning', 'code' => 'ok_no_key', 'name' => $name];
    }

    /**
     * Accepts an http(s) API base and returns it without a trailing slash,
     * or null when it is neither.
     *
     * The caller is an administrator who can already point the saved setting at
     * any host, so this is not a trust boundary — it keeps a typo (or a scheme
     * such as file://) from turning into a confusing failure further down.
     */
    private static function normalize_api_base(string $raw): ?string
    {
        $url = esc_url_raw($raw, ['http', 'https']);
        if ($url === '') {
            return null;
        }
        $scheme = strtolower((string) wp_parse_url($url, PHP_URL_SCHEME));
        if ($scheme !== 'http' && $scheme !== 'https') {
            return null;
        }
        return rtrim($url, '/');
    }

    public static function handle_contact(WP_REST_Request $request)
    {
        $ip       = static::client_ip();
        $guard_err = static::check_rate_limit($ip) ?? static::check_config();
        if ($guard_err !== null) {
            return $guard_err;
        }

        $api_base = rtrim((string) get_option(static::api_base_option(), ''), '/');
        $api_key  = (string) get_option(static::api_key_option(), '');
        $slug     = $request->get_param('slug');
        $payload  = [
            'name'         => $request->get_param('name'),
            'email'        => $request->get_param('email'),
            'message'      => $request->get_param('message'),
            'subject'      => $request->get_param('subject') ?: null,
            'phone'        => $request->get_param('phone') ?: null,
            'captchaToken' => $request->get_param('captchaToken'),
        ];

        $response = wp_remote_post(
            $api_base . '/v1/' . static::entity_type() . '/' . rawurlencode($slug) . '/contact',
            [
                'headers' => [
                    'Authorization'   => 'Bearer ' . $api_key,
                    'Content-Type'    => self::CONTENT_TYPE_JSON,
                    'Accept'          => self::CONTENT_TYPE_JSON,
                    'X-Forwarded-For' => $ip,
                ],
                'body'    => wp_json_encode($payload),
                'timeout' => 15,
            ]
        );

        if (is_wp_error($response)) {
            return new WP_Error(
                'upstream_unreachable',
                static::upstream_unreachable_message(),
                ['status' => 502]
            );
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);
        return new WP_REST_Response(json_decode($body, true), $status);
    }

    /** Returns a WP_Error if the rate limit is exceeded, null otherwise. */
    private static function check_rate_limit(string $ip): ?WP_Error
    {
        $rate_key = static::rate_limit_prefix() . hash('sha256', $ip);
        $hits     = (int) get_transient($rate_key);
        if ($hits >= 5) {
            return new WP_Error(
                'rate_limited',
                static::rate_limited_message(),
                ['status' => 429]
            );
        }
        set_transient($rate_key, $hits + 1, HOUR_IN_SECONDS);
        return null;
    }

    /** Returns a WP_Error if the plugin is not configured, null otherwise. */
    private static function check_config(): ?WP_Error
    {
        $api_base = rtrim((string) get_option(static::api_base_option(), ''), '/');
        $api_key  = (string) get_option(static::api_key_option(), '');
        if (!$api_base || !$api_key) {
            return new WP_Error(
                'misconfigured',
                static::not_configured_message(),
                ['status' => 500]
            );
        }
        return null;
    }

    /**
     * Client IP used for the per-IP rate limit and forwarded to the Velora API.
     *
     * REMOTE_ADDR is the only address this site's own web server observed, so
     * it is what we use. Proxy headers are set by whoever sent the request
     * unless a reverse proxy overwrites them, and trusting them unconditionally
     * meant a visitor could rotate X-Forwarded-For to get an unlimited number
     * of fresh rate-limit buckets — here, and again inside Velora, which
     * rate-limits on the value we forward.
     *
     * A site that really does sit behind Cloudflare or another reverse proxy
     * opts in, in its theme or a small mu-plugin:
     *
     *     add_filter('velora_club_trust_proxy_headers', '__return_true');
     *
     * (velora_breeder_trust_proxy_headers for the breeder plugin.) Only turn it
     * on when the proxy is guaranteed to overwrite these headers — otherwise it
     * hands the limiter back to the visitor.
     */
    protected static function client_ip(): string
    {
        $candidates = [];
        if (static::trust_proxy_headers()) {
            $candidates[] = static::server_string('HTTP_CF_CONNECTING_IP');
            $candidates[] = static::server_string('HTTP_X_FORWARDED_FOR');
        }
        $candidates[] = static::server_string('REMOTE_ADDR');

        foreach ($candidates as $candidate) {
            if (!$candidate) {
                continue;
            }
            $first = trim(explode(',', $candidate)[0]);
            if (filter_var($first, FILTER_VALIDATE_IP)) {
                return $first;
            }
        }
        return '0.0.0.0';
    }

    /** Sanitized $_SERVER entry, or null when absent. */
    private static function server_string(string $key): ?string
    {
        return isset($_SERVER[$key])
            ? sanitize_text_field(wp_unslash($_SERVER[$key]))
            : null;
    }
}
