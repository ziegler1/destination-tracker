CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('home_name',              'Home'),
  ('home_address',           '8404 Union Drive, Galloway, Ohio 43119'),
  ('home_lat',               '39.9554'),
  ('home_lng',               '-83.2174'),
  ('home_place_id',          ''),
  ('drive_hours_per_day',    '6'),
  ('preferred_lodging_type', 'hotel'),
  ('stop_interval_miles',    '200'),
  ('favorite_cuisines',      '[]'),
  ('travel_interests',       '[]')
ON CONFLICT (key) DO NOTHING;
