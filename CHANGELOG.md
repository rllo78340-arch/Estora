# ESTORA — Changelog

## [0.8.0] - 2026-11-16 (Stage 7: Personal Cabinet, Real-Time Messenger, Reviews & Notifications — Prompt 8)
### Added
- Extended Cloud SQL PostgreSQL (`src/db/schema.ts`, `src/db/social.ts`) with `saved_filters`, `search_history`, `view_history`, `reviews`, `review_reports`, `notifications`, and `image_url`/`read_at` columns on `messages`.
- Built an authenticated server-authoritative WebSocket hub (`src/realtime/wsHub.ts` on `/ws`) and client `RealtimeContext` pushing `message:created`, `message:read`, `notification:created`, and `review:updated` events without UI telemetry clutter.
- Upgraded `ProfilePage` (`/profile`) into a 3-tab Personal Cabinet for Buyer/Tenant (favorites, saved filters, search history, view history, conversations, reviews), Seller/Landlord (portfolio KPIs, per-listing views/favorites/messages stats, listing moderation/edit/archive/delete, seller inbox, inline review replies), and Notifications.
- Upgraded `MessagesPage` (`/messages`) into a 2-pane real-time messenger supporting conversation grouping, All/Incoming/Unread filtering, verified `/uploads/...` photo attachments with lightbox preview, localized send timestamps, read receipts, and automatic read marking.
- Added Seller Reviews & Moderation across `PropertyDetailModal`, `ProfilePage`, and `AdminPage` (1–5★ rating, automatic average recalculation, publication date, seller reply, report abuse with admin Hide/Restore), plus `POST /api/properties/:id/view` view recording and Catalog "Save Filter" + DB search history logging.
- Added Header Notification Bell (`Navbar`) and live clickable notifications covering `new_message`, `listing_reply`, `status_changed`, `new_match`, and `review_reply` in all 10 languages and RTL Arabic.
- Added unit tests in `src/utils/social.test.ts` validating safe image URL checks, review scoring, thread grouping, saved filter matching, and seller KPI aggregation.

## [0.7.0] - 2026-11-16 (Stage 6: 10 Languages, RTL & 3-Mode Theme — Prompt 7)
### Added
- Implemented full 10-language i18n architecture (`src/i18n/locales/{en,zh,hi,es,ar,fr,pt,bn,ru,uz}.ts`, `src/i18n/types.ts`, `src/i18n/index.ts`, `src/context/I18nContext.tsx`) with `localStorage` persistence (`estora_lang_v1`), header switcher, dynamic `<html lang>` & `dir="rtl"` for Arabic, and international font stack (`Noto Sans Arabic`, `SC`, `Devanagari`, `Bengali`).
- Localized all 12 routes, filters, notifications, errors, ESTORA AI prompts/responses, 8-step Listing Creation Wizard, Step 6 `Tour3DUploader`, Three.js 3D/360° viewer controls, `Intl.DateTimeFormat` dates, USD/UZS currency formatting, and localized Uzbekistan city display names while preserving canonical backend city keys.
- Upgraded `ThemeContext` (`estora_theme_v1`) to support 3 modes (`light`, `dark`, `system` with live `prefers-color-scheme: dark` listener) and aligned dark palette across the entire app (`#F8F8F7`/`#FFFFFF`/`#171717` light; `#111111`/`#1C1C1C`/`#F5F5F5`/`#A0A0A0` dark) with smooth transitions.
- Added unit tests in `src/i18n/i18n.test.ts` validating schema parity across all 10 locales, Arabic RTL switching, date/price localization, city display translation, and theme resolution.

## [0.6.0] - 2026-11-16 (Stage 5: ESTORA AI Intelligent Real Estate Agent — Prompt 6)
### Added
- Built a two-stage grounded ESTORA AI real estate agent in `src/lib/gemini.ts` (`gemini-4-hydrogen`, JSON `responseSchema`) backed by pure filter sanitization, PII stripping, recommendation hydration, and comparison math in `src/utils/aiAgent.ts`.
- Added `getPropertiesByIds` in `src/db/properties.ts`, `GET /api/properties/batch`, and upgraded `POST /api/ai/recommend` (`optionalAuth`) to run real PostgreSQL catalog queries, resolve signed-in favorites only when personalization is enabled, and never fabricate listing IDs or prices.
- Upgraded `EstoraAiPage` (`/ai`) with multi-turn chat, natural language example prompts, inline DB recommendation cards with «Почему подходит», one-click «Открыть в каталоге» filter handoff, side-by-side 2–4 property comparison matrix, clickable clarifying questions, opt-in preference suggestions, language switcher (`ru` | `uz` | `en`), personalization ON/OFF switch, and «Очистить историю».
- Added compact bottom-right `CompactAiButton` quick assistant drawer on `HomePage`, recorded local search queries in `HomePage`/`CatalogPage` only when personalization is enabled, and added unit tests in `src/utils/aiAgent.test.ts`.

