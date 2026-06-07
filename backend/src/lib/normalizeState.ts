// Maps US state and Canadian province/territory abbreviations (and a few common
// alternate spellings) to their canonical full names, case-insensitively.
const STATE_LOOKUP: Record<string, string> = {
  // US states
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',

  // Canadian provinces and territories
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',

  // Common alternate spellings / typos seen in stored data
  'NORTH W': 'North Carolina',
};

// Full names keyed by their lower-cased form, so "kentucky" / "KENTUCKY" /
// "north carolina" all resolve to the canonical capitalization.
const FULL_NAME_LOOKUP: Record<string, string> = {};
for (const fullName of Object.values(STATE_LOOKUP)) {
  FULL_NAME_LOOKUP[fullName.toLowerCase()] = fullName;
}

function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function normalizeState(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  if (!trimmed) return input;

  const upper = trimmed.toUpperCase();
  if (STATE_LOOKUP[upper]) return STATE_LOOKUP[upper];

  const lower = trimmed.toLowerCase();
  if (FULL_NAME_LOOKUP[lower]) return FULL_NAME_LOOKUP[lower];

  return titleCase(trimmed);
}
