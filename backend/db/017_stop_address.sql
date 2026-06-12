ALTER TABLE trip_stops
  ADD COLUMN place_name      TEXT,
  ADD COLUMN place_address   TEXT,
  ADD COLUMN place_type      VARCHAR(20) DEFAULT 'city'
                              CHECK (place_type IN ('city','hotel','rental','campsite','residence','other')),
  ADD COLUMN place_lat       NUMERIC(10,7),
  ADD COLUMN place_lng       NUMERIC(10,7),
  ADD COLUMN place_google_id TEXT,
  ADD COLUMN is_home_base    BOOLEAN DEFAULT FALSE;

ALTER TABLE trip_stops ALTER COLUMN destination_id DROP NOT NULL;
