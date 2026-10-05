<?php
/**
 * Plugin Name:       Velora Breeder Widgets
 * Plugin URI:        https://velora.pet/
 * Description:       Embed your Velora cattery/kennel content (animals, gallery, listings, posts, events, contact form) on your WordPress site.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Velora
 * Author URI:        https://velora.pet/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       velora-breeder-widgets
 * Domain Path:       /languages
 *
 * Velora Breeder Widgets — Copyright (C) 2026 Velora
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
 * @package VeloraBreederWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}

define('VELORA_BREEDER_PLUGIN_VERSION', '1.0.0');
define('VELORA_BREEDER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('VELORA_BREEDER_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once VELORA_BREEDER_PLUGIN_DIR . 'includes/class-base-plugin.php';
require_once VELORA_BREEDER_PLUGIN_DIR . 'includes/class-base-rest.php';
require_once VELORA_BREEDER_PLUGIN_DIR . 'includes/class-base-blocks.php';
require_once VELORA_BREEDER_PLUGIN_DIR . 'includes/class-plugin.php';
require_once VELORA_BREEDER_PLUGIN_DIR . 'includes/class-blocks.php';
require_once VELORA_BREEDER_PLUGIN_DIR . 'includes/class-rest.php';

Velora_Breeder_Plugin::init();
Velora_Breeder_Blocks::init();
Velora_Breeder_Rest::init();
