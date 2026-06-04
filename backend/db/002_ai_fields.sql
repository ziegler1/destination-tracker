-- Add AI suggestion tracking and Google Places enrichment fields
-- to lodging, restaurants, and points_of_interest tables.

ALTER TABLE lodging
  ADD COLUMN IF NOT EXISTS suggested_by_ai  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_place_id  TEXT;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS suggested_by_ai  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_place_id  TEXT;

ALTER TABLE points_of_interest
  ADD COLUMN IF NOT EXISTS suggested_by_ai  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_place_id  TEXT;
