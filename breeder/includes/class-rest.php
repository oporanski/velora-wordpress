<?php
/**
 * Server-side proxy for the breeder contact form.
 *
 * Without this, the embed widget would have to send the Velora API key
 * directly from the browser (visible to anyone with DevTools — see
 * docs/tech/critical-rules.md "Upload Access Control" rationale).
 * With this proxy:
 *   - Browser POSTs to /wp-json/velora-breeder/v1/contact (same-origin).
 *   - PHP handler reads the API key from wp_options (server-side, never
 *     leaves the host), forwards the POST to Velora API with the Bearer
 *     header, and relays the response.
 *   - The Cap.js captcha token is forwarded verbatim — Velora backend
 *     still validates it; we add no client-side trust.
 *
 * All proxy logic lives in Velora_Breeder_Base_Rest (generated from shared/class-base-rest.php).
 * This class provides only the plugin-specific identity.
 *
 * @package VeloraBreederWidgets
 */

if (!defined('ABSPATH')) { exit; }

class Velora_Breeder_Rest extends Velora_Breeder_Base_Rest
{
    protected static function route_namespace(): string   { return 'velora-breeder/v1'; }
    protected static function entity_type(): string       { return 'breeders'; }
    protected static function rate_limit_prefix(): string { return 'velora_breeder_contact_rl_'; }

    /**
     * Opt-in for trusting reverse-proxy IP headers. The hook name is spelled
     * out here because PHPCS only recognises a plugin prefix on a literal.
     */
    protected static function trust_proxy_headers(): bool
    {
        return (bool) apply_filters('velora_breeder_trust_proxy_headers', false);
    }
    protected static function api_base_option(): string   { return Velora_Breeder_Plugin::OPTION_API_BASE; }
    protected static function api_key_option(): string    { return Velora_Breeder_Plugin::OPTION_API_KEY; }

    protected static function upstream_unreachable_message(): string
    {
        return __('Could not reach Velora API.', 'velora-breeder-widgets');
    }

    protected static function rate_limited_message(): string
    {
        return __('Too many submissions. Try again later.', 'velora-breeder-widgets');
    }

    protected static function not_configured_message(): string
    {
        return __('Plugin is not configured. Set API base and key in plugin settings.', 'velora-breeder-widgets');
    }
}
