<?php

declare(strict_types=1);

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;

/**
 * Tests for club/uninstall.php.
 *
 * Mirrors BreederUninstallTest for the club plugin.
 */
class ClubUninstallTest extends TestCase
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

    public function test_uninstall_deletes_all_club_options(): void
    {
        $deleted     = [];
        $siteDeleted = [];
        $transients  = [];

        Functions\when('delete_option')->alias(function ($option) use (&$deleted) {
            $deleted[] = $option;
        });
        Functions\when('delete_site_option')->alias(function ($option) use (&$siteDeleted) {
            $siteDeleted[] = $option;
        });
        Functions\when('delete_site_transient')->alias(function ($key) use (&$transients) {
            $transients[] = $key;
        });

        if (!defined('WP_UNINSTALL_PLUGIN')) {
            define('WP_UNINSTALL_PLUGIN', true);
        }

        include __DIR__ . '/../../club/uninstall.php';

        self::assertContains('velora_club_api_base',     $deleted);
        self::assertContains('velora_club_profile_base', $deleted);
        self::assertContains('velora_club_api_key',      $deleted);
        self::assertContains('velora_club_default_slug', $deleted);
        self::assertContains('velora_club_locale',       $deleted);
        self::assertContains('velora_club_show_credit',  $deleted);
        // Legacy turnstile key.
        self::assertContains('velora_club_turnstile_sitekey', $deleted);

        self::assertContains('velora_club_api_base', $siteDeleted);
        self::assertContains('velora_club_api_key',  $siteDeleted);

        self::assertContains('velora_club_update_check', $transients);
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

        include __DIR__ . '/../../club/uninstall.php';

        self::assertCount(7, $deleted, 'Expected exactly 7 option keys to be deleted');
    }
}
