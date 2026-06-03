import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TripJournalEntry } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class JournalService {
  private http = inject(HttpClient);

  private base(tripId: number) { return `/api/trips/${tripId}/journal`; }

  list(tripId: number) {
    return this.http.get<TripJournalEntry[]>(this.base(tripId));
  }

  create(tripId: number, dto: Record<string, unknown>) {
    return this.http.post<TripJournalEntry>(this.base(tripId), dto);
  }

  update(tripId: number, entryId: number, dto: Record<string, unknown>) {
    return this.http.put<TripJournalEntry>(`${this.base(tripId)}/${entryId}`, dto);
  }

  delete(tripId: number, entryId: number) {
    return this.http.delete<void>(`${this.base(tripId)}/${entryId}`);
  }
}
