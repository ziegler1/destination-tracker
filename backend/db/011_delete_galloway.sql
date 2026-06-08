-- Remove home address destination if it was accidentally added
DELETE FROM destinations
WHERE LOWER(TRIM(city)) = 'galloway'
  AND LOWER(TRIM(state_province)) IN ('ohio', 'oh');
