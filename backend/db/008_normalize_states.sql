-- Normalize state_province values across all location tables to canonical
-- full names (e.g. 'KY' / 'kentucky' / 'KENTUCKY' -> 'Kentucky'), mirroring
-- the lookup in backend/src/lib/normalizeState.ts so future inserts/updates
-- stay consistent with this one-time cleanup of existing rows.
--
-- To inspect bad data before/after running this, use:
--   SELECT DISTINCT state_province FROM destinations ORDER BY 1;
--   SELECT DISTINCT state_province FROM restaurants  ORDER BY 1;
--   SELECT DISTINCT state_province FROM lodging      ORDER BY 1;
--   SELECT DISTINCT state_province FROM special_interest_places ORDER BY 1;
--
-- Known bad values fixed by this migration (at minimum):
--   'KY','ky','kentucky'  -> 'Kentucky'
--   'WV','wv'             -> 'West Virginia'
--   'NC','nc'             -> 'North Carolina'
--   'North w'             -> 'North Carolina'
--   'OH','oh'             -> 'Ohio'
--   'TN','tn'             -> 'Tennessee'

CREATE TEMP TABLE _state_map (lookup_key TEXT PRIMARY KEY, full_name TEXT NOT NULL);
INSERT INTO _state_map (lookup_key, full_name) VALUES
  ('AL', 'Alabama'),
  ('ALABAMA', 'Alabama'),
  ('AK', 'Alaska'),
  ('ALASKA', 'Alaska'),
  ('AZ', 'Arizona'),
  ('ARIZONA', 'Arizona'),
  ('AR', 'Arkansas'),
  ('ARKANSAS', 'Arkansas'),
  ('CA', 'California'),
  ('CALIFORNIA', 'California'),
  ('CO', 'Colorado'),
  ('COLORADO', 'Colorado'),
  ('CT', 'Connecticut'),
  ('CONNECTICUT', 'Connecticut'),
  ('DE', 'Delaware'),
  ('DELAWARE', 'Delaware'),
  ('FL', 'Florida'),
  ('FLORIDA', 'Florida'),
  ('GA', 'Georgia'),
  ('GEORGIA', 'Georgia'),
  ('HI', 'Hawaii'),
  ('HAWAII', 'Hawaii'),
  ('ID', 'Idaho'),
  ('IDAHO', 'Idaho'),
  ('IL', 'Illinois'),
  ('ILLINOIS', 'Illinois'),
  ('IN', 'Indiana'),
  ('INDIANA', 'Indiana'),
  ('IA', 'Iowa'),
  ('IOWA', 'Iowa'),
  ('KS', 'Kansas'),
  ('KANSAS', 'Kansas'),
  ('KY', 'Kentucky'),
  ('KENTUCKY', 'Kentucky'),
  ('LA', 'Louisiana'),
  ('LOUISIANA', 'Louisiana'),
  ('ME', 'Maine'),
  ('MAINE', 'Maine'),
  ('MD', 'Maryland'),
  ('MARYLAND', 'Maryland'),
  ('MA', 'Massachusetts'),
  ('MASSACHUSETTS', 'Massachusetts'),
  ('MI', 'Michigan'),
  ('MICHIGAN', 'Michigan'),
  ('MN', 'Minnesota'),
  ('MINNESOTA', 'Minnesota'),
  ('MS', 'Mississippi'),
  ('MISSISSIPPI', 'Mississippi'),
  ('MO', 'Missouri'),
  ('MISSOURI', 'Missouri'),
  ('MT', 'Montana'),
  ('MONTANA', 'Montana'),
  ('NE', 'Nebraska'),
  ('NEBRASKA', 'Nebraska'),
  ('NV', 'Nevada'),
  ('NEVADA', 'Nevada'),
  ('NH', 'New Hampshire'),
  ('NEW HAMPSHIRE', 'New Hampshire'),
  ('NJ', 'New Jersey'),
  ('NEW JERSEY', 'New Jersey'),
  ('NM', 'New Mexico'),
  ('NEW MEXICO', 'New Mexico'),
  ('NY', 'New York'),
  ('NEW YORK', 'New York'),
  ('NC', 'North Carolina'),
  ('NORTH CAROLINA', 'North Carolina'),
  ('ND', 'North Dakota'),
  ('NORTH DAKOTA', 'North Dakota'),
  ('OH', 'Ohio'),
  ('OHIO', 'Ohio'),
  ('OK', 'Oklahoma'),
  ('OKLAHOMA', 'Oklahoma'),
  ('OR', 'Oregon'),
  ('OREGON', 'Oregon'),
  ('PA', 'Pennsylvania'),
  ('PENNSYLVANIA', 'Pennsylvania'),
  ('RI', 'Rhode Island'),
  ('RHODE ISLAND', 'Rhode Island'),
  ('SC', 'South Carolina'),
  ('SOUTH CAROLINA', 'South Carolina'),
  ('SD', 'South Dakota'),
  ('SOUTH DAKOTA', 'South Dakota'),
  ('TN', 'Tennessee'),
  ('TENNESSEE', 'Tennessee'),
  ('TX', 'Texas'),
  ('TEXAS', 'Texas'),
  ('UT', 'Utah'),
  ('UTAH', 'Utah'),
  ('VT', 'Vermont'),
  ('VERMONT', 'Vermont'),
  ('VA', 'Virginia'),
  ('VIRGINIA', 'Virginia'),
  ('WA', 'Washington'),
  ('WASHINGTON', 'Washington'),
  ('WV', 'West Virginia'),
  ('WEST VIRGINIA', 'West Virginia'),
  ('WI', 'Wisconsin'),
  ('WISCONSIN', 'Wisconsin'),
  ('WY', 'Wyoming'),
  ('WYOMING', 'Wyoming'),
  ('DC', 'District of Columbia'),
  ('DISTRICT OF COLUMBIA', 'District of Columbia'),
  ('AB', 'Alberta'),
  ('ALBERTA', 'Alberta'),
  ('BC', 'British Columbia'),
  ('BRITISH COLUMBIA', 'British Columbia'),
  ('MB', 'Manitoba'),
  ('MANITOBA', 'Manitoba'),
  ('NB', 'New Brunswick'),
  ('NEW BRUNSWICK', 'New Brunswick'),
  ('NL', 'Newfoundland and Labrador'),
  ('NEWFOUNDLAND AND LABRADOR', 'Newfoundland and Labrador'),
  ('NS', 'Nova Scotia'),
  ('NOVA SCOTIA', 'Nova Scotia'),
  ('NT', 'Northwest Territories'),
  ('NORTHWEST TERRITORIES', 'Northwest Territories'),
  ('NU', 'Nunavut'),
  ('NUNAVUT', 'Nunavut'),
  ('ON', 'Ontario'),
  ('ONTARIO', 'Ontario'),
  ('PE', 'Prince Edward Island'),
  ('PRINCE EDWARD ISLAND', 'Prince Edward Island'),
  ('QC', 'Quebec'),
  ('QUEBEC', 'Quebec'),
  ('SK', 'Saskatchewan'),
  ('SASKATCHEWAN', 'Saskatchewan'),
  ('YT', 'Yukon'),
  ('YUKON', 'Yukon'),
  ('NORTH W', 'North Carolina');

