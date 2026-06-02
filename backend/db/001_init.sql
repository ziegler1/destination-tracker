CREATE TABLE destinations (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  city            TEXT NOT NULL,
  state_province  TEXT NOT NULL,
  country         VARCHAR(20) NOT NULL CHECK (country IN ('USA', 'Canada')),
  region          TEXT,
  description     TEXT,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  status          VARCHAR(20) NOT NULL DEFAULT 'want_to_visit'
                  CHECK (status IN ('want_to_visit', 'planned', 'visited')),
  best_months     TEXT[],
  visited_at      DATE,
  rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
  notes           TEXT,
  image_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE destination_photos (
  id              SERIAL PRIMARY KEY,
  destination_id  INTEGER REFERENCES destinations(id) ON DELETE CASCADE,
  r2_key          TEXT NOT NULL,
  url             TEXT NOT NULL,
  caption         TEXT,
  is_primary      BOOLEAN DEFAULT false,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE restaurants (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  city            TEXT NOT NULL,
  state_province  TEXT NOT NULL,
  country         VARCHAR(20) NOT NULL CHECK (country IN ('USA', 'Canada')),
  address         TEXT,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  cuisine_type    TEXT,
  price_range     VARCHAR(4) CHECK (price_range IN ('$', '$$', '$$$', '$$$$')),
  rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
  would_return    BOOLEAN,
  highlights      TEXT,
  notes           TEXT,
  website         TEXT,
  phone           TEXT,
  pet_friendly    BOOLEAN DEFAULT false,
  image_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE restaurant_photos (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
  r2_key          TEXT NOT NULL,
  url             TEXT NOT NULL,
  caption         TEXT,
  is_primary      BOOLEAN DEFAULT false,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lodging (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  city            TEXT NOT NULL,
  state_province  TEXT NOT NULL,
  country         VARCHAR(20) NOT NULL CHECK (country IN ('USA', 'Canada')),
  address         TEXT,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  lodging_type    VARCHAR(20) NOT NULL DEFAULT 'hotel'
                  CHECK (lodging_type IN ('hotel','motel','airbnb','resort','campground','other')),
  price_per_night NUMERIC(8,2),
  room_quality    SMALLINT CHECK (room_quality BETWEEN 1 AND 5),
  cleanliness     SMALLINT CHECK (cleanliness BETWEEN 1 AND 5),
  amenities       TEXT[],
  would_return    BOOLEAN,
  highlights      TEXT,
  notes           TEXT,
  website         TEXT,
  phone           TEXT,
  pet_friendly    BOOLEAN DEFAULT false,
  image_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lodging_photos (
  id              SERIAL PRIMARY KEY,
  lodging_id      INTEGER REFERENCES lodging(id) ON DELETE CASCADE,
  r2_key          TEXT NOT NULL,
  url             TEXT NOT NULL,
  caption         TEXT,
  is_primary      BOOLEAN DEFAULT false,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trips (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL DEFAULT 1,
  name            TEXT NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'planning'
                  CHECK (status IN ('planning','active','completed','cancelled')),
  start_date      DATE,
  end_date        DATE,
  total_budget    NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trip_stops (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  destination_id  INTEGER REFERENCES destinations(id),
  stop_order      INTEGER NOT NULL,
  arrival_date    DATE,
  departure_date  DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming','current','completed')),
  lodging_id      INTEGER REFERENCES lodging(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trip_restaurants (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  trip_stop_id    INTEGER REFERENCES trip_stops(id) ON DELETE CASCADE,
  restaurant_id   INTEGER REFERENCES restaurants(id),
  visited_at      DATE,
  notes           TEXT
);

CREATE TABLE trip_expenses (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  trip_stop_id    INTEGER REFERENCES trip_stops(id) ON DELETE SET NULL,
  category        VARCHAR(20) NOT NULL
                  CHECK (category IN ('lodging','food','fuel','activities','shopping','other')),
  description     TEXT NOT NULL,
  amount          NUMERIC(8,2) NOT NULL,
  expense_date    DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE packing_lists (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Packing List',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE packing_items (
  id              SERIAL PRIMARY KEY,
  list_id         INTEGER REFERENCES packing_lists(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'General',
  item_name       TEXT NOT NULL,
  quantity        INTEGER DEFAULT 1,
  is_packed       BOOLEAN DEFAULT false,
  notes           TEXT
);

CREATE TABLE trip_journal_entries (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  trip_stop_id    INTEGER REFERENCES trip_stops(id) ON DELETE SET NULL,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  title           TEXT,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE points_of_interest (
  id              SERIAL PRIMARY KEY,
  destination_id  INTEGER REFERENCES destinations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  poi_type        VARCHAR(30)
                  CHECK (poi_type IN ('scenic_overlook','roadside_attraction',
                         'state_park','national_park','historic_site','other')),
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  description     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fuel_stops (
  id                SERIAL PRIMARY KEY,
  trip_id           INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  trip_stop_id      INTEGER REFERENCES trip_stops(id) ON DELETE SET NULL,
  station_name      TEXT,
  city              TEXT,
  state_province    TEXT,
  price_per_gallon  NUMERIC(5,3),
  gallons           NUMERIC(6,3),
  odometer          INTEGER,
  logged_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS _migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ DEFAULT NOW()
);
