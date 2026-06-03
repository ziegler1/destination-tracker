import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface StatsResponse {
  destinations: {
    total: number;
    want_to_visit: number;
    planned: number;
    visited: number;
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
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);

  get() {
    return this.http.get<StatsResponse>('/api/stats');
  }
}
