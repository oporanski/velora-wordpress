<?php
/**
 * Server-side proxy for the club contact form.
 *
 * Mirror of Velora_Breeder_Rest — see that class for design rationale.
 * All proxy logic lives in Velora_Club_Base_Rest (generated from shared/class-base-rest.php).
 * This class provides only the plugin-specific identity.
 *
 * @package VeloraClubWidgets
 */

if (!defined('ABSPATH')) { exit; }

class Velora_Club_Rest extends Velora_Club_Base_Rest
{
    protected static function route_namespace(): string   { return 'velora-club/v1'; }
    protected static function entity_type(): string       { return 'clubs'; }
    protected static function rate_limit_prefix(): string { return 'velora_club_contact_rl_'; }

    /**
     * Opt-in for trusting reverse-proxy IP headers. The hook name is spelled
     * out here because PHPCS only recognises a plugin prefix on a literal.
     */
    protected static function trust_proxy_headers(): bool
    {
        return (bool) apply_filters('velora_club_trust_proxy_headers', false);
    }
    protected static function api_base_option(): string   { return Velora_Club_Plugin::OPTION_API_BASE; }
    protected static function api_key_option(): string    { return Velora_Club_Plugin::OPTION_API_KEY; }

    protected static function upstream_unreachable_message(): string
    {
        return __('Could not reach Velora API.', 'velora-club-widgets');
    }

    protected static function rate_limited_message(): string
    {
        return __('Too many submissions. Try again later.', 'velora-club-widgets');
    }

    protected static function not_configured_message(): string
    {
        return __('Plugin is not configured. Set API base and key in plugin settings.', 'velora-club-widgets');
    }
}
