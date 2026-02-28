<?php
/**
 * Bizing API Client
 * Handles all communication with Bizing API
 */

class Bizing_API_Client {
    
    private $api_base_url;
    private $api_key;
    private $biz_id;
    private $timeout = 30;
    
    public function __construct() {
        $this->api_base_url = get_option('bizing_api_url', 'http://host.docker.internal:6129/api/v1');
        $this->api_key = get_option('bizing_api_key', '');
        $this->biz_id = get_option('bizing_biz_id', '');
    }
    
    /**
     * Make API request
     */
    private function request($endpoint, $method = 'GET', $body = null) {
        $url = trailingslashit($this->api_base_url) . ltrim($endpoint, '/');
        
        $headers = [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ];
        
        if ($this->api_key) {
            $headers['X-API-Key'] = $this->api_key;
        }
        
        $args = [
            'method' => $method,
            'headers' => $headers,
            'timeout' => $this->timeout,
            'sslverify' => false // For local development
        ];
        
        if ($body && in_array($method, ['POST', 'PUT', 'PATCH'])) {
            $args['body'] = json_encode($body);
        }
        
        $this->log("API Request: $method $url");
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            $this->log("API Error: " . $response->get_error_message());
            return $response;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        $this->log("API Response: HTTP $status_code");
        
        if ($status_code >= 200 && $status_code < 300) {
            return json_decode($body, true);
        }
        
        return new WP_Error(
            'api_error',
            "API returned HTTP $status_code: $body",
            ['status' => $status_code]
        );
    }
    
    /**
     * Get offers for a business
     */
    public function get_offers() {
        if (!$this->biz_id) {
            return new WP_Error('no_biz_id', 'Business ID not configured');
        }
        
        return $this->request("/bizes/{$this->biz_id}/offers");
    }
    
    /**
     * Get availability for an offer
     */
    public function get_availability($offer_id, $date) {
        if (!$this->biz_id) {
            return new WP_Error('no_biz_id', 'Business ID not configured');
        }
        
        $params = [
            'from' => $date . 'T00:00:00Z',
            'limit' => '20'
        ];
        
        $query_string = http_build_query($params);
        $response = $this->request("/public/bizes/{$this->biz_id}/offers/$offer_id/availability?$query_string");
        
        // Return full response including offerVersionId
        if (!is_wp_error($response) && isset($response['data']['slots'])) {
            return [
                'slots' => $response['data']['slots'],
                'offerVersionId' => $response['data']['offerVersionId'] ?? null
            ];
        }
        
        return $response;
    }
    
    /**
     * Create a booking
     */
    public function create_booking($data) {
        if (!$this->biz_id) {
            return new WP_Error('no_biz_id', 'Business ID not configured');
        }

        // Get the offer version ID from availability response
        $offer_version_id = $data['offer_version_id'] ?? 'offer_version_3AAXEeTIeDyaJHMb1jBeUaTljVB';

        $booking_data = [
            'offerId' => $data['offer_id'],
            'offerVersionId' => $offer_version_id,
            'requestedStartAt' => $data['slot_time'],
            'customerEmail' => $data['customer_email'],
            'customerName' => $data['customer_name'],
            'customerPhone' => $data['customer_phone'] ?? null
        ];

        return $this->request("/bizes/{$this->biz_id}/booking-orders", 'POST', $booking_data);
    }
    
    /**
     * Get booking details
     */
    public function get_booking($booking_id) {
        return $this->request("/booking-orders/$booking_id");
    }
    
    /**
     * Cancel a booking
     */
    public function cancel_booking($booking_id, $reason = '') {
        return $this->request("/booking-orders/$booking_id/cancel", 'POST', [
            'reason' => $reason
        ]);
    }
    
    /**
     * Get resources
     */
    public function get_resources() {
        if (!$this->biz_id) {
            return new WP_Error('no_biz_id', 'Business ID not configured');
        }
        
        return $this->request("/bizes/{$this->biz_id}/resources");
    }
    
    /**
     * Check API health
     */
    public function health_check() {
        return $this->request('/health');
    }
    
    /**
     * Test connection
     */
    public function test_connection() {
        $result = $this->health_check();
        
        if (is_wp_error($result)) {
            return [
                'success' => false,
                'error' => $result->get_error_message()
            ];
        }
        
        return [
            'success' => true,
            'data' => $result
        ];
    }
    
    /**
     * Log message
     */
    private function log($message) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[Bizing API] $message");
        }
    }
}