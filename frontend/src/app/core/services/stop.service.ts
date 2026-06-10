import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TripStop, TripStopStatus } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class StopService {
  private http = inject(HttpClient);

  private base(tripId: number) { return `/api/trips/${tripId}/stops`; }

  list(tripId: number) {
    return this.http.get<TripStop[]>(this.base(tripId));
  }

  create(tripId: number, dto: Record<string, unknown>) {
    return this.http.post<TripStop>(this.base(tripId), dto);
  }

  update(tripId: number, stopId: number, dto: Record<string, unknown>) {
    return this.http.put<TripStop>(`${this.base(tripId)}/${stopId}`, dto);
  }

  updateStatus(tripId: number, stopId: number, status: TripStopStatus) {
    return this.http.patch<TripStop>(`${this.base(tripId)}/${stopId}/status`, { status });
  }

  delete(tripId: number, stopId: number) {
    return this.http.delete<void>(`${this.base(tripId)}/${stopId}`);
  }

  reorder(tripId: number, order: number[]) {
    return this.http.put<TripStop[]>(`${this.base(tripId)}/reorder`, { order });
  }

  addRestaurant(tripId: number, stopId: number, restaurantId: number) {
    return this.http.post<unknown>(`${this.base(tripId)}/${stopId}/restaurants`, { restaurant_id: restaurantId });
  }

  setLodging(tripId: number, stopId: number, lodgingId: number) {
    return this.http.patch<TripStop>(`${this.base(tripId)}/${stopId}/lodging`, { lodging_id: lodgingId });
  }

  addSpecialInterest(tripId: number, stopId: number, specialInterestId: number) {
    return this.http.post<unknown>(`${this.base(tripId)}/${stopId}/special-interests`, { special_interest_id: specialInterestId });
  }
}
