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
        // Static panel — no slug and no limit, because it fetches nothing.
        'velora-club/member-area' => [
            'shortcode'  => 'velora-club-member-area',
            'attributes' => [
                'heading' => ['type' => 'string', 'default' => ''],
                'text'    => ['type' => 'string', 'default' => ''],
                'theme'   => ['type' => 'string', 'default' => 'auto'],
            ],
        ],
    ];

    protected static function get_blocks(): array
    {
        return self::BLOCKS;
    }

    /**
     * Neutralises square brackets in block attribute values.
     *
     * A dynamic block does not render itself: the base class builds the TEXT of
     * a shortcode from the attributes and hands it to do_shortcode(). WordPress
     * ends a shortcode tag at the first "]", and esc_attr() does not touch
     * brackets — so "Members [area] only" typed into this block's Heading field
     * truncates the tag, drops every attribute after it, and leaves the tail
     * ('" text="..."]') as visible text on the club's public page. Measured on
     * WordPress 7.0.2.
     *
     * This block is the first one in either plugin whose attributes are free
     * prose; the other fifteen carry a slug, a number or a value from a fixed
     * set, where a bracket cannot occur.
     *
     * The reader still sees the brackets they typed, because neither escaping
     * step re-encodes the ampersand: esc_attr() and esc_html() both call
     * _wp_specialchars($text, ENT_QUOTES), leaving $double_encode at its
     * default false (read in WordPress 7.0.2, wp-includes/formatting.php:945,
     * 4682 and 4707). The entity therefore survives the attribute as an entity —
     * esc_attr() renumbers it to "&#091;", because wp_kses_normalize_entities()
     * zero-pads numeric references — and the browser renders that as "[".
     *
     * Deliberately NOT fixed in shared/class-base-blocks.php: `make build-base`
     * would regenerate the breeder plugin's copy too, and that plugin is out of
     * scope here. The same trap therefore still waits for the next prose
     * attribute added to the breeder plugin.
     */
    protected static function render_via_shortcode(string $shortcode, array $attrs): string
    {
        foreach ($attrs as $key => $value) {
            if (is_string($value)) {
                $attrs[$key] = strtr($value, ['[' => '&#91;', ']' => '&#93;']);
            }
        }

        return parent::render_via_shortcode($shortcode, $attrs);
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
