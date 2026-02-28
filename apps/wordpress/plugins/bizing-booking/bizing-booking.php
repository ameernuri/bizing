<?php
/**
 * Plugin Name: Bizing Booking
 * Plugin URI: https://bizing.com
 * Description: WordPress booking integration with Bizing API
 * Version: 1.0.1
 * Author: Bizing
 * License: MIT
 * Text Domain: bizing-booking
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BIZING_BOOKING_VERSION', '1.0.0');
define('BIZING_BOOKING_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BIZING_BOOKING_PLUGIN_URL', plugin_dir_url(__FILE__));

// Activation hook - MUST be at top level
function bizing_booking_activate() {
    // Create log directory
    $log_dir = BIZING_BOOKING_PLUGIN_DIR . 'logs';
    if (!file_exists($log_dir)) {
        wp_mkdir_p($log_dir);
    }

    // Log activation
    $log_file = BIZING_BOOKING_PLUGIN_DIR . 'logs/bizing-booking.log';
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[$timestamp] Plugin activated\n";
    error_log($entry, 3, $log_file);
}
register_activation_hook(__FILE__, 'bizing_booking_activate');

// Deactivation hook - MUST be at top level
function bizing_booking_deactivate() {
    $log_file = BIZING_BOOKING_PLUGIN_DIR . 'logs/bizing-booking.log';
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[$timestamp] Plugin deactivated\n";
    error_log($entry, 3, $log_file);
}
register_deactivation_hook(__FILE__, 'bizing_booking_deactivate');

// Autoloader
require_once BIZING_BOOKING_PLUGIN_DIR . 'includes/class-bizing-api.php';
require_once BIZING_BOOKING_PLUGIN_DIR . 'includes/class-booking-shortcode.php';
require_once BIZING_BOOKING_PLUGIN_DIR . 'includes/class-admin-settings.php';

class Bizing_Booking_Plugin {

    private static $instance = null;
    private $api;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->init();
    }

    private function init() {
        // Initialize API client
        $this->api = new Bizing_API_Client();

        // Admin settings
        new Bizing_Admin_Settings();

        // Shortcodes
        new Bizing_Booking_Shortcode($this->api);

        // REST API endpoints
        add_action('rest_api_init', [$this, 'register_rest_routes']);

        // Bypass cookie nonce check for our endpoints
        add_filter('rest_cookie_check_errors', [$this, 'bypass_cookie_check'], 10, 2);

        // AJAX handlers
        add_action('wp_ajax_bizing_test_connection', [$this, 'ajax_test_connection']);

        // Enqueue scripts
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_scripts']);
    }

    /**
     * Bypass cookie nonce check for Bizing endpoints
     */
    public function bypass_cookie_check($result, $request) {
        $route = $request->get_route();
        if (strpos($route, '/bizing/v1/') === 0) {
            return true;
        }
        return $result;
    }

    public function enqueue_scripts() {
        wp_enqueue_style(
            'bizing-booking-css',
            BIZING_BOOKING_PLUGIN_URL . 'assets/css/booking.css',
            [],
            BIZING_BOOKING_VERSION
        );

        wp_enqueue_script(
            'bizing-booking-js',
            BIZING_BOOKING_PLUGIN_URL . 'assets/js/booking.js',
            ['jquery'],
            BIZING_BOOKING_VERSION . '.' . time(),
            true
        );

        wp_localize_script('bizing-booking-js', 'bizingBooking', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'restUrl' => rest_url('bizing/v1/'),
            'nonce' => wp_create_nonce('wp_rest')
        ]);
    }

    public function enqueue_admin_scripts($hook) {
        if ('toplevel_page_bizing-booking' !== $hook) {
            return;
        }

        wp_enqueue_style(
            'bizing-admin-css',
            BIZING_BOOKING_PLUGIN_URL . 'assets/css/admin.css',
            [],
            BIZING_BOOKING_VERSION
        );
    }

    public function register_rest_routes() {
        register_rest_route('bizing/v1', '/availability/', [
            'methods' => 'GET',
            'callback' => [$this, 'get_availability'],
            'permission_callback' => [$this, 'check_permission']
        ]);

        register_rest_route('bizing/v1', '/booking-form/', [
            'methods' => 'GET',
            'callback' => [$this, 'get_booking_form'],
            'permission_callback' => [$this, 'check_permission']
        ]);

        register_rest_route('bizing/v1', '/book/', [
            'methods' => 'POST',
            'callback' => [$this, 'create_booking'],
            'permission_callback' => [$this, 'check_permission']
        ]);
    }

    /**
     * Check REST API permissions
     */
    public function check_permission($request) {
        // Allow public access to these endpoints
        return true;
    }

    public function get_availability($request) {
        $offer_id = $request->get_param('offer_id');
        $date = $request->get_param('date');

        if (!$offer_id || !$date) {
            return new WP_Error('missing_params', 'Missing required parameters', ['status' => 400]);
        }

        $slots = $this->api->get_availability($offer_id, $date);

        if (is_wp_error($slots)) {
            return $slots;
        }

        return rest_ensure_response($slots);
    }

    public function get_booking_form($request) {
        $offer_id = $request->get_param('offer_id');

        if (!$offer_id) {
            return new WP_Error('missing_params', 'Missing offer_id parameter', ['status' => 400]);
        }

        // Get offer details from API
        $offers = $this->api->get_offers();
        $offer = null;

        if (!is_wp_error($offers) && isset($offers['data'])) {
            foreach ($offers['data'] as $o) {
                if ($o['id'] === $offer_id) {
                    $offer = $o;
                    break;
                }
            }
        }

        if (!$offer) {
            $offer = ['id' => $offer_id, 'name' => 'Selected Service'];
        }

        // Generate form HTML
        ob_start();
        ?>
        <div class="bizing-booking-form-wrapper">
            <h3><?php echo esc_html($offer['name']); ?></h3>

            <form class="bizing-booking-form" method="post">
                <input type="hidden" name="offer_id" value="<?php echo esc_attr($offer_id); ?>">

                <div class="bizing-form-field">
                    <label for="bizing_date"><?php _e('Select Date', 'bizing-booking'); ?></label>
                    <input type="date" id="bizing_date" name="date" required
                           min="<?php echo date('Y-m-d'); ?>"
                           class="bizing-date-picker">
                </div>

                <div class="bizing-form-field">
                    <label><?php _e('Available Times', 'bizing-booking'); ?></label>
                    <div class="bizing-slots-container">
                        <p class="bizing-select-date-prompt">
                            <?php _e('Please select a date to see available times.', 'bizing-booking'); ?>
                        </p>
                    </div>
                </div>

                <div class="bizing-form-field">
                    <label for="bizing_name"><?php _e('Your Name', 'bizing-booking'); ?></label>
                    <input type="text" id="bizing_name" name="customer_name" required
                           placeholder="<?php _e('John Doe', 'bizing-booking'); ?>">
                </div>

                <div class="bizing-form-field">
                    <label for="bizing_email"><?php _e('Email', 'bizing-booking'); ?></label>
                    <input type="email" id="bizing_email" name="customer_email" required
                           placeholder="<?php _e('john@example.com', 'bizing-booking'); ?>">
                </div>

                <div class="bizing-form-field">
                    <label for="bizing_phone"><?php _e('Phone (optional)', 'bizing-booking'); ?></label>
                    <input type="tel" id="bizing_phone" name="customer_phone"
                           placeholder="<?php _e('+1 555 123 4567', 'bizing-booking'); ?>">
                </div>

                <div class="bizing-form-field">
                    <label for="bizing_notes"><?php _e('Notes (optional)', 'bizing-booking'); ?></label>
                    <textarea id="bizing_notes" name="notes" rows="3"
                              placeholder="<?php _e('Any special requests...', 'bizing-booking'); ?>"></textarea>
                </div>

                <div class="bizing-form-actions">
                    <button type="submit" class="button button-primary bizing-submit-btn">
                        <?php _e('Confirm Booking', 'bizing-booking'); ?>
                    </button>
                    <div class="bizing-loading" style="display: none;">
                        <span><?php _e('Processing...', 'bizing-booking'); ?></span>
                    </div>
                </div>
            </form>

            <div class="bizing-booking-messages" style="display: none;"></div>

            <!-- Success Modal -->
            <div class="bizing-success-modal" style="display: none;">
                <div class="bizing-modal-content">
                    <h3><?php _e('Booking Confirmed!', 'bizing-booking'); ?></h3>
                    <p><?php _e('Your appointment has been booked successfully.', 'bizing-booking'); ?></p>
                    <div class="bizing-booking-details"></div>
                    <button class="button bizing-close-modal"><?php _e('Close', 'bizing-booking'); ?></button>
                </div>
            </div>
        </div>
        <?php
        $html = ob_get_clean();

        return new WP_REST_Response($html, 200);
    }

    public function create_booking($request) {
        $params = $request->get_json_params();

        $required = ['offer_id', 'customer_email', 'customer_name', 'slot_time'];
        foreach ($required as $field) {
            if (empty($params[$field])) {
                return new WP_Error('missing_field', "Missing required field: $field", ['status' => 400]);
            }
        }

        $result = $this->api->create_booking($params);

        if (is_wp_error($result)) {
            return $result;
        }

        return rest_ensure_response($result);
    }

    /**
     * AJAX handler for testing API connection
     */
    public function ajax_test_connection() {
        check_ajax_referer('bizing_test_connection', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permission denied']);
        }

        // Test the connection by fetching offers
        $offers = $this->api->get_offers();

        if (is_wp_error($offers)) {
            wp_send_json_error(['message' => $offers->get_error_message()]);
        }

        wp_send_json_success(['message' => 'Connection successful!', 'offers' => count($offers['data'] ?? [])]);
    }
}

// Initialize
Bizing_Booking_Plugin::get_instance();
