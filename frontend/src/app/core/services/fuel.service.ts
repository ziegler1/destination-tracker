import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FuelStop } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class FuelService {
  private http = inject(HttpClient);

  private base(tripId: number) { return `/api/trips/${tripId}/fuel`; }

  list(tripId: number) {
    return this.http.get<FuelStop[]>(this.base(tripId));
  }

  create(tripId: number, dto: Record<string, unknown>) {
    return this.http.post<FuelStop>(this.base(tripId), dto);
  }

  update(tripId: number, stopId: number, dto: Record<string, unknown>) {
    return this.http.put<FuelStop>(`${this.base(tripId)}/${stopId}`, dto);
  }

  delete(tripId: number, stopId: number) {
    return this.http.delete<void>(`${this.base(tripId)}/${stopId}`);
  }
}
