-- Add origin address to trips for route display in Trip Companion
ALTER TABLE trips ADD COLUMN IF NOT EXISTS origin_address TEXT;
