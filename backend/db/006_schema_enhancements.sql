-- Schema enhancements: rich URLs, travel tips, drive leg columns, visit tracking

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS menu_url      TEXT,
  ADD COLUMN IF NOT EXISTS visit_count   INTEGER NOT NULL DEFAULT 0;

ALTER TABLE lodging
  ADD COLUMN IF NOT EXISTS booking_url   TEXT,
  ADD COLUMN IF NOT EXISTS visit_count   INTEGER NOT NULL DEFAULT 0;

ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS travel_tips   TEXT,
  ADD COLUMN IF NOT EXISTS visit_count   INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS drive_minutes_from_prev  INTEGER,
  ADD COLUMN IF NOT EXISTS gas_stop_before           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_fuel_cost       NUMERIC(8,2);
