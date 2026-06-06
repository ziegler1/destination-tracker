import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface GmapsLatLng { lat: number; lng: number; }

@Injectable({ providedIn: 'root' })
export class MapsService {

  private ready(): boolean {
    return typeof google !== 'undefined' && !!google.maps;
  }

  /** Load a driving route via Google Directions API. */
  loadDirections(
    waypoints: GmapsLatLng[],
    optimizeWaypoints = false,
  ): Observable<google.maps.DirectionsResult | null> {
    return new Observable(obs => {
      if (!this.ready() || waypoints.length < 2) { obs.next(null); obs.complete(); return; }
      new google.maps.DirectionsService().route(
        {
          origin:      waypoints[0],
          destination: waypoints[waypoints.length - 1],
          waypoints:   waypoints.slice(1, -1).map(p => ({ location: p, stopover: true })),
          travelMode:  google.maps.TravelMode.DRIVING,
          optimizeWaypoints,
        },
        (result, status) => {
          obs.next(status === google.maps.DirectionsStatus.OK ? result : null);
          obs.complete();
        },
      );
    });
  }

  /** Geocode a free-text address using Google Geocoding API. */
  geocode(address: string): Observable<GmapsLatLng | null> {
    return new Observable(obs => {
      if (!this.ready()) { obs.next(null); obs.complete(); return; }
      new google.maps.Geocoder().geocode({ address }, (results, status) => {
        if (status === 'OK' && results?.length) {
          const loc = results[0].geometry.location;
          obs.next({ lat: loc.lat(), lng: loc.lng() });
        } else {
          obs.next(null);
        }
        obs.complete();
      });
    });
  }

  /** Fetch full Place details using the new Places API (fetchFields). */
  getPlaceDetails(
    placeId: string,
    fields: string[] = ['id', 'displayName', 'formattedAddress', 'location',
                        'nationalPhoneNumber', 'websiteURI', 'priceLevel'],
  ): Observable<google.maps.places.Place | null> {
    return new Observable(obs => {
      google.maps.importLibrary('places').then(async (lib: any) => {
        const place: google.maps.places.Place = new lib.Place({ id: placeId });
        await place.fetchFields({ fields });
        obs.next(place);
        obs.complete();
      }).catch(() => {
        obs.next(null);
        obs.complete();
      });
    });
  }

  /** Build a Google Maps directions URL for opening in a new tab. */
  directionsUrl(waypoints: GmapsLatLng[]): string {
    if (waypoints.length < 2) return 'https://maps.google.com';
    const pts = waypoints.map(p => `${p.lat},${p.lng}`).join('/');
    return `https://www.google.com/maps/dir/${pts}`;
  }
}
