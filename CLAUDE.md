# Waypoint — Production Travel Companion App

## What This App Is
A full-stack personal travel encyclopedia and trip planner.
Production app at: https://frontend-production-9322.up.railway.app

## Memory
This project uses Memory Vault (Postgres-backed, via MCP) for persistent memory instead of native Claude Code memory files. Always use the `memory-vault` MCP tools (`remember`, `recall`/search) to save and retrieve context across sessions — do not write to `.claude/projects/.../memory/*.md`.

## Tech Stack
- Frontend: Angular 17 standalone components, 
  Angular Material M3, @angular/google-maps
- Backend: Node.js 20, Express 4, TypeScript
- Database: PostgreSQL 16 via pg pool
- AI: Anthropic claude-sonnet-4-5
- Images: Cloudflare R2
- Maps: Google Maps JS API + Places API
- Hosting: Railway (two services + PostgreSQL plugin)

## Monorepo Structure
destination-tracker/
├── frontend/     Angular app
├── backend/      Express API
├── docs/         GitHub Pages wiki
└── CLAUDE.md     This file

## Key Architecture Rules
- All status columns: VARCHAR + CHECK, never Postgres enums
- Auto-migration runner with _migrations table
- asyncHandler on all routes, errorHandler last
- user_id DEFAULT 1 (single user, multi-user ready)
- All distances in miles, all times in hours/minutes
- No mock data, no demo mode — production only

## Current Data Model Key Tables
trips, trip_stops, destinations, restaurants, lodging,
special_interest_places, packing_lists, packing_items,
trip_expenses, trip_journal_entries, points_of_interest,
fuel_stops, app_settings

## Recent Major Changes Completed
- Trip stops support specific places (hotels, rentals, residences, campsites)
  via place_address/place_type/place_lat/place_lng (db/017_stop_address.sql)
- Trip Wizard Step 1 itinerary builder is now authoritative when >1 stop is
  given — backend builds the plan directly (Mode A) instead of Claude
  inventing the route (Mode B); Mode B unchanged for single-destination trips
- Google Directions API drive time/distance + fuel cost estimates
  (getDriveLeg/estimateFuelCost in backend/src/lib/googlePlaces.ts)
- Trip Companion map routes through each stop's specific address/coords
  (stopRouteLocation + MapsService.loadDirectionsFromLocations), with
  "Get Directions" buttons per stop and to the next stop
- State normalization (full names, no abbreviations)
- Miles/hours conversion throughout
- Production Angular build configured

## What Is Currently Being Built
Nothing in progress. The trip-stop specific-places feature above (db/017,
Mode A/B wizard split, Directions integration) completed 2026-06-13 — see
docs/Plan.md for details and the Backlog section for next candidates.

## Environment Variables Required
DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_PLACES_API_KEY,
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
R2_BUCKET, R2_PUBLIC_URL

Note: GOOGLE_PLACES_API_KEY must also have the Directions API enabled in the
Google Cloud project (used server-side by getDriveLeg for Mode A drive-time
estimates).
