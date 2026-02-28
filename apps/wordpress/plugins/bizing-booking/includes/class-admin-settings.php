<?php
/**
 * Admin Settings Page
 */

class Bizing_Admin_Settings {
    
    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }
    
    public function add_admin_menu() {
        add_menu_page(
            'Bizing Booking',
            'Bizing Booking',
            'manage_options',
            'bizing-booking',
            [$this, 'render_settings_page'],
            'dashicons-calendar-alt',
            30
        );
    }
    
    public function register_settings() {
        register_setting('bizing_booking_settings', 'bizing_api_url');
        register_setting('bizing_booking_settings', 'bizing_api_key');
        register_setting('bizing_booking_settings', 'bizing_biz_id');
        
        add_settings_section(
            'bizing_api_settings',
            'API Configuration',
            [$this, 'render_api_section'],
            'bizing-booking'
        );
        
        add_settings_field(
            'bizing_api_url',
            'API Base URL',
            [$this, 'render_api_url_field'],
            'bizing-booking',
            'bizing_api_settings'
        );
        
        add_settings_field(
            'bizing_api_key',
            'API Key',
            [$this, 'render_api_key_field'],
            'bizing-booking',
            'bizing_api_settings'
        );
        
        add_settings_field(
            'bizing_biz_id',
            'Business ID',
            [$this, 'render_biz_id_field'],
            'bizing-booking',
            'bizing_api_settings'
        );
    }
    
    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <?php settings_errors('bizing_booking_settings'); ?>
            
            <form method="post" action="options.php">
                <?php
                settings_fields('bizing_booking_settings');
                do_settings_sections('bizing-booking');
                submit_button('Save Settings');
                ?>
            </form>
            
            <div class="bizing-test-connection">
                <h2>Test Connection</h2>
                <button type="button" class="button bizing-test-btn">
                    Test API Connection
                </button>
                <div class="bizing-test-result"></div>
            </div>
            
            <div class="bizing-usage-info">
                <h2>Usage</h2>
                <p>Use the shortcode <code>[bizing_booking]</code> to display the booking form on any page or post.</p>
                <p>Optional parameters:</p>
                <ul>
                    <li><code>[bizing_booking offer_id="xxx"]</code> - Show booking form for specific offer</li>
                    <li><code>[bizing_booking show_offers="false"]</code> - Hide offers list</li>
                </ul>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            $('.bizing-test-btn').on('click', function() {
                var $result = $('.bizing-test-result');
                $result.html('Testing...');
                
                $.ajax({
                    url: ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'bizing_test_connection',
                        nonce: '<?php echo wp_create_nonce('bizing_test_connection'); ?>'
                    },
                    success: function(response) {
                        if (response.success) {
                            $result.html('<div class="notice notice-success"><p>Connection successful! API is reachable.</p></div>');
                        } else {
                            $result.html('<div class="notice notice-error"><p>' + response.data.message + '</p></div>');
                        }
                    },
                    error: function() {
                        $result.html('<div class="notice notice-error"><p>Connection failed. Please check your settings.</p></div>');
                    }
                });
            });
        });
        </script>
        
        <?php
    }
    
    public function render_api_section() {
        echo '<p>Configure your Bizing API connection settings below.</p>';
    }
    
    public function render_api_url_field() {
        $value = get_option('bizing_api_url', 'http://host.docker.internal:6129/api/v1');
        ?>
        <input type="url" name="bizing_api_url" value="<?php echo esc_attr($value); ?>" class="regular-text">
        <p class="description">The base URL for the Bizing API. For Docker, use: http://host.docker.internal:6129/api/v1</p>
        <?php
    }
    
    public function render_api_key_field() {
        $value = get_option('bizing_api_key', '');
        ?>
        <input type="password" name="bizing_api_key" value="<?php echo esc_attr($value); ?>" class="regular-text">
        <p class="description">Your Bizing API authentication key.</p>
        <?php
    }
    
    public function render_biz_id_field() {
        $value = get_option('bizing_biz_id', '');
        ?>
        <input type="text" name="bizing_biz_id" value="<?php echo esc_attr($value); ?>" class="regular-text">
        <p class="description">The Business ID to use for bookings.</p>
        <?php
    }
}