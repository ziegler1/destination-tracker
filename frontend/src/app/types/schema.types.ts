// Mirrors backend/src/types.ts exactly

export type DestinationStatus = 'want_to_visit' | 'planned' | 'visited';
export type Country = 'USA' | 'Canada';

export interface Destination {
  id: number;
  name: string;
  city: string;
  state_province: string;
  country: Country;
  region?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  status: DestinationStatus;
  best_months?: string[];
  visited_at?: string;
  rating?: number;
  notes?: string;
  image_url?: string;
  travel_tips?: string;
  visit_count?: number;
  created_at: string;
  updated_at: string;
  photos?: DestinationPhoto[];
  pois?: PointOfInterest[];
}

export interface DestinationPhoto {
  id: number;
  destination_id: number;
  r2_key: string;
  url: string;
  caption?: string;
  is_primary: boolean;
  uploaded_at: string;
}

export type PriceRange = '$' | '$$' | '$$$' | '$$$$';

export interface Restaurant {
  id: number;
  name: string;
  city: string;
  state_province: string;
  country: Country;
  address?: string;
  latitude?: number;
  longitude?: number;
  cuisine_type?: string;
  price_range?: PriceRange;
  rating?: number;
  would_return?: boolean;
  highlights?: string;
  notes?: string;
  website?: string;
  phone?: string;
  pet_friendly: boolean;
  image_url?: string;
  menu_url?: string;
  visit_count?: number;
  suggested_by_ai?: boolean;
  google_place_id?: string;
  created_at: string;
  updated_at: string;
  photos?: RestaurantPhoto[];
}

export interface RestaurantPhoto {
  id: number;
  restaurant_id: number;
  r2_key: string;
  url: string;
  caption?: string;
  is_primary: boolean;
  uploaded_at: string;
}

export type LodgingType = 'hotel' | 'motel' | 'airbnb' | 'resort' | 'campground' | 'other';

export interface Lodging {
  id: number;
  name: string;
  city: string;
  state_province: string;
  country: Country;
  address?: string;
  latitude?: number;
  longitude?: number;
  lodging_type: LodgingType;
  price_per_night?: number;
  room_quality?: number;
  cleanliness?: number;
  amenities?: string[];
  would_return?: boolean;
  highlights?: string;
  notes?: string;
  website?: string;
  phone?: string;
  pet_friendly: boolean;
  image_url?: string;
  booking_url?: string;
  visit_count?: number;
  suggested_by_ai?: boolean;
  google_place_id?: string;
  created_at: string;
  updated_at: string;
  photos?: LodgingPhoto[];
}

export interface LodgingPhoto {
  id: number;
  lodging_id: number;
  r2_key: string;
  url: string;
  caption?: string;
  is_primary: boolean;
  uploaded_at: string;
}

export type TripStatus = 'planning' | 'active' | 'completed' | 'cancelled';

export interface Trip {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  status: TripStatus;
  start_date?: string;
  end_date?: string;
  total_budget?: number;
  notes?: string;
  origin_address?: string;
  created_at: string;
  updated_at: string;
  stops?: TripStop[];
  expenses?: TripExpense[];
  packing_lists?: PackingList[];
  journal_entries?: TripJournalEntry[];
  stop_count?: number;
}

export type TripStopStatus = 'upcoming' | 'current' | 'completed';

export interface TripStop {
  id: number;
  trip_id: number;
  destination_id?: number;
  stop_order: number;
  arrival_date?: string;
  departure_date?: string;
  status: TripStopStatus;
  lodging_id?: number;
  notes?: string;
  drive_minutes_from_prev?: number;
  gas_stop_before?: boolean;
  estimated_fuel_cost?: number;
  created_at: string;
  destination?: Destination;
  lodging?: Lodging;
  restaurants?: TripRestaurant[];
}

export interface TripRestaurant {
  id: number;
  trip_id: number;
  trip_stop_id?: number;
  restaurant_id?: number;
  visited_at?: string;
  notes?: string;
  restaurant?: Restaurant;
}

export type ExpenseCategory = 'lodging' | 'food' | 'fuel' | 'activities' | 'shopping' | 'other';

export interface TripExpense {
  id: number;
  trip_id: number;
  trip_stop_id?: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date?: string;
  created_at: string;
}

export interface PackingList {
  id: number;
  trip_id: number;
  name: string;
  created_at: string;
  items?: PackingItem[];
}

export interface PackingItem {
  id: number;
  list_id: number;
  category: string;
  item_name: string;
  quantity: number;
  is_packed: boolean;
  notes?: string;
}

