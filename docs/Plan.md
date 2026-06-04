# Waypoint — Build Plan

> Status key: ✅ Complete · 🔄 In Progress · ⬜ Not Started

---

## Phase 0 — Foundation ✅

**Backend**
- [x] Express app with all 12 route files registered
- [x] Auto-migration runner (`_migrations` table, runs each SQL file once)
- [x] Full database schema — 16 tables, `VARCHAR + CHECK` constraints (no Postgres enums)
- [x] `asyncHandler` wrapper on every route, `errorHandler` middleware last
- [x] All list endpoints use single SQL query with `jsonb_agg + DISTINCT + FILTER`
- [x] Trip detail returns full trip in one CTE query (stops, expenses, packing, journal)
- [x] 5 Claude AI endpoints with `cache_control: ephemeral` on system prompts
- [x] R2 photo upload/delete (multer, 5 MB limit, MIME filter)
- [x] Open-Meteo weather proxy with 1-hour in-memory cache
- [x] Expense summary endpoint (totals by category)
- [x] Packing list item `is_packed` toggle
- [x] Multi-stage backend Dockerfile

**Frontend**
- [x] Angular 17 standalone components, `OnPush` change detection throughout
- [x] Angular Material theme — teal 800 primary, amber 600 accent, dark/light toggle
- [x] `ThemeService` with signal-based toggle and 19 CSS custom properties
- [x] Responsive sidebar shell (`MatSidenav`) — side on desktop, hamburger on mobile
- [x] All 6 nav routes lazy-loaded (Trips, Destinations, Restaurants, Lodging, Map, Stats)
- [x] PWA service worker — app-shell prefetch + API freshness cache
- [x] Destinations list — status chips, state filter, search, card grid
- [x] Destinations detail — hero photo, 7-day weather strip, best-months pills, POI list
- [x] Destinations add/edit form — all fields, month chip autocomplete, date picker, star rating
- [x] Multi-stage frontend Dockerfile (node:20 build → nginx:1.25 serve)

**Project**
- [x] `.gitignore` (node_modules, dist, .env, .angular)
- [x] `README.md` with stack, structure, and local dev setup guide
- [x] `docs/Plan.md` (this file)

---

## Phase 1 — Restaurants, Lodging & Trips CRUD ✅

**Restaurants**
- [x] `RestaurantService` — full CRUD via `/api/restaurants`
- [x] List page — cuisine filter dropdown, price-range chips, search bar, card grid
- [x] Detail page — full info, photo gallery, Google Maps link, AI description button (Claude)
- [x] Add/edit form — all fields, pet-friendly toggle, price range selector, star rating

**Lodging**
- [x] `LodgingService` — full CRUD via `/api/lodging`
- [x] List page — type filter chips (hotel/motel/airbnb/resort/campground), search, card grid
- [x] Detail page — amenity chips, photo gallery, would-return badge, Maps link
- [x] Add/edit form — all fields, amenities chip input, price-per-night, room quality / cleanliness stars

**Trips**
- [x] `TripService` — full CRUD + status patch via `/api/trips`
- [x] `ClaudeService` — all 5 AI endpoints wired
- [x] List page — status filter chips, sorted active-first, colour-coded status bar
- [x] Detail page — stop timeline, trip metadata, tabbed layout (Expenses/Packing/Journal/Fuel placeholders)
- [x] Add/edit form — name, dates (date picker), budget, status, notes
- [x] Status quick-patch buttons ("Start Trip" / "Complete Trip")

---

## Phase 2 — Trip Planning Tools ✅

**Services added**
- [x] `StopService`, `ExpenseService`, `PackingService`, `JournalService`, `FuelService`

**Trip Stops tab** (`TripStopsTabComponent`)
- [x] Add stop inline — destination + lodging selects, arrival/departure date pickers
- [x] Stop cards — destination, city/state, dates, lodging, status badge
- [x] Reorder stops — up/down arrows swap `stop_order` values
- [x] Cycle status on click (upcoming → current → completed)
- [x] Edit stop inline, delete with confirm

