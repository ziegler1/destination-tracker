import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Trip, TripStatus } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class TripService {
  private http = inject(HttpClient);
  private base = '/api/trips';

  list() {
    return this.http.get<Trip[]>(this.base);
  }

  get(id: number) {
    return this.http.get<Trip>(`${this.base}/${id}`);
  }

  create(dto: Partial<Trip> | Record<string, unknown>) {
    return this.http.post<Trip>(this.base, dto);
  }

  update(id: number, dto: Partial<Trip> | Record<string, unknown>) {
    return this.http.put<Trip>(`${this.base}/${id}`, dto);
  }

  updateStatus(id: number, status: TripStatus) {
    return this.http.patch<Trip>(`${this.base}/${id}/status`, { status });
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