## [0.5.0] - 2026-11-16 (Stage 4: 3D/360° Viewer & Tour Builder — Prompt 5)
### Added
- Built real Three.js WebGL 3D & 360° rendering engines: `Model3DCanvas` (`GLTFLoader`, `RoomEnvironment`, `OrbitControls`, `Box3` auto-framing) and `Panorama360Canvas` (equirectangular `SphereGeometry`, smooth damped camera, pinch/wheel/button zoom, adjacent room preloading, projected 3D transition hotspots, and click-on-sphere placement).
- Rewrote `Tour3DViewer` with multi-room navigation, "Предыдущая комната" history stack, room drawer & bottom selector strip, fullscreen mode, auto-rotate, reset camera, mobile `>=44px` controls, and Light/Dark scene toggle (removing all fake demo zones).
- Created Step 6 `Tour3DUploader` with 5-step visual guide, Вариант A (`.glb`/`.gltf` <= 25 MB + live 3D preview), Вариант B (multi-room `2:1` panoramas <= 15 MB with strict `1.88..2.12` aspect-ratio rejection of ordinary photos, rename, reorder up/down, delete, visual Room Connector, and transition test mode), Вариант C (skip cleanly without 3D), collapsible «Дополнительные настройки», and explicit «Сохранить».
- Added PostgreSQL schema (`tour_3d_tours`, `tour_3d_rooms`, `tour_3d_hotspots`), GLB/GLTF server binary/JSON verification, `DELETE /api/uploads/:id`, and `GET`/`PUT`/`DELETE /api/properties/:id/tour` owner-protected routes.
- Enforced `hasReal3dContent(property)` across `PropertyDetailModal` (`«ПОСМОТРЕТЬ 3D / 360° ТУР»` button shown only with real 3D content) and `PropertyCard`.
- Implemented persistent Light & Dark theme (`ThemeContext` + Tailwind v4 `@custom-variant dark`) across the entire marketplace and 3D viewer.
- Added 3 valid architectural `.glb` showcase models in `/uploads/samples/` and unit tests in `src/utils/tour3d.test.ts`.

## [0.4.0] - 2026-11-16 (Stage 3: Listing Creation System — Prompt 4)
### Added
- Built an 8-step Listing Creation & Editing Wizard (`/add`, `/add?edit=<id>`) covering Basic info, Uzbekistan Address & Interactive Map Coordinates, USD/UZS Price & Rent, Features (renovation, furniture, heating, AC, parking, balcony, amenities), Multi-Photo Gallery Manager, 3D Assets (GLB/GLTF, 360° panoramas, virtual tour links), Seller Contacts, and Live Preview + Draft/Moderation Submission.
- Implemented server-side file upload pipeline (`POST /api/uploads` via `multer`, `/uploads/*` static serving, PostgreSQL `media_assets` table) enforcing format and file size rules (10 MB photos, 15 MB panoramas, 25 MB GLB/GLTF).
- Added owner listing management controls on `ProfilePage` (status filter tabs, Edit, Archive/Restore, Submit for Moderation, Delete with inline confirmation) backed by `PATCH` and `DELETE /api/properties/:id`.
- Enhanced `PropertyDetailModal` with multi-photo gallery thumbnails, map coordinates, heating/AC/balcony specs, contact method, and 3D model/virtual tour links.

## [0.3.0] - 2026-11-16 (Stage 2: Real Estate Marketplace — Prompt 3)
### Added
- Strict Uzbekistan-only location enforcement (`src/utils/uzbekistan.ts`) applied across UI forms and Express backend (`POST /api/properties`, `PATCH /api/properties/:id`) with `country = 'Uzbekistan'` stored in PostgreSQL.
- Expanded catalog to all 9 categories (`apartment`, `house`, `villa`, `penthouse`, `new_build`, `commercial`, `office`, `shop`, `land`) and Купить / Арендовать sections while preserving the existing Homepage and 12-route navigation.
- Implemented all 12 PostgreSQL-backed filters (Город, Район, Цена, Количество комнат, Площадь, Этаж, Тип недвижимости, Состояние ремонта, Мебель, Парковка, 3D-тур, Дата публикации), text search (`q`), and 4 sorts (`newest`, `price_asc`, `price_desc`, `popular`).
- Added SQL `LIMIT`/`OFFSET` pagination (`page`, `pageSize`, `total`, `totalPages`), loading skeletons, empty-state reset, seller ratings (`users.seller_rating_tenths`) on cards and detail modals, and 3 additional bespoke Uzbekistan architectural images (14 total active seeded listings).

## [0.2.0] - 2026-11-16 (Stage 1: ESTORA Uzbekistan Foundation)
### Added
- Provisioned Cloud SQL PostgreSQL (`asia-southeast1`) and created Drizzle ORM schema (`users`, `properties`, `favorites`, `messages`) with seeded Uzbekistan luxury properties.
- Configured Firebase Authentication (Google Sign-In) with server-side `firebase-admin` token verification.
- Implemented Express backend (`server.ts`) with full REST endpoints for properties, cities, favorites, messages, profile/settings, admin moderation, and server-side Gemini AI (`gemini-4-hydrogen`).
- Built unified 12-route luxury frontend (`#F8F8F7` canvas, `#171717` text, `#143A30` accent, `14–20px` radii) covering Homepage, Catalog, Sale, Rent, 3D Tours, ESTORA AI, Favorites, Add Property, Messages, Profile, Settings, and Admin Panel.
- Generated 6 bespoke architectural photographs of Uzbekistan properties and added unit tests (`src/utils/formatters.test.ts`).

## [0.1.0] - 2026-11-16 (Stage 0: Foundation)
### Added
- Initialized ESTORA metadata, typography, and six living technical documentation files.
