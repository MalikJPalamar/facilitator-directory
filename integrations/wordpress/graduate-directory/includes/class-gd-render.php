<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Shared renderer for BOTH the shortcode and the dynamic block — one SEO-friendly,
 * JSON-LD-emitting output path (the adapter-pattern payoff). Same card structure
 * as the universal Web Component.
 */
class GD_Render {

	/** Shortcode entry point: [graduate_directory modality="..." online="1" q="..."]. */
	public static function shortcode( $atts ) {
		$atts = shortcode_atts(
			array( 'modality' => '', 'online' => '', 'q' => '' ),
			$atts,
			'graduate_directory'
		);
		return self::directory( $atts );
	}

	/** Builds the directory HTML + JSON-LD. Used by the block render.php too. */
	public static function directory( array $atts ) {
		$query = array();
		if ( ! empty( $atts['modality'] ) ) { $query['modality'] = $atts['modality']; }
		if ( ! empty( $atts['online'] ) )   { $query['online'] = '1'; }
		if ( ! empty( $atts['q'] ) )        { $query['q'] = $atts['q']; }

		$data    = GD_Api_Client::search( $query );
		$results = isset( $data['results'] ) ? $data['results'] : array();

		if ( empty( $results ) ) {
			return '<p class="gd-empty">No practitioners found.</p>';
		}

		$cards = '';
		$ld_items = array();
		$i = 0;
		foreach ( $results as $p ) {
			$cards .= self::card( $p );
			$ld_items[] = array(
				'@type'    => 'ListItem',
				'position' => ++$i,
				'item'     => array(
					'@type'      => 'Person',
					'name'       => $p['displayName'] ?? '',
					'description' => $p['headline'] ?? '',
					'knowsAbout' => $p['modalities'] ?? array(),
				),
			);
		}

		$jsonld = array(
			'@context'        => 'https://schema.org',
			'@type'           => 'ItemList',
			'itemListElement' => $ld_items,
		);

		$html  = '<div class="gd-grid">' . $cards . '</div>';
		// Server-rendered JSON-LD => crawlable + agent-readable in the school's own domain.
		$html .= '<script type="application/ld+json">' . wp_json_encode( $jsonld ) . '</script>';
		return $html;
	}

	private static function card( array $p ) {
		$where = trim( implode( ', ', array_filter( array( $p['city'] ?? '', $p['country'] ?? '' ) ) ) );
		$badges = '';
		if ( ! empty( $p['verified'] ) )     { $badges .= '<span class="gd-badge gd-verified">✓ Verified</span>'; }
		if ( ! empty( $p['offersOnline'] ) ) { $badges .= '<span class="gd-badge">Online</span>'; }
		$modalities = isset( $p['modalities'] ) ? implode( ' · ', array_map( 'esc_html', $p['modalities'] ) ) : '';

		return sprintf(
			'<article class="gd-card"><h3>%s</h3><p class="gd-headline">%s</p><p class="gd-meta">%s %s</p><p class="gd-modalities">%s</p></article>',
			esc_html( $p['displayName'] ?? '' ),
			esc_html( $p['headline'] ?? '' ),
			esc_html( $where ),
			$badges,
			$modalities
		);
	}
}
