<?php
/**
 * Uninstall handler — runs when the user deletes the plugin from WP admin.
 *
 * WordPress invokes this file via WP_UNINSTALL_PLUGIN constant. We use it to
 * remove every option the plugin wrote to wp_options, so a fresh re-install
 * starts from a clean state and we don't leave orphan rows in the database.
 *
 * @package VeloraBreederWidgets
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Mirror of OPTION_* constants from class-plugin.php — listed inline because
// uninstall.php runs without bootstrapping the plugin.
$velora_breeder_options = [
    'velora_breeder_api_base',
    'velora_breeder_profile_base',
    'velora_breeder_api_key',
    'velora_breeder_default_slug',
    'velora_breeder_locale',
    'velora_breeder_show_credit',
    // Legacy — kept for cleanup of installs that had Turnstile (pre-Cap.js).
    'velora_breeder_turnstile_sitekey',
];

foreach ($velora_breeder_options as $velora_breeder_option_name) {
    delete_option($velora_breeder_option_name);
    // Multisite — also clean up network-wide option in case anyone set it.
    delete_site_option($velora_breeder_option_name);
}

// Legacy — cleans up the update-check transient written by the plugin's
// former self-hosted updater (removed for WordPress.org distribution).
// Harmless no-op on installs that never had it.
delete_site_transient('velora_breeder_update_check');
