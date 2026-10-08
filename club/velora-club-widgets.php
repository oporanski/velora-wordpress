<?php
/**
 * Plugin Name:       Velora Club Widgets
 * Plugin URI:        https://velora.pet/
 * Description:       Embed your Velora breeder club content (member breeders, gallery, listings, posts, events, documents, contact form) on your WordPress site.
 * Version:           1.2.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Velora
 * Author URI:        https://velora.pet/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       velora-club-widgets
 * Domain Path:       /languages
 *
 * Velora Club Widgets — Copyright (C) 2026 Velora
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program; if not, see https://www.gnu.org/licenses/gpl-2.0.html. The
 * full text also ships with this plugin in the LICENSE file, which is the
 * verbatim license document and must not be edited.
 *
 * @package VeloraClubWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}

define('VELORA_CLUB_PLUGIN_VERSION', '1.2.0');
define('VELORA_CLUB_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('VELORA_CLUB_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once VELORA_CLUB_PLUGIN_DIR . 'includes/class-base-plugin.php';
require_once VELORA_CLUB_PLUGIN_DIR . 'includes/class-base-rest.php';
require_once VELORA_CLUB_PLUGIN_DIR . 'includes/class-base-blocks.php';
require_once VELORA_CLUB_PLUGIN_DIR . 'includes/class-plugin.php';
require_once VELORA_CLUB_PLUGIN_DIR . 'includes/class-blocks.php';
require_once VELORA_CLUB_PLUGIN_DIR . 'includes/class-rest.php';

Velora_Club_Plugin::init();
Velora_Club_Blocks::init();
Velora_Club_Rest::init();
