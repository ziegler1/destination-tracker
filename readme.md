# Waypoint

A personal travel companion web app for US and Canada road travel. Plan trips with an AI wizard, track destinations, restaurants, lodging, special-interest places (wineries, museums, parks, etc.), expenses, fuel, packing lists, and journal entries — all in one place, as an installable mobile-friendly PWA.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 17 (standalone components, lazy-loaded routes, signals, OnPush change detection) |
| **UI** | Angular Material 17 (M2 theme — teal #00695C primary, amber #FFB300 accent, dark/light toggle), responsive shell — fixed sidebar on desktop, bottom tab bar + Quick Add bottom sheets on mobile |
| **Backend** | Node.js 20 / Express 4 / TypeScript — compiled with `tsc`, hot-reload with `tsx watch` |
| **Database** | PostgreSQL 16 — `pg` pool (max 10 connections), auto-migration runner (`backend/db/*.sql`) |
| **AI** | Anthropic Claude (`claude-sonnet-4-5`) via `@anthropic-ai/sdk`, system-prompt caching — trip wizard, suggestions, summaries, descriptions |
| **File Storage** | Cloudflare R2 via `@aws-sdk/client-s3` (S3-compatible) |
| **Maps** | Google Maps JS API (`@angular/google-maps`) — Places Autocomplete, Advanced Markers, route polylines |
| **Weather** | Open-Meteo API (free, no API key, fetch by lat/lon) |
| **Charts** | ng2-charts (Chart.js wrapper) — stats donuts & bar charts |
| **PWA** | Angular Service Worker (`@angular/pwa`), app-shell prefetch, install-prompt banner |
| **Proxy** | nginx 1.25, `envsubst` for `$BACKEND_URL`, gzip + asset caching |
| **Hosting** | Railway (two services + PostgreSQL plugin), Cloudflare DNS |
| **Containers** | Multi-stage Dockerfiles, full repo as Docker build context |

---

## Monorepo Structure

```
waypoint/
├── backend/
│   ├── db/                       Auto-applied migrations, run once each (001 → 009)
│   │   ├── 001_init.sql          Core schema (16 tables: destinations, trips, stops, etc.)
│   │   ├── 002_ai_fields.sql     suggested_by_ai, google_place_id columns
│   │   ├── 004_settings.sql      app_settings table
│   │   ├── 005_special_interest_places.sql  Special-interest places, photos, trip links
│   │   ├── 006_schema_enhancements.sql
│   │   ├── 007_trip_origin.sql
│   │   ├── 008_normalize_states.sql
│   │   └── 009_site_info.sql
│   ├── src/
│   │   ├── index.ts              Express entry point, all routes registered
│   │   ├── db.ts                 pg Pool (max 10, Railway SSL auto-detected)
│   │   ├── migrate.ts            Auto-migration runner (_migrations table)
│   │   ├── types.ts              TypeScript interfaces for all DB tables
│   │   ├── lib/
│   │   │   ├── asyncHandler.ts   Wraps async routes, forwards errors to next()
│   │   │   ├── r2.ts             Cloudflare R2 upload/delete helpers
│   │   │   ├── googlePlaces.ts   Text Search + Place Details + photo URL, enrichBatch
│   │   │   └── weather.ts        Open-Meteo fetch with 1-hour in-memory cache
│   │   ├── middleware/
│   │   │   └── errorHandler.ts   Global Express error handler (registered last)
│   │   └── routes/
│   │       ├── destinations.ts   CRUD + status patch, jsonb_agg for photos & POIs
│   │       ├── restaurants.ts    CRUD, jsonb_agg for photos
│   │       ├── lodging.ts        CRUD, jsonb_agg for photos
│   │       ├── specialInterests.ts  CRUD for special-interest places + photos
│   │       ├── trips.ts          CRUD + status, single CTE query for full trip detail
│   │       ├── tripWizard.ts     AI trip generation (/generate, /confirm)
│   │       ├── stops.ts          Trip stop CRUD + status (mergeParams)
│   │       ├── expenses.ts       CRUD + /summary endpoint (totals by category)
│   │       ├── packing.ts        List + item CRUD + is_packed toggle
│   │       ├── journal.ts        Trip journal entry CRUD
│   │       ├── fuel.ts           Fuel stop CRUD
│   │       ├── weather.ts        Proxies lib/weather.ts
│   │       ├── geocode.ts        Address → lat/lon lookup
│   │       ├── search.ts         Cross-entity search (home search bar)
│   │       ├── settings.ts       App settings CRUD (site info, etc.)
│   │       ├── stats.ts          Aggregate stats endpoint (destinations/trips/expenses/fuel)
│   │       ├── uploads.ts        Multipart photo upload to R2 (5 MB limit)
│   │       └── claude.ts         AI endpoints with system-prompt caching
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/app/
│   │   ├── app.component.ts      Root shell wrapper
│   │   ├── app.config.ts         provideRouter, provideHttpClient, provideServiceWorker
│   │   ├── app.routes.ts         All lazy-loaded top-level routes
│   │   ├── types/
│   │   │   └── schema.types.ts   Mirrors backend/src/types.ts exactly
│   │   ├── core/
│   │   │   ├── layout/
│   │   │   │   └── shell.component.ts  Responsive shell — fixed sidebar (desktop) / bottom tabs + "More" sheet (mobile)
│   │   │   └── services/         theme, destination, restaurant, lodging, special-interest,
│   │   │                         trip, stop, expense, packing, journal, fuel, weather,
│   │   │                         maps, settings, stats services
│   │   ├── shared/
│   │   │   └── components/
│   │   │       ├── quick-add/    Bottom-sheet "Quick Add" forms — Destination, Restaurant,
│   │   │       │                 Lodging, Special Interest, Fuel Stop (places-search + photo + trip-attach)
│   │   │       ├── places-autocomplete/  Google Places search-and-autofill widget
│   │   │       ├── add-to-trip-sheet/    Attach an entity to a trip stop from anywhere
│   │   │       └── empty-state/  Reusable empty-list CTA (routerLink or click-emit)
│   │   └── features/
│   │       ├── home/             Dashboard — search bar, upcoming trip, highlights
│   │       ├── travels/          Combined travel history view
│   │       ├── trips/            Full CRUD, AI Trip Wizard, Companion view, stop/expense/
│   │       │                     packing/journal/fuel tabs
│   │       ├── destinations/     List, detail (weather + POIs + map), add/edit form, AI suggest
│   │       ├── restaurants/      List, detail (gallery + map + AI description), add/edit form
│   │       ├── lodging/          List, detail (amenities + gallery + map), add/edit form
│   │       ├── special-interests/  Wineries/museums/parks/etc. — list, detail, add/edit form
│   │       ├── lists/            Filtered cross-entity views (would-return, avoid-list)
│   │       ├── map/              Full-screen Google Map — pins, POIs, trip route polylines
│   │       ├── stats/            Charts — destinations, trips, spending, road stats
│   │       └── settings/         App settings, site info
│   ├── nginx/
│   │   ├── nginx.conf            Template — $BACKEND_URL envsubst, gzip, SPA fallback
│   │   └── docker-entrypoint.sh  envsubst '$BACKEND_URL' only (preserves nginx vars)
│   ├── angular.json
│   ├── ngsw-config.json
│   ├── proxy.conf.json           /api/* → http://localhost:3000
│   └── Dockerfile
├── docs/
│   ├── Plan.md                   Phase-by-phase build log and backlog
│   └── deploy.md                 Railway deployment guide
└── package.json                  Root scripts: install:all, dev:backend, dev:frontend, build
```

---

## Database Schema

20 tables managed by the auto-migration runner (`backend/db/001`–`009`):

| Table | Purpose |
|---|---|
| `destinations` | Places to visit (US/Canada), status, coords, rating |
| `destination_photos` | R2-hosted photos per destination |
| `points_of_interest` | Scenic overlooks, parks, historic sites per destination |
| `restaurants` | Restaurants with cuisine, price range, pet-friendly flag |
| `restaurant_photos` | R2-hosted photos per restaurant |
| `lodging` | Hotels, motels, Airbnbs, campgrounds |
| `lodging_photos` | R2-hosted photos per lodging |
| `special_interest_places` | Wineries, museums, parks, attractions, etc. |
| `special_interest_photos` | R2-hosted photos per special-interest place |
| `trip_special_interests` | Special-interest places attached to a trip/stop |
| `trips` | Named road trips with budget, origin, and status |
| `trip_stops` | Ordered stops within a trip — links destination + lodging, or a specific place (hotel/rental/residence/campsite) via `place_address`/`place_type`/`place_lat`/`place_lng` |
| `trip_restaurants` | Restaurants visited at a stop |
| `trip_expenses` | Categorized expenses per trip/stop |
| `packing_lists` | Named packing lists per trip |
| `packing_items` | Individual items with is_packed toggle |
| `trip_journal_entries` | Free-text journal entries per trip/stop |
| `fuel_stops` | Fuel log with price, gallons, odometer |
| `app_settings` | Key/value app settings (site info, etc.) |
| `_migrations` | Tracks applied SQL migration files |

---

## Feature Overview

The app has grown well past its original Phase 0/1 scope — it's now a full travel-planning companion. Highlights:

- **Destinations, Restaurants, Lodging, Special Interests** — full CRUD with photo galleries (R2), maps, ratings, filters/search, and an AI "suggest" flow for destinations
- **AI Trip Wizard** — describe a trip, Claude plans the route and Google Places enriches every stop (lodging, restaurants, POIs) into a reviewable preview before anything is saved
- **Trip Companion view** — two-panel layout with stop timeline + Google Maps route, plus tabs for Expenses (with charts), Packing Lists (AI-suggested), Journal, and Fuel Log. Stops can be a specific hotel, rental, or residence (not just a city) — the route and "Get Directions" links follow that exact address
- **Quick Add bottom sheets** — fast, places-search-powered add forms for every entity type, available from the global "+" nav button *and* every entity list page (unified mobile UX)
- **Google Maps integration** — full-screen map with status-coded pins, POI markers, trip route polylines, and mini-maps on detail pages
- **Stats dashboard** — ng2-charts donuts/bars for destinations, trips, spending, and road stats (miles, fuel cost, cost-per-mile)
- **PWA** — installable, offline-capable shell, service-worker caching, install-prompt banner
- **Mobile-first responsive shell** — fixed sidebar on desktop, bottom tab bar + "More" sheet + Quick Add sheets on mobile

For the full phase-by-phase build history and the current backlog, see **[`docs/Plan.md`](docs/Plan.md)**.

---

## Local Development Setup

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **PostgreSQL 16** — running locally or via Docker
- A copy of `backend/.env` (see step 2 below)

---

### Step 1 — Clone and install all dependencies

```bash
# From the repo root
npm run install:all
```

This runs `npm install` in the root, `backend/`, and `frontend/` simultaneously.

---

### Step 2 — Configure the backend environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```env
# Required — your local Postgres connection string
DATABASE_URL=postgresql://postgres:password@localhost:5432/waypoint

# Optional for local dev — only needed for AI/upload features
ANTHROPIC_API_KEY=sk-ant-...
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

PORT=3000
```

> **Tip:** If you don't have a local Postgres, spin one up with Docker:
> ```bash
> docker run -d --name waypoint-db \
>   -e POSTGRES_PASSWORD=password \
>   -e POSTGRES_DB=waypoint \
>   -p 5432:5432 postgres:16-alpine
> ```

---

### Step 3 — Create the database (first run only)

The migration runner creates all tables automatically on first start — you just need the database to exist:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE waypoint;"

# OR if using the Docker container above, the DB was already created by POSTGRES_DB
```

---

### Step 4 — Start the backend

```bash
# From the repo root
npm run dev:backend
```

This runs `tsx watch src/index.ts` inside `backend/`. On first start you will see:

```
Applying migration: 001_init.sql
Migration applied: 001_init.sql
Waypoint backend listening on port 3000
```

Verify it's healthy:

```bash
curl http://localhost:3000/health
# → {"status":"ok","ts":"..."}
```

---

### Step 5 — Start the frontend

Open a **second terminal** in the repo root:

```bash
npm run dev:frontend
```

This runs `ng serve` inside `frontend/` with `proxy.conf.json` forwarding `/api/*` to the backend on port 3000.

The app opens at **http://localhost:4200**

---

### Both servers at a glance

| Server | Command (from repo root) | URL |
|---|---|---|
| Backend (Express) | `npm run dev:backend` | http://localhost:3000 |
| Frontend (Angular) | `npm run dev:frontend` | http://localhost:4200 |

---

### Verifying the full stack

1. Open http://localhost:4200 — the Waypoint sidebar loads
2. Click **Destinations** — the list page loads (empty on first run)
3. Click **+** (FAB) — fill in name, city, state, country → **Add destination**
4. The new destination appears in the list with status badge and rating
5. Click the card → detail page shows (weather loads if lat/lon were entered)

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Backend port (default: 3000) |
| `ANTHROPIC_API_KEY` | For AI features | Claude API key |
| `R2_ACCOUNT_ID` | For uploads | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | For uploads | R2 access key |
| `R2_SECRET_ACCESS_KEY` | For uploads | R2 secret key |
| `R2_BUCKET` | For uploads | R2 bucket name |
| `R2_PUBLIC_URL` | For uploads | Public base URL (e.g. `https://pub-xxx.r2.dev`) |

### Frontend (set at Docker build time / Railway)

| Variable | Description |
|---|---|
| `BACKEND_URL` | Full backend URL for nginx proxy (e.g. `https://waypoint-api.railway.app`) |

---

## Production Build

```bash
# Build both services
npm run build

# Or build individually
npm run build --prefix backend    # → backend/dist/
npm run build --prefix frontend   # → frontend/dist/waypoint/browser/
```

Docker images are built with the **full repo as the build context** — always run `docker build` from the repo root:

```bash
# Backend
docker build -f backend/Dockerfile -t waypoint-backend .

# Frontend
docker build -f frontend/Dockerfile -t waypoint-frontend .
```
