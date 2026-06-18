<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Server-side REST client for The Directory. Calls happen in PHP (token never
 * reaches the browser) and responses are cached in a transient (~5 min) to
 * protect the API. This is the crux of the SSR adapter: crawlable, agent-readable
 * markup in the school's own DOM.
 */
class GD_Api_Client {

	public static function search( array $query = array() ) {
		$api_base = rtrim( GD_Settings::get( 'api_base' ), '/' );
		$school   = GD_Settings::get( 'school' );
		$api_key  = GD_Settings::get( 'api_key' );
		if ( empty( $api_base ) || empty( $school ) ) {
			return array( 'results' => array() );
		}

		$url       = $api_base . '/v1/schools/' . rawurlencode( $school ) . '/search';
		$url       = add_query_arg( array_map( 'rawurlencode', $query ), $url );
		$cache_key = 'gd_search_' . md5( $url );

		$cached = get_transient( $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}

		$args = array( 'timeout' => 8, 'headers' => array( 'Accept' => 'application/json' ) );
		if ( ! empty( $api_key ) ) {
			$args['headers']['Authorization'] = 'Bearer ' . $api_key;
		}

		$response = wp_remote_get( $url, $args );
		if ( is_wp_error( $response ) ) {
			return array( 'results' => array() );
		}
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) ) {
			$data = array( 'results' => array() );
		}

		set_transient( $cache_key, $data, 5 * MINUTE_IN_SECONDS );
		return $data;
	}
}
