import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface GeoResult { lat: number; lon: number; displayName: string; }

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);

  /**
   * Look up coordinates via backend proxy → Nominatim/OpenStreetMap.
   * Pass a full `address` for street-level precision; omit for city-level.
   */
  lookup(city: string, stateProvince: string, country: string, address?: string): Observable<GeoResult | null> {
    const params: Record<string, string> = { city, state_province: stateProvince, country };
    if (address?.trim()) params['address'] = address.trim();
    return this.http
      .get<GeoResult | null>(`/api/geocode?${new URLSearchParams(params)}`)
      .pipe(catchError(() => of(null)));
  }
}
