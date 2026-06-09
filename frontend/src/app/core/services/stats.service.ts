import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface StatsRecords {
  longest_trip_name:        string | null;
  longest_trip_days:        number | null;
  longest_trip_id:          number | null;
  most_visited_state:       string | null;
  top_restaurant_id:        number | null;
  top_restaurant_name:      string | null;
  top_restaurant_city:      string | null;
  top_restaurant_rating:    number | null;
  top_lodging_id:           number | null;
  top_lodging_name:         string | null;
  top_lodging_city:         string | null;
  top_lodging_quality:      number | null;
  most_expensive_trip_id:   number | null;
  most_expensive_trip_name: string | null;
  most_expensive_trip_total:number | null;
}

export interface StatsResponse {
  destinations: {
    total: number;
    want_to_visit: number;
    planned: number;
    visited: number;
    visited_states_count: number;
    top_states: { state_province: string; count: number }[];
  };
  trips: {
    total: number;
    avg_duration_days: number;
    total_days: number;
    by_year: { year: number; count: number }[];
  };
  expenses: {
    total: number;
    lodging: number;
    food: number;
    fuel: number;
    activities: number;
    shopping: number;
    other: number;
  };
  fuel: {
    total_gallons: number;
    total_cost: number;
    total_miles: number;
  };
  records: StatsRecords;
  cuisine_breakdown: { cuisine_type: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);

  get() {
    return this.http.get<StatsResponse>('/api/stats');
  }
}
