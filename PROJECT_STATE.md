# ESTORA — Project State

**Last Updated:** 2026-11-16
**Current Version:** `0.8.0`
**Current Stage:** Stage 7 (Prompt 8) — Personal Cabinet, Real-Time Messaging, Reviews & Notifications

## Summary
ESTORA is operational as a full-stack luxury Real Estate Marketplace exclusively for Uzbekistan (Tashkent, Samarkand, Bukhara, Andijan, Fergana, Namangan, Nukus, Karshi, Termez, Navoi, Urgench, Jizzakh, and additional Uzbek settlements). The application runs on React 19 + Vite + Express (`server.ts`) with a server-authoritative authenticated WebSocket hub (`ws` at `/ws`), connected to Cloud SQL PostgreSQL via Drizzle ORM, Firebase Authentication, Three.js WebGL 3D/360° rendering, local server media storage (`POST /api/uploads` + `DELETE /api/uploads/:id` + `/uploads/*` + `media_assets` table), a two-stage grounded Gemini AI real estate agent (`gemini-4-hydrogen`), 10-language i18n with Arabic RTL support, a 3-mode Light/Dark/System design system, Buyer/Seller Personal Cabinet, Real-Time Messenger with verified photo attachments and read receipts, Seller Reviews & Moderation, and 5-type live Notifications.

## Implemented Features & Routes
All 12 requested sections remain integrated under unified navigation (`Navbar` + live Notification Bell, `Footer`, mobile drawer) with full 10-language localization (`en`, `zh`, `hi`, `es`, `ar` RTL, `fr`, `pt`, `bn`, `ru`, `uz`) and persistent 3-mode Light (`#F8F8F7` / `#FFFFFF` / `#171717`), Dark (`#111111` / `#1C1C1C` / `#F5F5F5`), and System theming (`ThemeProvider`):
1. `/` — Главная (`HomePage`: Hero + SearchBar, Популярные, Новые, 3D-туры, Популярные города Узбекистана, Преимущества, ESTORA AI + `CompactAiButton`)
2. `/catalog` — Каталог (`CatalogPage` — 9 категорий недвижимости, 12 SQL-фильтров, сохранение фильтров в кабинет, запись истории поиска, полнотекстовый поиск, 4 вида сортировки, пагинация, skeleton-загрузка и пустое состояние)
3. `/sale` — Продажа (раздел «Купить»)
4. `/rent` — Аренда (раздел «Арендовать»)
5. `/3d` — 3D-недвижимость (интерактивный `Tour3DViewer` с реальными `.glb`/`.gltf` 3D-моделями и 360°-панорамами)
6. `/ai` — ESTORA AI (`EstoraAiPage`: понимание естественного языка, структурированный подбор по PostgreSQL, карточки с «Почему подходит», сравнение 2–4 объектов бок о бок, уточняющие вопросы, синхронизация с языком интерфейса, отключаемая персонализация)
7. `/favorites` — Избранное (PostgreSQL `favorites`)
8. `/add` — Добавить / редактировать объявление (8-шаговый мастер публикации; Шаг 6 `Tour3DUploader`)
9. `/messages` — Сообщения в реальном времени (двухпанельный мессенджер по диалогам, отправка текста и проверенных фото через `POST /api/uploads`, время отправки, статус прочтения `Отправлено`/`Прочитано`, живые обновления через WebSocket `/ws`)
10. `/profile` — Личный кабинет (вкладки «Покупатель и арендатор»: избранное, история поиска, сохранённые фильтры, история просмотров, переписки, отзывы; «Продавец и арендодатель»: KPI просмотров/избранного/обращений/рейтинга, управление объявлениями, входящие сообщения, ответы на отзывы; «Уведомления»)
11. `/settings` — Настройки (язык интерфейса, валюта USD/UZS, тема оформления, телефон, город)
12. `/admin` — Админ-панель (метрики, модерация статусов объектов и модерация жалоб на отзывы)

## Platform Alignment Note
The user prompt referenced Next.js App Router and Supabase (including Supabase Realtime); within the AI Studio runtime environment, the architecture uses the equivalent full-stack setup: React 19 + Vite SPA path routing + Express `server.ts` with authenticated WebSocket (`ws`), Cloud SQL PostgreSQL + Drizzle ORM, and Firebase Authentication.