-- Pass 1: known abbreviations / full-name spellings / typos -> canonical full name
UPDATE destinations d SET state_province = m.full_name
  FROM _state_map m
  WHERE UPPER(TRIM(d.state_province)) = m.lookup_key
    AND d.state_province IS DISTINCT FROM m.full_name;

UPDATE restaurants r SET state_province = m.full_name
  FROM _state_map m
  WHERE UPPER(TRIM(r.state_province)) = m.lookup_key
    AND r.state_province IS DISTINCT FROM m.full_name;

UPDATE lodging l SET state_province = m.full_name
  FROM _state_map m
  WHERE UPPER(TRIM(l.state_province)) = m.lookup_key
    AND l.state_province IS DISTINCT FROM m.full_name;

UPDATE special_interest_places s SET state_province = m.full_name
  FROM _state_map m
  WHERE UPPER(TRIM(s.state_province)) = m.lookup_key
    AND s.state_province IS DISTINCT FROM m.full_name;

-- Pass 2: anything left over (not a known abbreviation/name/typo) gets title-cased,
-- matching normalizeState()'s fallback behavior.
UPDATE destinations
  SET state_province = INITCAP(TRIM(state_province))
  WHERE state_province IS NOT NULL AND TRIM(state_province) <> ''
    AND UPPER(TRIM(state_province)) NOT IN (SELECT lookup_key FROM _state_map)
    AND state_province IS DISTINCT FROM INITCAP(TRIM(state_province));

UPDATE restaurants
  SET state_province = INITCAP(TRIM(state_province))
  WHERE state_province IS NOT NULL AND TRIM(state_province) <> ''
    AND UPPER(TRIM(state_province)) NOT IN (SELECT lookup_key FROM _state_map)
    AND state_province IS DISTINCT FROM INITCAP(TRIM(state_province));

UPDATE lodging
  SET state_province = INITCAP(TRIM(state_province))
  WHERE state_province IS NOT NULL AND TRIM(state_province) <> ''
    AND UPPER(TRIM(state_province)) NOT IN (SELECT lookup_key FROM _state_map)
    AND state_province IS DISTINCT FROM INITCAP(TRIM(state_province));

UPDATE special_interest_places
  SET state_province = INITCAP(TRIM(state_province))
  WHERE state_province IS NOT NULL AND TRIM(state_province) <> ''
    AND UPPER(TRIM(state_province)) NOT IN (SELECT lookup_key FROM _state_map)
    AND state_province IS DISTINCT FROM INITCAP(TRIM(state_province));

DROP TABLE _state_map;
