# WordPress Bizing Booking Plugin

WordPress plugin that integrates with the Bizing API for booking appointments.

## 🚀 Quick Start

### Start WordPress Environment

```bash
cd ~/bizing/code/apps/wordpress
docker-compose up -d
```

**Access:**
- WordPress: http://localhost:8080
- phpMyAdmin: http://localhost:8081

### Configure Plugin

1. Go to WordPress admin: http://localhost:8080/wp-admin
2. Login with credentials (set during first run)
3. Navigate to **Bizing Booking** menu
4. Configure:
   - **API Base URL**: `http://host.docker.internal:6129/api/v1`
   - **API Key**: Your Bizing API key
   - **Business ID**: Your Biz ID

### Usage

Add the booking form to any page/post using the shortcode:

```
[bizing_booking]
```

**Shortcode Options:**
- `[bizing_booking offer_id="xxx"]` - Show form for specific offer
- `[bizing_booking show_offers="false"]` - Hide offers list, show form directly

## 📁 Plugin Structure

```
plugins/bizing-booking/
├── bizing-booking.php          # Main plugin file
├── includes/
│   ├── class-bizing-api.php    # API client
│   ├── class-booking-shortcode.php  # Shortcode handler
│   └── class-admin-settings.php     # Admin settings
├── assets/
│   ├── css/
│   │   └── booking.css         # Frontend styles
│   └── js/
│       └── booking.js          # Frontend JavaScript
├── logs/                        # Plugin logs
└── templates/                   # Template files
```

## 🔌 API Integration

The plugin connects to your local Bizing API:

- **Base URL**: `http://host.docker.internal:6129/api/v1`
- **Authentication**: Bearer token (API key)
- **Endpoints Used**:
  - `GET /bizes/{biz_id}/offers` - List offers
  - `GET /bizes/{biz_id}/offers/{id}/availability` - Get slots
  - `POST /booking-orders` - Create booking

## 🐛 Debugging

### View Logs

```bash
# Plugin logs
docker exec wordpress-wordpress-1 tail -f /var/www/html/wp-content/plugins/bizing-booking/logs/bizing-booking.log

# WordPress debug log
docker exec wordpress-wordpress-1 tail -f /var/www/html/wp-content/debug.log
```

### Test API Connection

1. Go to **Bizing Booking** → **Settings** in WordPress admin
2. Click **"Test API Connection"** button

## 📝 Development

### File Locations

All plugin files are in the monorepo:
```
~/bizing/code/apps/wordpress/plugins/bizing-booking/
```

Changes are automatically synced to the Docker container.

### Add New Features

1. Edit files in `~/bizing/code/apps/wordpress/plugins/bizing-booking/`
2. Changes are live immediately (volume mounted)
3. Test at http://localhost:8080

### API Client Methods

Available in `class-bizing-api.php`:

```php
$api = new Bizing_API_Client();

// Get offers
$offers = $api->get_offers();

// Get availability
$slots = $api->get_availability($offer_id, $date);

// Create booking
$booking = $api->create_booking([
    'offer_id' => 'xxx',
    'customer_email' => 'customer@example.com',
    'customer_name' => 'John Doe',
    'slot_time' => '2026-03-15T14:00:00Z'
]);

// Test connection
$result = $api->test_connection();
```

## 🛑 Stopping

```bash
cd ~/bizing/code/apps/wordpress
docker-compose down
```

To reset everything (including database):
```bash
docker-compose down -v
```

## 🔗 Integration with Monorepo

This plugin is part of the Bizing monorepo:
- Located at: `apps/wordpress/plugins/bizing-booking/`
- Uses the Bizing API from `apps/api/`
- Can be developed alongside the API

## 📝 TODO

- [ ] Add payment integration
- [ ] Add webhook handlers
- [ ] Add email notifications
- [ ] Add booking management in admin
- [ ] Add calendar sync
- [ ] Add Gutenberg block

## 📚 Resources

- [WordPress Plugin Handbook](https://developer.wordpress.org/plugins/)
- [Bizing API Documentation](../../docs/API_ARCHITECTURE_PLAN.md)
