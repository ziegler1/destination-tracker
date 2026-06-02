# Waypoint

A personal travel companion web app for US and Canada road travel. Track destinations, trips, lodging, restaurants, expenses, packing lists, and journal entries — all in one place.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 17 (standalone components, lazy-loaded routes, OnPush change detection) |
| **UI** | Angular Material 17 (M2 theme — teal #00695C primary, amber #FFB300 accent, dark/light toggle) |
| **Backend** | Node.js 20 / Express 4 / TypeScript — compiled with `tsc`, hot-reload with `tsx watch` |
| **Database** | PostgreSQL 16 — `pg` pool (max 10 connections), auto-migration runner |
| **AI** | Anthropic Claude (`claude-sonnet-4-5`) via `@anthropic-ai/sdk`, system-prompt caching |
| **File Storage** | Cloudflare R2 via `@aws-sdk/client-s3` (S3-compatible) |
| **Maps** | Leaflet.js + OpenStreetMap (no API key required) — Phase 1 |
| **Weather** | Open-Meteo API (free, no API key, fetch by lat/lon) |
| **Charts** | ng2-charts (Chart.js wrapper) — Phase 1 |
| **PWA** | Angular Service Worker (`@angular/pwa`), app-shell prefetch |
| **Proxy** | nginx 1.25, `envsubst` for `$BACKEND_URL`, gzip + asset caching |
| **Hosting** | Railway (two services + PostgreSQL plugin), Cloudflare DNS |
| **Containers** | Multi-stage Dockerfiles, full repo as Docker build context |

---

## Monorepo Structure

```
waypoint/
├── backend/
│   ├── db/
│   │   └── 001_init.sql          Full schema (16 tables)
│   ├── src/
│   │   ├── index.ts              Express entry point, all routes registered
│   │   ├── db.ts                 pg Pool (max 10, Railway SSL auto-detected)
│   │   ├── migrate.ts            Auto-migration runner (_migrations table)
│   │   ├── types.ts              TypeScript interfaces for all DB tables
│   │   ├── lib/
│   │   │   ├── asyncHandler.ts   Wraps async routes, forwards errors to next()
│   │   │   ├── r2.ts             Cloudflare R2 upload/delete helpers
│   │   │   └── weather.ts        Open-Meteo fetch with 1-hour in-memory cache
│   │   ├── middleware/
│   │   │   └── errorHandler.ts   Global Express error handler (registered last)
│   │   └── routes/
│   │       ├── destinations.ts   CRUD + status patch, jsonb_agg for photos & POIs
│   │       ├── restaurants.ts    CRUD, jsonb_agg for photos
│   │       ├── lodging.ts        CRUD, jsonb_agg for photos
│   │       ├── trips.ts          CRUD + status, single CTE query for full trip detail
│   │       ├── stops.ts          Trip stop CRUD + status (mergeParams)
│   │       ├── expenses.ts       CRUD + /summary endpoint (totals by category)
│   │       ├── packing.ts        List + item CRUD + is_packed toggle
│   │       ├── journal.ts        Trip journal entry CRUD
│   │       ├── fuel.ts           Fuel stop CRUD
│   │       ├── weather.ts        Proxies lib/weather.ts
│   │       ├── uploads.ts        Multipart photo upload to R2 (5 MB limit)
│   │       └── claude.ts         5 AI endpoints with system-prompt caching
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
│   │   │   │   └── shell.component.ts  Responsive sidebar (hamburger on mobile)
│   │   │   └── services/
│   │   │       ├── theme.service.ts    Dark/light toggle, 19 CSS custom properties
│   │   │       ├── destination.service.ts
│   │   │       └── weather.service.ts  WMO code → emoji, calls /api/weather
│   │   └── features/
│   │       ├── destinations/     List, detail (weather strip + POIs), add/edit form
│   │       ├── trips/            Stub — Phase 1
│   │       ├── restaurants/      Stub — Phase 1
│   │       ├── lodging/          Stub — Phase 1
│   │       ├── map/              Stub — Phase 1
│   │       └── stats/            Stub — Phase 1
│   ├── nginx/
│   │   ├── nginx.conf            Template — $BACKEND_URL envsubst, gzip, SPA fallback
│   │   └── docker-entrypoint.sh  envsubst '$BACKEND_URL' only (preserves nginx vars)
│   ├── angular.json
│   ├── ngsw-config.json
│   ├── proxy.conf.json           /api/* → http://localhost:3000
│   └── Dockerfile
├── docs/
└── package.json                  Root scripts: install:all, dev:backend, dev:frontend, build
```

---

## Database Schema

16 tables managed by the auto-migration runner:

| Table | Purpose |
|---|---|
| `destinations` | Places to visit (US/Canada), status, coords, rating |
| `destination_photos` | R2-hosted photos per destination |
| `points_of_interest` | Scenic overlooks, parks, historic sites per destination |
| `restaurants` | Restaurants with cuisine, price range, pet-friendly flag |
| `restaurant_photos` | R2-hosted photos per restaurant |
| `lodging` | Hotels, motels, Airbnbs, campgrounds |
| `lodging_photos` | R2-hosted photos per lodging |
| `trips` | Named road trips with budget and status |
| `trip_stops` | Ordered stops within a trip (links destination + lodging) |
| `trip_restaurants` | Restaurants visited at a stop |
| `trip_expenses` | Categorized expenses per trip/stop |
| `packing_lists` | Named packing lists per trip |
| `packing_items` | Individual items with is_packed toggle |
| `trip_journal_entries` | Free-text journal entries per trip/stop |
| `fuel_stops` | Fuel log with price, gallons, odometer |
| `_migrations` | Tracks applied SQL migration files |

---

## Completed Phases

### Phase 0 — Foundation (complete)

**Backend**
- Express app with all 12 route files registered
- Auto-migration system (runs `db/*.sql` once each, tracked in `_migrations`)
- Full database schema — 16 tables, all `VARCHAR + CHECK` constraints (no Postgres enums)
- `asyncHandler` wrapper on every route, `errorHandler` middleware last
- All list endpoints use a single SQL query with `jsonb_agg + DISTINCT + FILTER` — no N+1 queries
- Trip detail endpoint returns full trip in one CTE query (stops, expenses, packing, journal)
- 5 Claude AI endpoints with `cache_control: ephemeral` on system prompts
- R2 photo upload/delete (multer, 5 MB limit, MIME filter)
- Open-Meteo weather proxy with 1-hour in-memory cache
- Expense summary endpoint (totals by category)
- Packing list item toggle (`is_packed`)
- Multi-stage Dockerfile with full-repo build context

**Frontend**
- Angular 17 standalone components, `OnPush` change detection throughout
- Angular Material M2 theme — teal 800 primary, amber 600 accent, dark theme class
- ThemeService with signal-based toggle and 19 CSS custom properties
- Responsive sidebar shell (`MatSidenav`) — side mode on desktop, hamburger overlay on mobile
- All 6 nav routes lazy-loaded: Trips, Destinations, Restaurants, Lodging, Map, Stats
- PWA service worker — app-shell prefetch + API freshness cache
- **Destinations feature (fully working):**
  - List page — status filter chips, state/province dropdown, search bar, card grid
  - Detail page — hero photo, 7-day weather strip (Open-Meteo), best-months pills, POI list, photo gallery
  - Add/Edit form — all fields, month chip autocomplete, date picker, star-click rating
- Multi-stage Dockerfile (node:20 build → nginx:1.25 serve)

### Phase 1 — Remaining Features (planned)

- Trips: full CRUD, stop management, expense tracker, packing checklist, journal
- Restaurants: CRUD with map pin, photo gallery, AI description
- Lodging: CRUD with amenity chips, photo gallery
- Map view: Leaflet with destination/stop pins, route polyline
- Stats: ng2-charts — destinations by status, spending by category, miles driven

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
