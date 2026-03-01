<?php
/**
 * Booking Shortcode
 * Displays the booking form
 */

class Bizing_Booking_Shortcode {
    
    private $api;
    
    public function __construct($api) {
        $this->api = $api;
        add_shortcode('bizing_booking', [$this, 'render_booking_form']);
    }
    
    public function render_booking_form($atts) {
        $atts = shortcode_atts([
            'offer_id' => '',
            'show_offers' => 'true'
        ], $atts, 'bizing_booking');
        
        ob_start();
        ?>
        <div class="bizing-booking-container" id="bizing-booking-<?php echo uniqid(); ?>">
            <div class="bizing-booking-header">
                <h2><?php _e('Book Your Appointment', 'bizing-booking'); ?></h2>
            </div>
            
            <?php if ($atts['show_offers'] === 'true' && empty($atts['offer_id'])): ?>
                <div class="bizing-offers-list">
                    <?php $this->render_offers_list(); ?>
                </div>
            <?php else: ?>
                <div class="bizing-booking-form-wrapper">
                    <?php $this->render_booking_form_fields($atts['offer_id']); ?>
                </div>
            <?php endif; ?>
            
            <div class="bizing-booking-messages" style="display: none;"></div>
        </div>
        
        <?php
        return ob_get_clean();
    }
    
    private function render_offers_list() {
        $offers = $this->api->get_offers();
        
        if (is_wp_error($offers) || empty($offers['data'])):
            ?>
            <div class="bizing-error">
                <p><?php _e('Unable to load offers. Please try again later.', 'bizing-booking'); ?></p>
            </div>
            <?php
            return;
        endif;
        ?>
        
        <div class="bizing-offers-grid">
            <?php foreach ($offers['data'] as $offer): ?>
                <div class="bizing-offer-card" data-offer-id="<?php echo esc_attr($offer['id']); ?>">
                    <h3><?php echo esc_html($offer['name']); ?></h3>
                    <?php if (!empty($offer['description'])): ?>
                        <p><?php echo esc_html($offer['description']); ?></p>
                    <?php endif; ?>
                    <button class="bizing-select-offer-btn button">
                        <?php _e('Book Now', 'bizing-booking'); ?>
                    </button>
                </div>
            <?php endforeach; ?>
        </div>
        
        <?php
    }
    
    private function render_booking_form_fields($offer_id) {
        ?>
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
        
        <!-- Success Modal -->
        <div class="bizing-success-modal" style="display: none;">
            <div class="bizing-modal-content">
                <h3><?php _e('Booking Confirmed!', 'bizing-booking'); ?></h3>
                <p><?php _e('Your appointment has been booked successfully.', 'bizing-booking'); ?></p>
                <div class="bizing-booking-details"></div>
                <button class="button bizing-close-modal"><?php _e('Close', 'bizing-booking'); ?></button>
            </div>
        </div>
        <?php
    }
}