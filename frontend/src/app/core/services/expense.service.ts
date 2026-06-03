import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TripExpense } from '../../types/schema.types';

export interface ExpenseSummary {
  total: number;
  by_category: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private http = inject(HttpClient);

  private base(tripId: number) { return `/api/trips/${tripId}/expenses`; }

  list(tripId: number) {
    return this.http.get<TripExpense[]>(this.base(tripId));
  }

  summary(tripId: number) {
    return this.http.get<ExpenseSummary>(`${this.base(tripId)}/summary`);
  }

  create(tripId: number, dto: Record<string, unknown>) {
    return this.http.post<TripExpense>(this.base(tripId), dto);
  }

  update(tripId: number, expId: number, dto: Record<string, unknown>) {
    return this.http.put<TripExpense>(`${this.base(tripId)}/${expId}`, dto);
  }

  delete(tripId: number, expId: number) {
    return this.http.delete<void>(`${this.base(tripId)}/${expId}`);
  }
}
