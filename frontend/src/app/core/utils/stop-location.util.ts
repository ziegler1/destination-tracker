import { TripStop, TripStopPlaceType } from '../../types/schema.types';

/** Best available address string for a stop: a specific place address, falling back to its destination's city/state. */
export function stopAddress(stop: TripStop): string | null {
  return stop.place_address
      ?? (stop.destination ? `${stop.destination.city}, ${stop.destination.state_province}` : null);
}

/**
 * Best available routing location for a stop, for building Directions API requests:
 *  1. place_address (specific street address)
 *  2. place_lat + place_lng (coordinates)
 *  3. destination's "city, state" (fallback)
 */
export function stopRouteLocation(stop: TripStop): string | { lat: number; lng: number } | null {
  if (stop.place_address) return stop.place_address;
  if (stop.place_lat != null && stop.place_lng != null) {
    return { lat: Number(stop.place_lat), lng: Number(stop.place_lng) };
  }
  if (stop.destination) return `${stop.destination.city}, ${stop.destination.state_province}`;
  return null;
}

/** Best available coordinates for a stop: a specific place's lat/lng, falling back to its destination's. */
export function stopCoords(stop: TripStop): { lat: number; lng: number } | null {
  if (stop.place_lat != null && stop.place_lng != null) {
    return { lat: Number(stop.place_lat), lng: Number(stop.place_lng) };
  }
  if (stop.destination?.latitude && stop.destination?.longitude) {
    return { lat: Number(stop.destination.latitude), lng: Number(stop.destination.longitude) };
  }
  return null;
}

/** Replaces a leading street-number digit run with "XXX" to partially redact a rental/residence address. */
export function redactStreetNumber(address: string): string {
  return address.replace(/^\s*\d+/, 'XXX');
}

/** Classifies a Google Place's `types` array into a trip stop place type. */
export function detectPlaceType(types: string[] | undefined | null): TripStopPlaceType {
  if (!types?.length) return 'other';
  if (types.includes('lodging')) return 'hotel';
  if (types.includes('campground') || types.includes('rv_park')) return 'campsite';
  if (types.includes('locality') || types.includes('political') || types.includes('administrative_area_level_1')) return 'city';
  return 'other';
}
