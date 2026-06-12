import { TripStop, TripStopPlaceType } from '../../types/schema.types';

/** Best available address string for a stop: a specific place address, falling back to its destination's city/state. */
export function stopAddress(stop: TripStop): string | null {
  return stop.place_address
      ?? (stop.destination ? `${stop.destination.city}, ${stop.destination.state_province}` : null);
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
