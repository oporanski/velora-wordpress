<?php
/**
 * Uninstall handler — runs when the user deletes the plugin from WP admin.
 *
 * @package VeloraClubWidgets
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

$velora_club_options = [
    'velora_club_api_base',
    'velora_club_profile_base',
    'velora_club_api_key',
    'velora_club_default_slug',
    'velora_club_locale',
    'velora_club_show_credit',
    // Legacy — pre-Cap.js installs.
    'velora_club_turnstile_sitekey',
];

foreach ($velora_club_options as $velora_club_option_name) {
    delete_option($velora_club_option_name);
    delete_site_option($velora_club_option_name);
}

// Legacy — cleans up the update-check transient written by the plugin's
// former self-hosted updater (removed for WordPress.org distribution).
// Harmless no-op on installs that never had it.
delete_site_transient('velora_club_update_check');
