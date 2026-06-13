# Waypoint — Production Travel Companion App

## What This App Is
A full-stack personal travel encyclopedia and trip planner.
Production app at: https://frontend-production-9322.up.railway.app

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
- Google Places photo pipeline fixed (resolvePhotoUrl)
- All wizard confirm INSERTs now save image_url
- State normalization (full names, no abbreviations)
- Back buttons via PageHeaderComponent
- Miles/hours conversion throughout
- Mobile bottom nav, FAB positioning fixed
- Production Angular build configured

## What Is Currently Being Built
Fixing trip stops to support specific place addresses
(hotels, beach houses, rentals) not just city names.
See backend/db/017_stop_address.sql migration.

## Environment Variables Required
DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_PLACES_API_KEY,
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
R2_BUCKET_NAME, R2_PUBLIC_URL
