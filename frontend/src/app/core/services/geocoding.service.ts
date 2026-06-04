import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

export interface GeoResult { lat: number; lon: number; displayName: string; }

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);

  /** Look up coordinates for a place via Nominatim (OpenStreetMap). No API key required. */
  lookup(city: string, stateProvince: string, country: string): Observable<GeoResult | null> {
    const q = [city, stateProvince, country].filter(Boolean).join(', ');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;

    return this.http.get<NominatimResult[]>(url, {
      headers: {
        // Nominatim asks for a meaningful User-Agent/Referer; browser sets Referer automatically
        'Accept-Language': 'en',
      },
    }).pipe(
      map((results) => {
        if (!results.length) return null;
        const r = results[0];
        return {
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          displayName: r.display_name,
        };
      }),
      catchError(() => of(null)),
    );
  }
}
