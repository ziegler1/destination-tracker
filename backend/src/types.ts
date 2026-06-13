// ─── Destinations ────────────────────────────────────────────────────────────

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

// ─── Restaurants ─────────────────────────────────────────────────────────────

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

// ─── Lodging ─────────────────────────────────────────────────────────────────

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

// ─── Trips ───────────────────────────────────────────────────────────────────

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
  created_at: string;
  updated_at: string;
  stops?: TripStop[];
}

export type TripStopStatus = 'upcoming' | 'current' | 'completed';

export type TripStopPlaceType = 'city' | 'hotel' | 'rental' | 'campsite' | 'residence' | 'other';

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
  display_name?:    string;
  place_name?:      string | null;
  place_address?:   string | null;
  place_type?:      TripStopPlaceType;
  place_lat?:       number | null;
  place_lng?:       number | null;
  place_google_id?: string | null;
  is_home_base?:    boolean;
  destination?: Destination;
  lodging?: Lodging;
  restaurants?: TripRestaurant[];
  special_interests?: TripSpecialInterest[];
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

export interface SpecialInterestPlace {
  id: number;
  name: string;
  city: string;
  state_province: string;
  category?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  rating?: number;
  image_url?: string;
  highlights?: string;
}

export interface TripSpecialInterest {
  id: number;
  trip_id: number;
  trip_stop_id?: number;
  special_interest_id?: number;
  special_interest?: SpecialInterestPlace;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

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

// ─── Packing ─────────────────────────────────────────────────────────────────

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

// ─── Journal ─────────────────────────────────────────────────────────────────

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

// ─── Points of Interest ───────────────────────────────────────────────────────

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

// ─── Fuel Stops ──────────────────────────────────────────────────────────────

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

// ─── Weather ─────────────────────────────────────────────────────────────────

export interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  time: string;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}
