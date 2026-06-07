-- Persist scraped "Fetch Info" website data so it survives refresh and can be re-fetched
ALTER TABLE lodging ADD COLUMN IF NOT EXISTS site_info JSONB;
ALTER TABLE lodging ADD COLUMN IF NOT EXISTS site_info_fetched_at TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS site_info JSONB;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS site_info_fetched_at TIMESTAMPTZ;
