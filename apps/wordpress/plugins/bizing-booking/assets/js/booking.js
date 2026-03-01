/**
 * Bizing Booking JavaScript
 */

(function($) {
    'use strict';

    $(document).ready(function() {
        initBookingForm();
    });

    function initBookingForm() {
        // Handle offer selection
        $('.bizing-select-offer-btn').on('click', function() {
            var $card = $(this).closest('.bizing-offer-card');
            var offerId = $card.data('offer-id');
            
            loadBookingForm(offerId);
        });

        // Handle date change
        $(document).on('change', '.bizing-date-picker', function() {
            var $form = $(this).closest('.bizing-booking-form');
            var offerId = $form.find('input[name="offer_id"]').val();
            var date = $(this).val();
            
            if (offerId && date) {
                loadAvailableSlots($form, offerId, date);
            }
        });

        // Handle slot selection
        $(document).on('click', '.bizing-slot-btn', function() {
            $('.bizing-slot-btn').removeClass('selected');
            $(this).addClass('selected');
            
            var slotTime = $(this).data('time');
            var $form = $(this).closest('.bizing-booking-form');
            $form.find('input[name="slot_time"]').remove();
            $form.append('<input type="hidden" name="slot_time" value="' + slotTime + '">');
        });

        // Handle form submission
        $(document).on('submit', '.bizing-booking-form', function(e) {
            e.preventDefault();
            submitBooking($(this));
        });

        // Close modal
        $(document).on('click', '.bizing-close-modal', function() {
            $('.bizing-success-modal').hide();
            location.reload();
        });
    }

    function loadBookingForm(offerId) {
        var $container = $('.bizing-booking-container');
        
        $container.html('<div class="bizing-loading">Loading...</div>');
        
        $.ajax({
            url: bizingBooking.restUrl + 'booking-form',
            method: 'GET',
            data: {
                offer_id: offerId
            },
            success: function(response) {
                $container.html(response);
            },
            error: function() {
                $container.html('<div class="bizing-error">Error loading form. Please try again.</div>');
            }
        });
    }

    function loadAvailableSlots($form, offerId, date) {
        var $slotsContainer = $form.find('.bizing-slots-container');
        
        $slotsContainer.html('<p>Loading available times...</p>');
        
        $.ajax({
            url: bizingBooking.restUrl + 'availability',
            method: 'GET',
            data: {
                offer_id: offerId,
                date: date
            },
            success: function(response) {
                // Handle both wrapped ({data: [...]}) and unwrapped ([...]) responses
                var slots = Array.isArray(response) ? response : (response.slots || response.data || []);
                var offerVersionId = response.offerVersionId || null;
                
                // Store offerVersionId for booking submission
                $form.data('offer-version-id', offerVersionId);
                
                if (slots.length > 0) {
                    renderSlots($slotsContainer, slots);
                } else {
                    $slotsContainer.html('<p>No available times for this date. Please select another date.</p>');
                }
            },
            error: function(xhr) {
                var message = 'Error loading availability.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                }
                $slotsContainer.html('<p class="error">' + message + '</p>');
            }
        });
    }

    function renderSlots($container, slots) {
        var html = '<div class="bizing-slots-grid">';
        
        slots.forEach(function(slot) {
            var time = new Date(slot.startAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            html += '<button type="button" class="bizing-slot-btn" data-time="' + slot.startAt + '">';
            html += time;
            html += '</button>';
        });
        
        html += '</div>';
        $container.html(html);
    }

    function submitBooking($form) {
        var $submitBtn = $form.find('.bizing-submit-btn');
        var $loading = $form.find('.bizing-loading');
        var $messages = $('.bizing-booking-messages');
        
        // Validate slot selection
        if (!$form.find('input[name="slot_time"]').val()) {
            showMessage('Please select a time slot.', 'error');
            return;
        }
        
        $submitBtn.prop('disabled', true);
        $loading.show();
        $messages.hide().removeClass('success error');
        
        var formData = {
            offer_id: $form.find('input[name="offer_id"]').val(),
            offer_version_id: $form.data('offer-version-id'),
            customer_name: $form.find('input[name="customer_name"]').val(),
            customer_email: $form.find('input[name="customer_email"]').val(),
            customer_phone: $form.find('input[name="customer_phone"]').val(),
            slot_time: $form.find('input[name="slot_time"]').val(),
            notes: $form.find('textarea[name="notes"]').val()
        };
        
        $.ajax({
            url: bizingBooking.restUrl + 'book',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-WP-Nonce', bizingBooking.nonce);
            },
            success: function(response) {
                $loading.hide();
                $submitBtn.prop('disabled', false);
                
                if (response.id) {
                    showSuccessModal(response);
                } else {
                    showMessage('Booking created successfully!', 'success');
                }
            },
            error: function(xhr) {
                $loading.hide();
                $submitBtn.prop('disabled', false);
                
                var message = 'An error occurred. Please try again.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                }
                showMessage(message, 'error');
            }
        });
    }

    function showMessage(message, type) {
        var $messages = $('.bizing-booking-messages');
        $messages.html('<p>' + message + '</p>')
                 .addClass(type)
                 .show();
        
        $('html, body').animate({
            scrollTop: $messages.offset().top - 100
        }, 500);
    }

    function showSuccessModal(booking) {
        var $modal = $('.bizing-success-modal');
        var $details = $modal.find('.bizing-booking-details');
        
        var html = '<p><strong>Booking ID:</strong> ' + booking.id + '</p>';
        html += '<p><strong>Date:</strong> ' + new Date(booking.requestedStartAt).toLocaleDateString() + '</p>';
        html += '<p><strong>Time:</strong> ' + new Date(booking.requestedStartAt).toLocaleTimeString() + '</p>';
        
        $details.html(html);
        $modal.show();
    }

})(jQuery);