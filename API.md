# ESTORA — API & Integrations

All backend routes are served by Express in `server.ts` on port `3000`. Protected routes require `Authorization: Bearer <Firebase_ID_Token>`.

## Endpoints

### System & Profile
- `GET /api/health` — Platform & Gemini configuration readiness status.
- `GET /api/me` *(Auth)* — Synchronizes Firebase user with PostgreSQL `users` and returns profile.
- `PATCH /api/me` *(Auth)* — Updates `fullName`, `phone`, `preferredCity`, `preferredCurrency`, `notificationsEnabled`.

### Properties & Cities
- `GET /api/properties` — Returns `{ properties, total, page, pageSize, totalPages }` with PostgreSQL filtering, sorting, and pagination.
  - Filters: `dealType`, `propertyType`, `city`, `district`, `minPrice`, `maxPrice`, `bedrooms`, `minArea`, `maxArea`, `minFloor`, `maxFloor`, `renovation`, `furnished`, `parking`, `has3dTour`, `featured`, `publishedWithin` (`24h` | `7d` | `30d`), `q`, `mine`.
  - Sort: `newest` | `price_asc` | `price_desc` | `popular`.
  - Pagination: `page` (default `1`), `pageSize` / `limit` (default `6`, max `50`).
- `GET /api/properties/:id` — Returns single property with owner contact info, coordinates, gallery, 3D assets, `tourConfig`, `tourRooms`, `tourHotspots`, and `sellerRatingTenths`.
- `POST /api/properties` *(Auth)* — Creates a new property listing (`draft` or `pending`) in PostgreSQL, including transactional `tourRooms`, `tourHotspots`, and `tourConfig` (`tourAutoRotate`, `tourDefaultFov`, `tourExposure`). Enforces strict Uzbekistan-only location & coordinate bounds (`validateUzbekistanLocation`, `validateUzbekistanCoordinates`), rejecting invalid payloads with HTTP `400`.
- `PATCH /api/properties/:id` *(Auth)* — Updates an existing listing and its 3D tour graph (owner or admin), including status transitions (`draft` | `pending` | `active` | `archived`) and Uzbekistan location/coordinate enforcement.
- `DELETE /api/properties/:id` *(Auth)* — Permanently deletes an owner's (or admin's) listing from PostgreSQL.
- `GET /api/properties/:id/tour` — Returns structured `{ tour, rooms, hotspots }` for a property's 3D/360° tour.
- `PUT /api/properties/:id/tour` *(Auth)* — Owner/admin-only update of a property's 3D model, panorama rooms, room transitions (`tourHotspots`), and scene config.
- `DELETE /api/properties/:id/tour` *(Auth)* — Owner/admin-only removal of all 3D/360° tour assets and `has3dTour` flag for a listing.
- `POST /api/uploads` *(Auth)* — Multipart `FormData` upload (`file`, `kind`: `photo` | `model3d` | `panorama`) validating extensions, GLB binary `"glTF"` magic header / GLTF JSON structure, and size limits (10 MB photos, 15 MB panoramas, 25 MB `.glb`/`.gltf`), storing files in `/uploads` and indexing metadata in PostgreSQL `media_assets`.
- `DELETE /api/uploads/:id` *(Auth)* — Owner/admin-only deletion of uploaded media asset record and local file.
- `GET /api/cities` — Aggregates active listing counts and minimum prices by Uzbekistan city.

### Favorites, Cabinet, Messages & WebSocket Realtime
- `GET /api/favorites` *(Auth)* — Lists user's saved properties.
- `POST /api/favorites/:propertyId` *(Auth)* — Saves property to favorites.
- `DELETE /api/favorites/:propertyId` *(Auth)* — Removes property from favorites.
- `POST /api/properties/:id/view` *(Optional Auth)* — Increments `properties.views_count` and upserts `view_history` when signed in.
- `GET /api/cabinet/overview` *(Auth)* — Aggregated buyer & seller dashboard data (favorites, searchHistory, savedFilters, viewHistory, authored/received reviews, per-listing stats with favoritesCount & incomingMessagesCount, unread counts).
- `GET` / `POST /api/saved-filters`, `PATCH` / `DELETE /api/saved-filters/:id` *(Auth)* — Saved catalog filters & match alert toggle.
- `GET` / `POST` / `DELETE /api/search-history`, `DELETE /api/search-history/:id` *(Auth)* — Persistent search history.
- `GET` / `DELETE /api/view-history` *(Auth)* — Viewed properties history.
- `GET /api/messages` *(Auth)* — Returns enriched sent and received messages (`senderName`, `recipientName`, `propertyTitle`, `imageUrl`, `readAt`).
- `POST /api/messages` *(Auth)* — Sends text and/or verified `/uploads/...` photo message; emits `message:created` & `notification:created` (`new_message` or `listing_reply`) via WebSocket `/ws`.
- `PATCH /api/messages/read` *(Auth)* — Marks incoming thread messages as read and broadcasts `message:read` receipt.
- `WS /ws` — Server-authoritative WebSocket channel authenticating via `{ type: "auth", token }` and pushing `message:created`, `message:read`, `notification:created`, and `review:updated`.

### Seller Reviews & Notifications
- `GET /api/sellers/:sellerId/reviews` — Public seller reviews list with average rating (`averageRatingTenths`) excluding hidden reviews.
- `POST /api/reviews` *(Auth)* — Submits/updates 1–5★ seller review (blocks self-reviews), recalculates `users.seller_rating_tenths`, emits `review:updated`.
- `POST /api/reviews/:id/reply` *(Auth)* — Seller-only reply to a review; emits `review_reply` notification & `review:updated`.
- `POST /api/reviews/:id/report` *(Auth)* — Reports a review (`spam` | `inaccurate` | `offensive` | `fraud` | `other`) and flags it for admin moderation.
- `GET /api/notifications`, `PATCH /api/notifications/read-all`, `PATCH /api/notifications/:id/read` *(Auth)* — User notification feed and read status.

### Admin & ESTORA AI
- `GET /api/admin/overview` *(Auth)* — Returns totals (`totalProperties`, `totalUsers`, `totalMessages`), all listings, and `flaggedReviews`.
- `PATCH /api/admin/properties/:id` *(Auth)* — Updates `status` (`active` | `pending` | `archived`) and `isFeatured`; dispatches `status_changed` and saved-filter `new_match` notifications.
- `PATCH /api/admin/reviews/:id` *(Auth)* — Moderates review visibility (`visible` | `flagged` | `hidden`) and recalculates seller rating.
- `GET /api/properties/batch?ids=1,2,3` — Returns active Uzbekistan property listings matching comma-separated IDs (up to 12) for ESTORA AI side-by-side comparison.
- `POST /api/ai/recommend` *(Optional Auth)* — Two-stage grounded ESTORA AI agent (`gemini-4-hydrogen`): accepts `{ prompt, history, personalization, selectedCompareIds, recentRecommendedIds }`, strips all PII, resolves signed-in favorites only when `personalization.enabled === true`, executes real PostgreSQL catalog searches, and returns `{ reply, configured, intent, language, appliedFilters, catalogUrl, totalCatalogMatches, recommendations, comparedProperties, comparisonSummary, comparisonMetrics, clarifyingQuestions, preferenceSuggestion }`. Requires `GEMINI_API_KEY` in server Secrets.
