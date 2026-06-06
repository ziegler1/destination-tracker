CREATE TABLE IF NOT EXISTS special_interest_places (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  city             TEXT NOT NULL,
  state_province   TEXT NOT NULL,
  country          TEXT NOT NULL DEFAULT 'USA',
  category         TEXT,   -- winery_brewery | museum | historic_site | state_park | national_park | live_music | scenic | roadside_attraction | shopping | other
  address          TEXT,
  latitude         NUMERIC(9,6),
  longitude        NUMERIC(9,6),
  website          TEXT,
  phone            TEXT,
  rating           NUMERIC(2,1),
  would_return     BOOLEAN,
  highlights       TEXT,
  notes            TEXT,
  image_url        TEXT,
  suggested_by_ai  BOOLEAN DEFAULT FALSE,
  google_place_id  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_special_interests (
  id                   SERIAL PRIMARY KEY,
  trip_id              INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_stop_id         INT REFERENCES trip_stops(id) ON DELETE SET NULL,
  special_interest_id  INT NOT NULL REFERENCES special_interest_places(id) ON DELETE CASCADE,
  visited_at           TIMESTAMPTZ,
  notes                TEXT,
  UNIQUE(trip_stop_id, special_interest_id)
);

CREATE TABLE IF NOT EXISTS special_interest_photos (
  id                   SERIAL PRIMARY KEY,
  special_interest_id  INT NOT NULL REFERENCES special_interest_places(id) ON DELETE CASCADE,
  r2_key               TEXT NOT NULL,
  url                  TEXT NOT NULL,
  caption              TEXT,
  is_primary           BOOLEAN DEFAULT FALSE,
  uploaded_at          TIMESTAMPTZ DEFAULT NOW()
);
