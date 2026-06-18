<?php
/**
 * Plugin Name:       The Directory — Graduate Directory
 * Description:        Surfaces your school's certified graduates from The Directory (headless SaaS) inside WordPress, server-side rendered for SEO with schema.org JSON-LD. Reference SSR adapter.
 * Version:           0.1.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * License:           MIT
 *
 * This is the WordPress adapter over The Directory's one integration contract
 * (REST + JSON-LD). It renders server-side (crawlable, agent-readable) and shares
 * the same card markup as the universal Web Component and the (future) Drupal /
 * Webflow adapters. The core platform never special-cases WordPress.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GD_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'GD_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once GD_PLUGIN_DIR . 'includes/class-gd-settings.php';
require_once GD_PLUGIN_DIR . 'includes/class-gd-api-client.php';
require_once GD_PLUGIN_DIR . 'includes/class-gd-render.php';

add_action( 'admin_menu', array( 'GD_Settings', 'register_page' ) );
add_action( 'admin_init', array( 'GD_Settings', 'register_settings' ) );

/** [graduate_directory modality="holotropic" online="1"] — works on classic + block themes. */
add_shortcode( 'graduate_directory', array( 'GD_Render', 'shortcode' ) );

/** Dynamic Gutenberg block (PHP render_callback => SSR => SEO). */
add_action( 'init', function () {
	register_block_type( GD_PLUGIN_DIR . 'blocks/directory' );
} );
