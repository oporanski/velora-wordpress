<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Tests for breeder/uninstall.php.
 *
 * uninstall.php deletes all plugin options from wp_options on plugin removal.
 * We verify delete_option and delete_site_option are called for every
 * registered option key, and that the update transient is cleared.
 *
 * Note: WP_UNINSTALL_PLUGIN is defined once per process in PHPUnit — we skip
 * the guard check and assert on side-effects only.
 */
class BreederUninstallTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Monkey\setUp();
    }

    protected function tearDown(): void
    {
        Monkey\tearDown();
        parent::tearDown();
    }

    public function test_uninstall_deletes_all_breeder_options(): void
    {
        $deleted      = [];
        $siteDeleted  = [];
        $transients   = [];

        Functions\when('delete_option')->alias(function ($option) use (&$deleted) {
            $deleted[] = $option;
        });
        Functions\when('delete_site_option')->alias(function ($option) use (&$siteDeleted) {
            $siteDeleted[] = $option;
        });
        Functions\when('delete_site_transient')->alias(function ($key) use (&$transients) {
            $transients[] = $key;
        });

        // Define the constant so the guard passes (idempotent — may already be defined).
        if (!defined('WP_UNINSTALL_PLUGIN')) {
            define('WP_UNINSTALL_PLUGIN', true);
        }

        // Re-execute the uninstall script.
        include __DIR__ . '/../../breeder/uninstall.php';

        // All six current option keys must be deleted from wp_options.
        self::assertContains('velora_breeder_api_base',         $deleted);
        self::assertContains('velora_breeder_profile_base',     $deleted);
        self::assertContains('velora_breeder_api_key',          $deleted);
        self::assertContains('velora_breeder_default_slug',     $deleted);
        self::assertContains('velora_breeder_locale',           $deleted);
        self::assertContains('velora_breeder_show_credit',      $deleted);
        // Legacy turnstile key must also be cleaned up.
        self::assertContains('velora_breeder_turnstile_sitekey', $deleted);

        // Each option must also be deleted from the network (multisite).
        self::assertContains('velora_breeder_api_base',          $siteDeleted);
        self::assertContains('velora_breeder_api_key',           $siteDeleted);

        // Update check transient must be cleared.
        self::assertContains('velora_breeder_update_check', $transients);
    }

    public function test_uninstall_deletes_exactly_seven_options(): void
    {
        $deleted = [];
        Functions\when('delete_option')->alias(function ($option) use (&$deleted) {
            $deleted[] = $option;
        });
        Functions\when('delete_site_option')->alias(function () {});
        Functions\when('delete_site_transient')->alias(function () {});

        if (!defined('WP_UNINSTALL_PLUGIN')) {
            define('WP_UNINSTALL_PLUGIN', true);
        }

        include __DIR__ . '/../../breeder/uninstall.php';

        self::assertCount(7, $deleted, 'Expected exactly 7 option keys to be deleted');
    }
}
