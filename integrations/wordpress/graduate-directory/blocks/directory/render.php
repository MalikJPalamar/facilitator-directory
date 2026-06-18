<?php
/**
 * Dynamic block render_callback. SSR — the directory HTML + JSON-LD is in the
 * initial server response (good SEO, agent-readable), reusing the exact same
 * renderer as the shortcode.
 *
 * @var array $attributes Block attributes.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

$atts = array(
	'modality' => $attributes['modality'] ?? '',
	'online'   => ! empty( $attributes['online'] ) ? '1' : '',
	'q'        => $attributes['q'] ?? '',
);

$wrapper = function_exists( 'get_block_wrapper_attributes' ) ? get_block_wrapper_attributes() : '';
echo '<div ' . $wrapper . '>' . GD_Render::directory( $atts ) . '</div>';
