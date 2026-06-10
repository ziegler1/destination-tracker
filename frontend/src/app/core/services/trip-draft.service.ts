import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TripDraft {
  destination?: string;
  city?: string;
  state_province?: string;
  formatted_address?: string;
  lat?: number;
  lng?: number;
  place_id?: string;
}

/**
 * Carries a destination picked on the home page into the trip wizard so it
 * can pre-fill the "Destination" field. Consumed once, then cleared, so a
 * stale draft never resurfaces on a later, unrelated visit to the wizard.
 */
@Injectable({ providedIn: 'root' })
export class TripDraftService {
  private draft$ = new BehaviorSubject<TripDraft | null>(null);

  set(draft: TripDraft): void {
    this.draft$.next(draft);
  }

  consume(): TripDraft | null {
    const draft = this.draft$.value;
    this.draft$.next(null);
    return draft;
  }
}
