import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface GeoResult { lat: number; lon: number; displayName: string; }

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);

  /** Look up coordinates via the backend proxy → Nominatim/OpenStreetMap. No API key required. */
  lookup(city: string, stateProvince: string, country: string): Observable<GeoResult | null> {
    const params = new URLSearchParams({
      city,
      state_province: stateProvince,
      country,
    });
    return this.http
      .get<GeoResult | null>(`/api/geocode?${params}`)
      .pipe(catchError(() => of(null)));
  }
}
