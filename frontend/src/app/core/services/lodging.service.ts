import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Lodging } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class LodgingService {
  private http = inject(HttpClient);
  private base = '/api/lodging';

  list() {
    return this.http.get<Lodging[]>(this.base);
  }

  get(id: number) {
    return this.http.get<Lodging>(`${this.base}/${id}`);
  }

  create(dto: Partial<Lodging> | Record<string, unknown>) {
    return this.http.post<Lodging>(this.base, dto);
  }

  update(id: number, dto: Partial<Lodging> | Record<string, unknown>) {
    return this.http.put<Lodging>(`${this.base}/${id}`, dto);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
