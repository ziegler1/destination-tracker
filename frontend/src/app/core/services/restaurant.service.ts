import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Restaurant } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private http = inject(HttpClient);
  private base = '/api/restaurants';

  list() {
    return this.http.get<Restaurant[]>(this.base);
  }

  get(id: number) {
    return this.http.get<Restaurant>(`${this.base}/${id}`);
  }

  create(dto: Partial<Restaurant> | Record<string, unknown>) {
    return this.http.post<Restaurant>(this.base, dto);
  }

  update(id: number, dto: Partial<Restaurant> | Record<string, unknown>) {
    return this.http.put<Restaurant>(`${this.base}/${id}`, dto);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  logVisit(id: number) {
    return this.http.patch<{ visit_count: number }>(`${this.base}/${id}/visit`, {});
  }
}