**Expenses tab** (`TripExpensesTabComponent`)
- [x] Summary cards — total spent, per-category breakdown
- [x] Donut chart (ng2-charts v10 + Chart.js) — spending by category, colour-coded
- [x] Category filter chips
- [x] Add / edit / delete expense inline

**Packing Lists tab** (`TripPackingTabComponent`)
- [x] Create / rename / delete packing lists
- [x] Item checklist grouped by category with `mat-progress-bar` (% packed)
- [x] Toggle `is_packed` per item, bulk check/uncheck by category
- [x] AI Suggest → `/api/claude/packing-suggestions` → selection overlay → bulk import

**Journal tab** (`TripJournalTabComponent`)
- [x] Entries sorted newest-first, expandable preview cards
- [x] Add / edit / delete journal entry (title, body, date)

**Fuel Log tab** (`TripFuelTabComponent`)
- [x] Summary — total cost, gallons, avg price/gal, cost-per-mile (when odometer present)
- [x] Add / edit / delete fuel stop

---

## Phase 3 — Interactive Map ✅

**Map Page** (`MapComponent` — full-screen Leaflet + OSM)
- [x] Leaflet map centered on contiguous US + Canada (zoom 4)
- [x] Destination pins — DivIcons colour-coded by status (blue/amber/green), no image assets required
- [x] Click pin → popup (name, city/state, status, star rating, "View →" button using `window._wpNav`)
- [x] Layers toggle panel — show/hide destinations, show/hide POIs
- [x] Legend (bottom-left) — colour key for all marker types

**Trip Route View**
- [x] Trip selector dropdown — loads all trips into select
- [x] On selection: fetches full trip, draws numbered stop markers + dashed polyline in order
- [x] `map.fitBounds()` zooms to the selected route with padding
- [x] Clearing trip selection removes the route layer

**POI Markers**
- [x] Rotated-square orange DivIcon — visually distinct from destination pins
- [x] Toggle layer, extracted from destinations' `pois[]` array
- [x] Popup shows POI name and parent destination name

**Mini-Map on Detail Pages** (`MiniMapComponent` — shared, non-interactive)
- [x] Destination detail — shows when `latitude` + `longitude` present
- [x] Restaurant detail — shows when `latitude` + `longitude` present
- [x] Lodging detail — shows when `latitude` + `longitude` present
- [x] Signal-based inputs (`input.required<number>()`), runs outside Angular zone
- [x] `@types/leaflet` installed, `leaflet.css` added to `angular.json`

---

## Phase 4 — Photos & AI Features ✅

**Photo Uploads**
- [x] Backend photo endpoints on destinations, restaurants, lodging (POST /:id/photos, DELETE /:id/photos/:photoId, PATCH /:id/photos/:photoId/primary)
- [x] `PhotoService` — uploads file to R2 then saves DB record in one pipeline
- [x] `PhotoUploaderComponent` — drag-and-drop or click to browse, 5 MB guard, live previews
- [x] Primary photo selection — "PRIMARY" badge + star button promotes any photo
- [x] Delete photo — removes DB record + R2 object
- [x] Photo uploader wired into destination detail, restaurant detail, lodging detail

**AI Features**
- [x] Suggest Destination page (`/destinations/suggest`) — travel-style chips + free-text → 3 Claude cards with activities & best months → "Save to Wishlist" navigates to `/destinations/new` with query-param pre-fill
- [x] Best Time to Visit — button on destination detail → JSON parse → best-months chips + season breakdown → "Apply to Best Months" patches the destination
- [x] Packing Suggestions — already delivered in Phase 2 (packing tab AI Suggest button)
- [x] Trip Summary — button on active/completed trip detail → Claude narrative → "Save as Journal Entry" wired to JournalService
- [x] Restaurant Description — AI description panel + "Save to Highlights" button patches `highlights` field

---

## Phase 5 — Stats & PWA Polish ✅

**Stats Page** (`StatsComponent` + `StatsService` + `GET /api/stats`)
- [x] Backend: single CTE-free parallel-query endpoint returning destinations, trips, expenses, fuel stats
- [x] Destinations panel — donut chart by status, summary counts, top 5 states list
- [x] Trips panel — bar chart trips per year, avg duration, total days traveled
- [x] Spending panel — donut chart by category, total + avg per trip, per-category breakdown chips
- [x] Road stats panel — miles (odometer deltas), gallons, fuel cost, cost-per-mile

