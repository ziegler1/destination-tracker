import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Restaurant, Trip } from '../../types/schema.types';

interface ClaudeResult { result: string; }

export interface ScrapedSiteInfo {
  description?: string | null;
  hours?:       string | null;
  phone?:       string | null;
  address?:     string | null;
  highlights?:  { name: string; detail?: string }[];
}

@Injectable({ providedIn: 'root' })
export class ClaudeService {
  private http = inject(HttpClient);

  suggestDestination(preferences: string, visitedDestinations: string[] = []) {
    return this.http.post<ClaudeResult>('/api/claude/suggest-destination', {
      preferences, visitedDestinations,
    });
  }

  bestTimeToVisit(destination: string, location: string) {
    return this.http.post<ClaudeResult>('/api/claude/best-time-to-visit', {
      destination, location,
    });
  }

  packingSuggestions(tripName: string, destinations: string[], duration: number, activities: string[]) {
    return this.http.post<ClaudeResult>('/api/claude/packing-suggestions', {
      tripName, destinations, duration, activities,
    });
  }

  tripSummary(trip: Trip) {
    return this.http.post<ClaudeResult>('/api/claude/trip-summary', { trip });
  }

  restaurantDescription(restaurant: Restaurant) {
    return this.http.post<ClaudeResult>('/api/claude/restaurant-description', { restaurant });
  }

  travelInsights(payload: { stats: unknown; records: unknown; cuisineBreakdown: unknown }) {
    return this.http.post<ClaudeResult>('/api/claude/travel-insights', payload);
  }

  scrapeWebsite(url: string, name: string, entityType: 'restaurant' | 'lodging') {
    return this.http.post<ClaudeResult>('/api/claude/scrape-website', { url, name, entityType });
  }
}