export interface TripJournalEntry {
  id: number;
  trip_id: number;
  trip_stop_id?: number;
  entry_date: string;
  title?: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export type PoiType =
  | 'scenic_overlook'
  | 'roadside_attraction'
  | 'state_park'
  | 'national_park'
  | 'historic_site'
  | 'other';

export interface PointOfInterest {
  id: number;
  destination_id: number;
  name: string;
  poi_type?: PoiType;
  latitude?: number;
  longitude?: number;
  description?: string;
  notes?: string;
  suggested_by_ai?: boolean;
  google_place_id?: string;
  created_at: string;
}

export interface FuelStop {
  id: number;
  trip_id: number;
  trip_stop_id?: number;
  station_name?: string;
  city?: string;
  state_province?: string;
  price_per_gallon?: number;
  gallons?: number;
  odometer?: number;
  logged_at: string;
}

export interface WeatherCurrent {
  temperature: number;
  windspeed: number;
  weathercode: number;
  time: string;
}

export interface WeatherResponse {
  current_weather: WeatherCurrent;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
    precipitation_sum: number[];
  };
}

// ─── Special Interest Places ──────────────────────────────────────────────────

export type SpecialInterestCategory =
  | 'winery_brewery' | 'museum' | 'historic_site' | 'state_park'
  | 'national_park' | 'live_music' | 'scenic' | 'roadside_attraction'
  | 'shopping' | 'other';

export interface SpecialInterestPhoto {
  id: number;
  special_interest_id: number;
  r2_key: string;
  url: string;
  caption?: string;
  is_primary: boolean;
  uploaded_at: string;
}

export interface SpecialInterestPlace {
  id: number;
  name: string;
  city: string;
  state_province: string;
  country: string;
  category?: SpecialInterestCategory;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  phone?: string;
  rating?: number;
  would_return?: boolean;
  highlights?: string;
  notes?: string;
  image_url?: string;
  suggested_by_ai?: boolean;
  google_place_id?: string;
  created_at: string;
  updated_at: string;
  photos?: SpecialInterestPhoto[];
}

// ─── Trip Wizard ──────────────────────────────────────────────────────────────

export interface WizardPlaceSuggestion {
  google_verified: boolean;
  place_id:           string | null;
  formatted_address:  string | null;
  google_rating:      number | null;
  photo_url:          string | null;
  website:            string | null;
  approved?:          boolean;
}

export interface WizardLodgingSuggestion extends WizardPlaceSuggestion {
  name:                      string;
  area:                      string;
  lodging_type:              string;
  estimated_price_per_night: number;
  why_recommended:           string;
}

export interface WizardRestaurantSuggestion extends WizardPlaceSuggestion {
  name:            string;
  cuisine_type:    string;
  price_range:     string;
  why_recommended: string;
}

export interface WizardPoiSuggestion {
  name:             string;
  poi_type:         string;
  why_recommended:  string;
  google_verified:  boolean;
  place_id:         string | null;
  formatted_address:string | null;
  photo_url:        string | null;
  approved?:        boolean;
}

export type WizardStopType = 'transit' | 'base' | 'return_transit';

export interface WizardStop {
  stop_order:              number;
  stop_type?:              WizardStopType;
  city:                    string;
  state_province:          string;
  country:                 string;
  arrive_date:             string;
  depart_date:             string;
  drive_minutes_from_prev: number;
  gas_stop_before:         boolean;
  estimated_fuel_cost:     number;
  lodging_suggestions:     WizardLodgingSuggestion[];
  restaurant_suggestions:  WizardRestaurantSuggestion[];
  poi_suggestions:         WizardPoiSuggestion[];
}

export interface WizardTripMeta {
  name:       string;
  origin:     string;
  destination:string;
  start_date: string;
  end_date:   string;
  budget:     number;
  estimated_costs: {
    lodging:    number;
    food:       number;
    fuel:       number;
    activities: number;
    total:      number;
  };
  travel_notes:        string;
  packing_suggestions: Array<{ category: string; items: string[] }>;
}

export interface WizardPlan {
  trip:  WizardTripMeta;
  stops: WizardStop[];
}

export type TripType = 'round_trip' | 'one_way' | 'based_at_destination';

export interface WizardGenerateRequest {
  origin:             string;
  destination:        string;
  start_date:         string;
  end_date:           string;
  budget:             number;
  trip_type?:         TripType;
  drive_hours_per_day?: number;
  stop_timing?:       string;
  base_nights?:       number;
  include_return?:    boolean;
  preferences: {
    lodging_type?:        string;
    cuisine_preferences?: string[];
    pet_friendly?:        boolean;
    interests?:           string[];
    min_rating?:          number;
  };
}
