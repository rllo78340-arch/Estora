# ESTORA — Pending Roadmap & Tasks

## Completed in Stage 1
- [x] Provision Cloud SQL PostgreSQL (`asia-southeast1`) & Drizzle ORM schema (`users`, `properties`, `favorites`, `messages`)
- [x] Configure Firebase Authentication (`signInWithPopup`) & backend `requireAuth` verification
- [x] Implement Express `server.ts` API endpoints & seed initial Uzbekistan luxury listings
- [x] Build ESTORA Luxury Design System (`#F8F8F7`, `#171717`, `#143A30`, `14–20px` radii)
- [x] Implement unified 12-route structure & full Homepage sections

## Completed in Stage 2 (Prompt 3 — Real Estate Marketplace)
- [x] Strict Uzbekistan-only geographic enforcement (`validateUzbekistanLocation`) on UI & server (`POST` / `PATCH /api/properties`)
- [x] Full 9 property categories (Квартиры, Дома, Виллы, Пентхаусы, Новостройки, Коммерческая недвижимость, Офисы, Магазины, Земельные участки) & Купить / Арендовать sections
- [x] All 12 PostgreSQL filters (city, district, price, bedrooms, area, floor, category, renovation, furnished, parking, 3D tour, publication date) + full-text search + 4 sorts
- [x] SQL pagination (`page`, `pageSize`, `total`, `totalPages`), skeleton loading, empty states, and seller ratings on cards

## Completed in Stage 3 (Prompt 4 — Listing Creation System)
- [x] 8-step Listing Creation & Editing Wizard (`/add` & `/add?edit=<id>`) with step validation and `localStorage` draft continuity
- [x] Interactive Uzbekistan map coordinate picker (`UzbekistanMapPicker`) with server-side bounds verification
- [x] Multi-currency pricing (USD / UZS) + monthly rent support & extended specs (heating, AC, balcony, amenities)
- [x] Multi-photo gallery upload/reorder/cover/delete + 3D GLB/GLTF, 360° panorama, and virtual tour URL support (`POST /api/uploads` + `media_assets`)
- [x] Owner listing lifecycle management in Profile (`draft`, `pending`, `active`, `archived`, Edit, Archive, Delete)

## Completed in Stage 4 (Prompt 5 — 3D/360° Viewer & Simple Tour Uploader)
- [x] Full Three.js `Model3DCanvas` (`GLTFLoader`, `OrbitControls`, `RoomEnvironment` PMREM lighting, `Box3` auto-fit) for `.glb`/`.gltf` architectural models
- [x] Interactive 360° buyer viewer (`Panorama360Canvas` & `Tour3DViewer`) with mouse/touch drag, vertical look, pinch/wheel/`+`/`-` zoom, auto-rotate, fullscreen, room drawer, room transition hotspots, and "Предыдущая комната" history back button
- [x] 3-option Seller Step 6 Uploader (`Tour3DUploader`): Вариант A (`.glb`/`.gltf` + live preview), Вариант B (multi-room `2:1` panoramas with strict aspect validation, rename/reorder/delete, and visual click-on-sphere Room Connector + live test mode), Вариант C (skip cleanly without 3D)
- [x] PostgreSQL persistence (`tour_3d_tours`, `tour_3d_rooms`, `tour_3d_hotspots`) & owner-only `/api/properties/:id/tour` and `/api/uploads/:id` routes
- [x] Property honesty guard (`hasReal3dContent`): prominent `«ПОСМОТРЕТЬ 3D / 360° ТУР»` CTA only when real 3D/360° assets exist
- [x] Full Light & Dark theme support across UI and 3D/360° scene viewer (`ThemeContext`)

## Completed in Stage 5 (Prompt 6 — ESTORA AI Intelligent Real Estate Agent)
- [x] Two-stage grounded Gemini AI pipeline (`gemini-4-hydrogen` + structured JSON `responseSchema`) parsing natural language requests into PostgreSQL catalog filters & handoff links (`/catalog?...`)
- [x] Zero-hallucination recommendation hydration (`hydrateGroundedRecommendations`) attaching real DB listings with per-property «Почему подходит» explanations
- [x] Multi-property comparison matrix (2–4 objects: price, price/m², area, rooms, floor, renovation, furniture/parking, 3D tour) + AI verdict
- [x] Clarifying follow-up question chips & explicit opt-in preference suggestions (zero silent profile mutations)
- [x] Toggleable PII-free personalization (`enabled`, `language`: `ru`/`uz`/`en`, preferred city/budget/type/rooms, search history, favorites) + «Очистить историю»
- [x] Compact HomePage AI launcher (`CompactAiButton`) with quick popover & full `/ai` workspace deep-link

## Completed in Stage 6 (Prompt 7 — 10 Languages & Dark Theme)
- [x] Full 10-language interface (`en`, `zh`, `hi`, `es`, `ar`, `fr`, `pt`, `bn`, `ru`, `uz`) with header language selector and `localStorage` persistence (`estora_lang_v1`)
- [x] Arabic RTL layout support (`dir="rtl"`, logical margins/positions, RTL chevron mirroring) & multilingual script fonts (`Noto Sans Arabic`, `SC`, `Devanagari`, `Bengali`)
- [x] Localized dates (`Intl.DateTimeFormat`), USD/UZS formatting, city display names, notifications, 12-route UI, ESTORA AI, 3D/360° viewer, and 8-step Listing Creation Wizard
- [x] 3-mode theme switcher (`Light`, `Dark`, `System`) persisted in `estora_theme_v1` with exact palette (`#F8F8F7`/`#FFFFFF`/`#171717` light; `#111111`/`#1C1C1C`/`#F5F5F5`/`#A0A0A0` dark) and smooth transitions

## Completed in Stage 7 (Prompt 8 — Personal Cabinet, Messages, Reviews & Notifications)
- [x] Personal Cabinet (`/profile`) with Buyer/Tenant tab (favorites, saved filters, search history, view history, conversations, reviews) and Seller/Landlord tab (listings, editing, view/favorite/message stats, inbox, publication controls, review replies)
- [x] Real-Time Messenger (`/messages`) with WebSocket `/ws`, grouped threads, text + verified photo upload with lightbox, timestamps, read receipts (`Sent`/`Read`), and inquiry photo attachments
- [x] Seller Reviews (`PropertyDetailModal`, `/profile`, `/admin`) with 1–5★ rating, auto-recalculated seller rating, publication date, seller reply, and report abuse + admin moderation
- [x] Notifications System (`Navbar` bell popover, live WebSocket toast, `/profile?tab=notifications`) covering all 5 types (`new_message`, `listing_reply`, `status_changed`, `new_match`, `review_reply`)

## Upcoming Stages (Awaiting Next Prompts)
- [ ] **Interactive Map Integration:** Google Maps Platform integration across Uzbekistan cities & districts
- [ ] **Role-Based Admin Guard & Agency Verification:** Dedicated agent verification badges & strict admin role enforcement
- [ ] **Tour Booking Calendar:** Interactive appointment slot scheduling & calendar sync
