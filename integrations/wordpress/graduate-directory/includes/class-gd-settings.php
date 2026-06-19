<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Settings page (Settings → Graduate Directory). Stores the API base URL, the
 * school slug, and a per-site read-only API key — never exposed client-side; all
 * API calls happen server-side in GD_Api_Client.
 */
class GD_Settings {

	const OPTION = 'gd_settings';

	public static function get( $key, $default = '' ) {
		$opts = get_option( self::OPTION, array() );
		return isset( $opts[ $key ] ) ? $opts[ $key ] : $default;
	}

	public static function register_page() {
		add_options_page(
			'Graduate Directory',
			'Graduate Directory',
			'manage_options',
			'graduate-directory',
			array( __CLASS__, 'render_page' )
		);
	}

	public static function register_settings() {
		register_setting( 'gd_settings_group', self::OPTION, array(
			'sanitize_callback' => array( __CLASS__, 'sanitize' ),
		) );
	}

	public static function sanitize( $input ) {
		return array(
			'api_base'  => esc_url_raw( trim( $input['api_base'] ?? '' ) ),
			'school'    => sanitize_text_field( $input['school'] ?? '' ),
			'api_key'   => sanitize_text_field( $input['api_key'] ?? '' ),
		);
	}

	public static function render_page() {
		$api_base = self::get( 'api_base', 'http://localhost:8787' );
		$school   = self::get( 'school', 'breathwork-global' );
		$api_key  = self::get( 'api_key' );
		?>
		<div class="wrap">
			<h1>Graduate Directory</h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'gd_settings_group' ); ?>
				<table class="form-table">
					<tr>
						<th><label for="gd_api_base">API base URL</label></th>
						<td><input type="url" id="gd_api_base" name="gd_settings[api_base]" value="<?php echo esc_attr( $api_base ); ?>" class="regular-text" /></td>
					</tr>
					<tr>
						<th><label for="gd_school">School slug</label></th>
						<td><input type="text" id="gd_school" name="gd_settings[school]" value="<?php echo esc_attr( $school ); ?>" class="regular-text" /></td>
					</tr>
					<tr>
						<th><label for="gd_api_key">API key (read-only)</label></th>
						<td><input type="password" id="gd_api_key" name="gd_settings[api_key]" value="<?php echo esc_attr( $api_key ); ?>" class="regular-text" autocomplete="off" /></td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
			<p>Use the <code>[graduate_directory]</code> shortcode or the "Graduate Directory" block.</p>
		</div>
		<?php
	}
}
