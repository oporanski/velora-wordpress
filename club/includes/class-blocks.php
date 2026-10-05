<?php
/**
 * Gutenberg block registration for Velora Club Widgets.
 *
 * Each block delegates to the existing shortcode — keeps shortcode as
 * the single source of truth for output and editor previews show the
 * same HTML as the front-end.
 *
 * @package VeloraClubWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}

class Velora_Club_Blocks extends Velora_Club_Base_Blocks
{
    private const BLOCKS = [
        'velora-club/about' => [
            'shortcode'  => 'velora-club-about',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-club/breeders' => [
            'shortcode'  => 'velora-club-breeders',
            'attributes' => [
                'slug'   => ['type' => 'string', 'default' => ''],
                'limit'  => ['type' => 'number', 'default' => 200],
                'layout' => ['type' => 'string', 'default' => 'auto'],
                'theme'  => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-club/listings' => [
            'shortcode'  => 'velora-club-listings',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'limit' => ['type' => 'number', 'default' => 24],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-club/posts' => [
            'shortcode'  => 'velora-club-posts',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'limit' => ['type' => 'number', 'default' => 6],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-club/events' => [
            'shortcode'  => 'velora-club-events',
            'attributes' => [
                'slug'        => ['type' => 'string', 'default' => ''],
                'limit'       => ['type' => 'number', 'default' => 12],
                'when'        => ['type' => 'string', 'default' => 'upcoming'],
                'show_filter' => ['type' => 'string', 'default' => 'true'],
                'theme'       => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-club/documents' => [
            'shortcode'  => 'velora-club-documents',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'limit' => ['type' => 'number', 'default' => 100],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-club/gallery' => [
            'shortcode'  => 'velora-club-gallery',
            'attributes' => [
                'slug'             => ['type' => 'string', 'default' => ''],
                'photos_per_album' => ['type' => 'number', 'default' => 30],
                'theme'            => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-club/contact' => [
            'shortcode'  => 'velora-club-contact',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
    ];

    protected static function get_blocks(): array
    {
        return self::BLOCKS;
    }

    protected static function editor_script_handle(): string
    {
        return 'velora-club-blocks-editor';
    }

    protected static function editor_js_path(): string
    {
        return VELORA_CLUB_PLUGIN_DIR . 'blocks/editor.js';
    }

    protected static function editor_js_url(): string
    {
        return VELORA_CLUB_PLUGIN_URL . 'blocks/editor.js';
    }

    protected static function text_domain(): string
    {
        return 'velora-club-widgets';
    }

    protected static function languages_path(): string
    {
        return VELORA_CLUB_PLUGIN_DIR . 'languages';
    }
}
