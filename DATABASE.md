# ESTORA — Database Schema (PostgreSQL)

**Status:** Provisioned and active on Cloud SQL PostgreSQL (`asia-southeast1`) via Drizzle ORM (`src/db/schema.ts`).

## Tables

### 1. `users`
- `id` (serial PK)
- `uid` (text unique — Firebase Auth UID)
- `email` (text)
- `full_name` (text)
- `role` (text — `buyer` | `agent` | `admin`)
- `phone` (text)
- `preferred_city` (text — default `Ташкент`)
- `preferred_currency` (text — `USD` | `UZS`)
- `notifications_enabled` (boolean)
- `seller_rating_tenths` (integer — default `49`, representing `4.9` seller rating out of 5.0)
- `created_at`, `updated_at` (timestamp)

### 2. `properties`
- `id` (serial PK)
- `owner_id` (integer FK -> `users.id` cascade)
- `title` (text)
- `slug` (text unique)
- `deal_type` (text — `sale` | `rent`)
- `property_type` (text — `apartment` | `house` | `villa` | `penthouse` | `new_build` | `commercial` | `office` | `shop` | `land`)
- `country` (text — strictly `'Uzbekistan'`)
- `city`, `district`, `address` (text — Uzbekistan locations enforced on client & server)
- `latitude`, `longitude` (double precision — Uzbekistan coordinate bounds `37.1..45.6`, `55.9..73.2`)
- `price_usd`, `original_price`, `monthly_rent_usd`, `area_sqm`, `bedrooms`, `bathrooms`, `floor`, `total_floors` (integer)
- `price_currency` (text — `'USD'` | `'UZS'`)
- `renovation` (text — `designer` | `euro` | `cosmetic` | `shell`)
- `furnished`, `air_conditioning`, `parking`, `balcony` (boolean)
- `heating` (text — `central` | `individual` | `underfloor` | `none`)
- `views_count` (integer — default `0`, used for `popular` sorting)
- `has_3d_tour` (boolean), `tour_3d_label`, `model_3d_url`, `panorama_url`, `virtual_tour_url` (text)
- `status` (text — `draft` | `pending` | `active` | `archived`)
- `is_featured` (boolean)
- `image_url`, `gallery_images` (text JSON array), `description`, `amenities` (text JSON array)
- `contact_name`, `contact_phone`, `contact_method` (text — `phone` | `telegram` | `whatsapp` | `messages`)
- `created_at`, `updated_at` (timestamp)

### 3. `media_assets`
- `id` (serial PK)
- `owner_id` (integer FK -> `users.id` cascade)
- `kind` (text — `photo` | `model3d` | `panorama`)
- `file_name`, `mime_type`, `url` (text)
- `size_bytes` (integer)
- `created_at` (timestamp)

### 4. `tour_3d_tours`
- `id` (serial PK)
- `property_id` (integer unique FK -> `properties.id` cascade)
- `owner_id` (integer FK -> `users.id` cascade)
- `content_type` (text — `'model_3d'` | `'panorama_360'` | `'virtual_tour'` | `'none'`)
- `file_path` (text — path or URL for primary 3D asset)
- `processing_status` (text — `'uploading'` | `'processing'` | `'ready'` | `'failed'`)
- `auto_rotate` (boolean)
- `default_fov` (integer — default `75`)
- `exposure` (double precision — default `1.05`)
- `created_at`, `updated_at` (timestamp)

### 5. `tour_3d_rooms`
- `id` (serial PK)
- `property_id` (integer FK -> `properties.id` cascade)
- `owner_id` (integer FK -> `users.id` cascade)
- `room_key` (text — unique identifier within property tour)
- `room_name` (text — e.g. `Гостиная`, `Спальня`)
- `room_order` (integer)
- `file_path` (text — `/uploads/...` equirectangular 2:1 panorama)
- `content_type` (text — default `'panorama_360'`)
- `processing_status` (text — default `'ready'`)
- `initial_yaw` (double precision)
- `initial_pitch` (double precision)
- `created_at` (timestamp)

### 6. `tour_3d_hotspots`
- `id` (serial PK)
- `property_id` (integer FK -> `properties.id` cascade)
- `owner_id` (integer FK -> `users.id` cascade)
- `from_room_key` (text)
- `target_room_key` (text)
- `label` (text)
- `yaw` (double precision)
- `pitch` (double precision)
- `created_at` (timestamp)

### 7. `favorites`
- `id` (serial PK)
- `user_id` (integer FK -> `users.id` cascade)
- `property_id` (integer FK -> `properties.id` cascade)
- Unique index `(user_id, property_id)`
- `created_at` (timestamp)

### 8. `messages`
- `id` (serial PK)
- `property_id` (integer FK -> `properties.id` set null)
- `sender_id` (integer FK -> `users.id` cascade)
- `recipient_id` (integer FK -> `users.id` cascade)
- `subject`, `body` (text)
- `image_url` (text — safe platform-uploaded `/uploads/...` photo path)
- `is_read` (boolean)
- `read_at` (timestamp nullable)
- `created_at` (timestamp)

### 9. `saved_filters`
- `id` (serial PK)
- `user_id` (integer FK -> `users.id` cascade)
- `name` (text)
- `filters_json` (text)
- `notify_on_match` (boolean — triggers `new_match` notifications when matching Uzbekistan listings activate)
- `created_at` (timestamp)

### 10. `search_history`
- `id` (serial PK)
- `user_id` (integer FK -> `users.id` cascade)
- `query_text`, `filters_json` (text)
- `results_count` (integer)
- `created_at` (timestamp)

### 11. `view_history`
- `id` (serial PK)
- `user_id` (integer FK -> `users.id` cascade)
- `property_id` (integer FK -> `properties.id` cascade)
- Unique index `(user_id, property_id)`
- `viewed_at` (timestamp)

### 12. `reviews`
- `id` (serial PK)
- `seller_id` (integer FK -> `users.id` cascade)
- `author_id` (integer FK -> `users.id` cascade)
- `property_id` (integer nullable FK -> `properties.id` set null)
- `rating` (integer — 1..5)
- `comment`, `seller_reply` (text)
- `seller_replied_at` (timestamp nullable)
- `reports_count` (integer)
- `status` (text — `visible` | `flagged` | `hidden`)
- `created_at`, `updated_at` (timestamp)

### 13. `review_reports`
- `id` (serial PK)
- `review_id` (integer FK -> `reviews.id` cascade)
- `reporter_id` (integer FK -> `users.id` cascade)
- `reason`, `details` (text)
- Unique index `(review_id, reporter_id)`
- `created_at` (timestamp)

### 14. `notifications`
- `id` (serial PK)
- `user_id` (integer FK -> `users.id` cascade)
- `type` (text — `new_message` | `listing_reply` | `status_changed` | `new_match` | `review_reply`)
- `title`, `body`, `link_path` (text)
- `related_property_id`, `related_entity_id` (integer nullable)
- `is_read` (boolean)
- `created_at` (timestamp)
