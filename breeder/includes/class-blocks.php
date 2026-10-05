<?php
/**
 * Gutenberg block registration for Velora Breeder Widgets.
 *
 * Each block delegates to the existing shortcode — keeps shortcode as
 * the single source of truth for output and editor previews show the
 * same HTML as the front-end.
 *
 * @package VeloraBreederWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}

class Velora_Breeder_Blocks extends Velora_Breeder_Base_Blocks
{
    /** Map of block name → shortcode name → attributes schema. */
    private const BLOCKS = [
        'velora-breeder/about' => [
            'shortcode'  => 'velora-breeder-about',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-breeder/animals' => [
            'shortcode'  => 'velora-breeder-animals',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'limit' => ['type' => 'number', 'default' => 12],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-breeder/gallery' => [
            'shortcode'  => 'velora-breeder-gallery',
            'attributes' => [
                'slug'             => ['type' => 'string', 'default' => ''],
                'photos_per_album' => ['type' => 'number', 'default' => 30],
                'theme'            => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-breeder/listings' => [
            'shortcode'  => 'velora-breeder-listings',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'limit' => ['type' => 'number', 'default' => 12],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-breeder/posts' => [
            'shortcode'  => 'velora-breeder-posts',
            'attributes' => [
                'slug'  => ['type' => 'string', 'default' => ''],
                'limit' => ['type' => 'number', 'default' => 6],
                'theme' => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-breeder/events' => [
            'shortcode'  => 'velora-breeder-events',
            'attributes' => [
                'slug'        => ['type' => 'string', 'default' => ''],
                'limit'       => ['type' => 'number', 'default' => 12],
                'when'        => ['type' => 'string', 'default' => 'upcoming'],
                'show_filter' => ['type' => 'string', 'default' => 'true'],
                'theme'       => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
        'velora-breeder/contact' => [
            'shortcode'  => 'velora-breeder-contact',
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
        return 'velora-breeder-blocks-editor';
    }

    protected static function editor_js_path(): string
    {
        return VELORA_BREEDER_PLUGIN_DIR . 'blocks/editor.js';
    }

    protected static function editor_js_url(): string
    {
        return VELORA_BREEDER_PLUGIN_URL . 'blocks/editor.js';
    }

    protected static function text_domain(): string
    {
        return 'velora-breeder-widgets';
    }

    protected static function languages_path(): string
    {
        return VELORA_BREEDER_PLUGIN_DIR . 'languages';
    }
}