**PWA Polish**
- [x] Install prompt banner — `beforeinstallprompt` caught in shell, dismissable with close button
- [x] `manifest.webmanifest` — name, theme color (#00695C), shortcuts for Trips/Destinations/Map
- [x] `manifest` linked from `index.html`, added to `angular.json` assets
- [x] `ngsw-config` update — entity lists cached 1 day with 5s timeout for offline fallback
- [ ] Offline fallback page — deferred (service worker serves cached index.html automatically)

**UX / Performance**
- [x] `SkeletonGridComponent` — shimmer animation replacing spinners on all 4 list pages
- [x] Empty states with emoji + descriptive text already on all list pages (Phase 1–2)
- [ ] Keyboard navigation — deferred to post-Phase 6

---

## Phase 6 — Railway Production Deployment 🔄

> See `docs/deploy.md` for the full step-by-step guide.

**Code — done**
- [x] `backend/Dockerfile` — multi-stage node:20 build, explicit COPY paths
- [x] `frontend/Dockerfile` — node:20 build → nginx:1.25 serve, envsubst for `$BACKEND_URL`
- [x] `frontend/nginx/nginx.conf` — `proxy_ssl_verify off`, `proxy_ssl_server_name on`, `proxy_set_header Host $proxy_host`
- [x] `frontend/nginx/docker-entrypoint.sh` — `envsubst '$BACKEND_URL'` (limits substitution)
- [x] CORS respects `CORS_ORIGIN` env var — comma-separated origins, defaults to `*` in dev
- [x] `backend/.env.example` updated with `CORS_ORIGIN`
- [x] `docs/deploy.md` written — full 7-step guide with troubleshooting table

**Infra — you run these steps**
- [ ] Push repo to GitHub
- [ ] Create Railway project + PostgreSQL plugin
- [ ] Backend service: Dockerfile `backend/Dockerfile`, set all env vars
- [ ] Verify `/health` + migration logs on first deploy
- [ ] Frontend service: Dockerfile `frontend/Dockerfile`, set `BACKEND_URL`
- [ ] Set `CORS_ORIGIN` on backend after frontend URL is known
- [ ] (Optional) Cloudflare CNAME → Railway domain, Full (strict) SSL
- [ ] Smoke test 7-item checklist in `docs/deploy.md`

---

## Trip Wizard — Complete ✅

**Backend**
- [x] `002_ai_fields.sql` — `suggested_by_ai`, `google_place_id` on lodging/restaurants/POIs
- [x] `googlePlaces.ts` — Text Search + Place Details + photo URL; `enrichBatch` (3 concurrent, 200ms gap)
- [x] `POST /api/trips/wizard/generate` — Claude plans route, Google enriches every suggestion; returns preview (nothing saved)
- [x] `POST /api/trips/wizard/confirm` — transactionally saves trip, stops, lodging, restaurants, POIs, packing list from approved plan
- [x] Normalizers for `poi_type`, `lodging_type`, `country`, `price_range` — guards against Claude inventing invalid enum values

**Frontend**
- [x] 4-step `TripWizardComponent` at `/trips/new`
- [x] Step 1: basics form + cuisine/interest chips
- [x] Step 2: animated loading screen with cycling Claude progress messages
- [x] Step 3: full review — lodging radio select, restaurant/POI toggles, packing checkboxes, budget estimate
- [x] Step 4: confirmed with Open Trip Companion button
- [x] Two-panel Trip Companion at `/trips/:id` — stop cards left, Leaflet route map right
- [x] Sidebar: amber "Plan a Trip" CTA button + "My Trips" nav reorder

---

## Backlog (Post-Phase 6)

- [ ] Multi-user support (remove `user_id DEFAULT 1`, add auth)
- [ ] Share a trip as a read-only public link
- [ ] Export trip to PDF (itinerary + journal + expenses)
- [ ] Import destinations from a GPX or KML file
- [ ] Email digest of upcoming planned trips
- [ ] Native mobile app (Capacitor wrapper around the Angular PWA)
