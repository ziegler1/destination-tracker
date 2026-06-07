import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Destination, DestinationStatus } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class DestinationService {
  private http = inject(HttpClient);
  private base = '/api/destinations';

  list() {
    return this.http.get<Destination[]>(this.base);
  }

  get(id: number) {
    return this.http.get<Destination>(`${this.base}/${id}`);
  }

  create(dto: Partial<Destination> | Record<string, unknown>, force = false) {
    return this.http.post<Destination>(this.base, dto, force ? { params: { force: 'true' } } : {});
  }

  update(id: number, dto: Partial<Destination> | Record<string, unknown>) {
    return this.http.put<Destination>(`${this.base}/${id}`, dto);
  }

  updateStatus(id: number, status: DestinationStatus) {
    return this.http.patch<Destination>(`${this.base}/${id}/status`, { status });
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  logVisit(id: number) {
    return this.http.patch<{ visit_count: number }>(`${this.base}/${id}/visit`, {});
  }
}
