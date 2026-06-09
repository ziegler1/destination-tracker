-- Add site_info scraping support to special_interest_places (mirrors restaurants/lodging)
ALTER TABLE special_interest_places
  ADD COLUMN IF NOT EXISTS site_info JSONB,
  ADD COLUMN IF NOT EXISTS site_info_fetched_at TIMESTAMPTZ;
