# ESTORA — System Architecture

## Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS v4 (class-based `dark:` mode + `#F8F8F7` light / `#111111` dark canvas, `#FFFFFF` / `#1C1C1C` cards, `#143A30` primary emerald accent, `#8C6D46` / `#D4B483` bronze accent, `14–20px` radius), `Playfair Display` + `Plus Jakarta Sans` + `JetBrains Mono` + `Noto Sans Arabic/SC/Devanagari/Bengali`, Three.js (`three`).
- **Localization:** 10-language i18n (`en`, `zh`, `hi`, `es`, `ar` RTL, `fr`, `pt`, `bn`, `ru`, `uz`) via `src/i18n/` and `I18nContext.tsx` (`dir="rtl"` for Arabic, `Intl.DateTimeFormat`, localized currency & Uzbekistan city display names).
- **Backend:** Express (`server.ts`) running on port 3000 with Vite middleware in development and static `dist/` serving in production.
- **Database:** Cloud SQL PostgreSQL (`asia-southeast1`, instance `ai-studio-7ff22ac0`) via `pg` Pool and Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`).
- **Authentication:** Firebase Authentication (Google Sign-In popup) verified server-side by `firebase-admin` in `src/middleware/auth.ts`.
- **AI Layer:** Two-stage server-side `@google/genai` agent (`src/lib/gemini.ts`, `gemini-4-hydrogen`, JSON `responseSchema`) backed by `src/utils/aiAgent.ts`: Stage 1 parses natural-language intent & Uzbekistan filters; backend executes real PostgreSQL queries (`listProperties`, `getPropertiesByIds`); Stage 2 synthesizes grounded property rationales, multi-object comparisons, clarifying questions, and optional opt-in preference suggestions with strict zero-PII enforcement.
- **3D & 360° Engine:** Real WebGL rendering via `Model3DCanvas` (`GLTFLoader` + `RoomEnvironment` PMREM + `OrbitControls` + `Box3` auto-framing) and `Panorama360Canvas` (inside-out equirectangular `SphereGeometry`, damped look/zoom, adjacent room preloading, spherical 3D hotspot projection, and click-on-sphere placement).
- **Media Storage:** Express `multer` upload pipeline (`POST /api/uploads`, `DELETE /api/uploads/:id`) storing validated JPG/PNG/WEBP photos, `2:1` 360° panoramas, and `.glb`/`.gltf` binary/JSON-verified 3D models in `/uploads` with metadata indexed in PostgreSQL `media_assets`.

## Directory Layout
```text
/
├── server.ts                    # Express API, /uploads media storage, 3D tour & AI endpoints, Vite/static entry
├── firebase-applet-config.json  # Public Firebase web config
├── uploads/samples/             # Valid architectural GLB models for featured 3D showcase listings
├── src/
│   ├── db/
│   │   ├── schema.ts            # Drizzle tables (`users`, `properties`, `media_assets`, `tour_3d_tours`, `tour_3d_rooms`, `tour_3d_hotspots`, `favorites`, `messages`)
│   │   ├── drizzle.config.ts    # Drizzle Kit admin configuration
│   │   ├── index.ts             # Lazy pg Pool connection
│   │   └── properties.ts        # Property CRUD, batched ID/tour hydration, media asset & 3D tour persistence
│   ├── lib/                     # firebase, firebase-admin, two-stage ESTORA AI agent (`gemini.ts`), typed fetch (`api.ts`)
│   ├── middleware/auth.ts       # Bearer ID token verification
│   ├── context/                 # `AuthContext.tsx`, `I18nContext.tsx` (10 langs + RTL), `ThemeContext.tsx` (Light/Dark/System)
│   ├── i18n/                    # `types.ts`, `index.ts`, `i18n.test.ts`, `locales/{en,zh,hi,es,ar,fr,pt,bn,ru,uz}.ts`
│   ├── utils/                   # `aiAgent`, `formatters`, `listingWizard`, `uzbekistan`, `tour3d`, `webglSupport`, unit tests
│   ├── components/              # Navbar, Footer, SearchBar, CompactAiButton, PropertyCard, Tour3DViewer, PropertyDetailModal
│   │   ├── tour3d/              # `Model3DCanvas.tsx` (GLB/GLTF), `Panorama360Canvas.tsx` (360° sphere + hotspots)
│   │   └── listing-wizard/      # `UzbekistanMapPicker`, `WizardStepsBasic` (1-4), `WizardStepsMedia` (5-8), `Tour3DUploader` (Step 6)
│   └── pages/                   # Home, Catalog (`/3d`), EstoraAi, Favorites, AddProperty, Messages, Profile, Settings, Admin
```
