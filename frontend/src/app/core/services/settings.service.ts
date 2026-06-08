import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export interface AppSettings {
  home_name:              string;
  home_address:           string;
  home_lat:               string;
  home_lng:               string;
  home_place_id:          string;
  drive_hours_per_day:    string;
  preferred_lodging_type: string;
  stop_interval_miles:    string;
  favorite_cuisines:      string;
  travel_interests:       string;
  [key: string]: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  home_name:              'Home',
  home_address:           '8404 Union Drive, Galloway, Ohio 43119',
  home_lat:               '39.9554',
  home_lng:               '-83.2174',
  home_place_id:          '',
  drive_hours_per_day:    '6',
  preferred_lodging_type: 'hotel',
  stop_interval_miles:    '200',
  favorite_cuisines:      '[]',
  travel_interests:       '[]',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);

  settings = signal<AppSettings>({ ...DEFAULT_SETTINGS });

  load() {
    return this.http.get<AppSettings>('/api/settings').pipe(
      tap(s => this.settings.set({ ...DEFAULT_SETTINGS, ...s })),
    );
  }

  update(patch: Partial<AppSettings>) {
    return this.http.put<AppSettings>('/api/settings', patch).pipe(
      tap(s => this.settings.set({ ...DEFAULT_SETTINGS, ...s })),
    );
  }

  backfillPhotos() {
    return this.http.post<{
      success:       boolean;
      total_updated: number;
      results:       Record<string, { updated: number; skipped: number; failed: number }>;
    }>('/api/admin/backfill-photos', {});
  }

  homeLatLng(): google.maps.LatLngLiteral {
    const s = this.settings();
    return { lat: parseFloat(s.home_lat) || 39.9554, lng: parseFloat(s.home_lng) || -83.2174 };
  }

  favoriteCuisines(): string[] {
    try { return JSON.parse(this.settings().favorite_cuisines) as string[]; } catch { return []; }
  }

  travelInterests(): string[] {
    try { return JSON.parse(this.settings().travel_interests) as string[]; } catch { return []; }
  }
}
