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

## Phase 1 — Restaurants, Lodging & Trips CRUD ⬜

**Restaurants**
- [ ] List page — cuisine filter chips, price-range filter, search bar, card grid
- [ ] Detail page — full info, photo gallery, Google Maps link, AI description button
- [ ] Add/edit form — all fields, pet-friendly toggle, price range selector

**Lodging**
- [ ] List page — type filter chips, search bar, card grid (price/night, quality stars)
- [ ] Detail page — amenity chips, photo gallery, would-return badge
- [ ] Add/edit form — all fields, amenities chip input, price-per-night field

**Trips**
- [ ] List page — status filter chips (planning/active/completed/cancelled), trip cards
- [ ] Detail page — stop timeline, trip metadata, tabbed layout placeholder
- [ ] Add/edit form — name, dates, budget, status, notes
- [ ] Status quick-patch buttons ("Start Trip" / "Complete Trip")

---

## Phase 2 — Trip Planning Tools ⬜

**Trip Stops**
- [ ] Add stop inline on trip detail (destination autocomplete from existing destinations)
- [ ] Stop cards — linked destination + lodging, arrival/departure dates, status badge
- [ ] Reorder stops (up/down arrows or drag handle)
- [ ] Stop status update (upcoming → current → completed)

**Expense Tracker**
- [ ] Expenses tab on trip detail — total header, rows by category with color coding
- [ ] Add expense modal — category, description, amount, date, stop selector
- [ ] Summary donut chart (ng2-charts) — spending by category
- [ ] Edit / delete expense

**Packing Lists**
- [ ] Packing tab on trip detail
- [ ] Create named list, rename, delete list
- [ ] Item checklist — grouped by category, progress bar (% packed)
- [ ] Add / edit / delete items
- [ ] Toggle `is_packed` per item
- [ ] Bulk check/uncheck all items in a category
- [ ] AI suggest button → calls `/api/claude/packing-suggestions` → bulk-import items

**Trip Journal**
- [ ] Journal tab on trip detail — entries sorted by date (newest first)
- [ ] Add / edit / delete journal entry (title + body + date + optional stop link)

**Fuel Log**
- [ ] Fuel tab on trip detail — running total cost and gallons
- [ ] Add / edit / delete fuel stop (station, city/state, price/gal, gallons, odometer)
- [ ] Cost-per-mile calculation when odometer readings are present

---

## Phase 3 — Interactive Map ⬜

**Map Page**
- [ ] Leaflet map centered on contiguous US + Canada
- [ ] Destination pins — color-coded by status (blue/amber/green)
- [ ] Click pin → popup (name, city, status, rating, "View" button)
- [ ] Marker clustering for dense areas (Leaflet.markercluster)

**Trip Route View**
- [ ] Filter dropdown — "All destinations" or select a specific trip
- [ ] Draw polyline connecting trip stops in order when a trip is selected
- [ ] Animated route draw on selection change

**POI Markers**
- [ ] Toggle layer for Points of Interest
- [ ] Distinct secondary marker style

**Mini-Map on Detail Pages**
- [ ] Small non-interactive Leaflet map on destination detail
- [ ] Small non-interactive Leaflet map on restaurant detail
- [ ] Small non-interactive Leaflet map on lodging detail

---

## Phase 4 — Photos & AI Features ⬜

**Photo Uploads**
- [ ] Reusable `PhotoUploaderComponent` (file-drop, preview, progress)
- [ ] Calls `POST /api/uploads` → saves key+url to entity photos table
- [ ] Primary photo selection (pin icon on photo grid)
- [ ] Delete photo (calls `DELETE /api/uploads?key=` + removes DB record)
- [ ] Photo upload on: destination form, restaurant form, lodging form, journal entries

**AI Features**
- [ ] Suggest Destination page (`/destinations/suggest`) — preferences form → 3 Claude cards → "Save this" pre-fills add form
- [ ] Best Time to Visit — button on destination detail → modal with season breakdown → option to auto-populate `best_months`
- [ ] Packing Suggestions — button on packing tab → Claude list → bulk-import into active list
- [ ] Trip Summary — button on completed trip → narrative modal → save as journal entry
- [ ] Restaurant Description — button on restaurant detail → saves to `highlights` field

---

## Phase 5 — Stats & PWA Polish ⬜

**Stats Page**
- [ ] Destinations panel — donut chart (want to visit / planned / visited), top 5 states
- [ ] Trips panel — bar chart (trips per year), avg duration, total days traveled
- [ ] Spending panel — bar chart (expenses by category across all trips), avg cost per trip
- [ ] Road stats — total miles (odometer deltas), fuel cost trend line

**PWA Polish**
- [ ] Install prompt banner (dismissable)
- [ ] Offline fallback page (branded "You're offline" message)
- [ ] `ngsw-config` update — cache destinations + restaurants for offline browsing
- [ ] `manifest.webmanifest` — app icons, theme color, home screen shortcuts

**UX / Performance**
- [ ] Skeleton loading cards (shimmer) replacing spinners on list pages
- [ ] Empty-state illustrations (inline SVG) for lists with no data
- [ ] Keyboard navigation (Esc closes dialogs, Enter submits forms)

---

## Phase 6 — Railway Production Deployment ⬜

**Railway Setup**
- [ ] Create Railway project with two services (backend, frontend) + PostgreSQL plugin
- [ ] Copy `DATABASE_URL` from Postgres plugin → backend Variables
- [ ] Set backend env vars (`ANTHROPIC_API_KEY`, `R2_*`, `PORT`)
- [ ] Set frontend env var `BACKEND_URL` → backend private Railway URL
- [ ] Deploy backend service (Dockerfile: `backend/Dockerfile`, build context: repo root)
- [ ] Deploy frontend service (Dockerfile: `frontend/Dockerfile`, build context: repo root)
- [ ] Verify `/health` endpoint returns 200 in production
- [ ] Verify migrations ran on first deploy

**Cloudflare DNS**
- [ ] CNAME `waypoint.<domain>` → Railway frontend public domain
- [ ] Enable "Full (strict)" SSL mode in Cloudflare
- [ ] Optional: cache rules for `*.js` / `*.css` at edge

**Production Hardening**
- [ ] Lock CORS to production frontend domain via `CORS_ORIGIN` env var
- [ ] Confirm `DATABASE_URL` uses Railway's private network URL (not public)
- [ ] Smoke test all 6 nav routes in production
- [ ] Smoke test add/edit destination end-to-end in production

---

## Backlog (Post-Phase 6)

- [ ] Multi-user support (remove `user_id DEFAULT 1`, add auth)
- [ ] Share a trip as a read-only public link
- [ ] Export trip to PDF (itinerary + journal + expenses)
- [ ] Import destinations from a GPX or KML file
- [ ] Email digest of upcoming planned trips
- [ ] Native mobile app (Capacitor wrapper around the Angular PWA)
