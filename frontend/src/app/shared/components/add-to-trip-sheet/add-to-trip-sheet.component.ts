import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TripService } from '../../../core/services/trip.service';
import { StopService } from '../../../core/services/stop.service';
import { Trip, TripStop } from '../../../types/schema.types';

export type AddToTripEntityType = 'restaurant' | 'lodging' | 'destination' | 'special_interest';

export interface AddToTripData {
  entityType: AddToTripEntityType;
  entityId: number;
  entityName: string;
}

@Component({
  selector: 'app-add-to-trip-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  styles: [`
    .sheet {
      padding: 16px 20px 32px; min-width: 300px; max-width: 500px;
      max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch;
    }
    .sheet-title { font-size: 17px; font-weight: 700; margin: 0 0 2px; }
    .sheet-sub { font-size: 13px; color: var(--wp-text-secondary); margin: 0 0 16px;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 440px; }
    .row {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 0; border-bottom: 1px solid var(--wp-divider); cursor: pointer;
      transition: background .15s;
    }
    .row:last-child { border: none; }
    .row:hover { background: var(--wp-surface-variant); border-radius: 8px; padding-left: 6px; }
    .row-main { font-size: 15px; font-weight: 500; }
    .row-meta { font-size: 12px; color: var(--wp-text-secondary); }
    .back-row {
      display: flex; align-items: center; gap: 4px; margin-bottom: 12px;
      cursor: pointer; color: var(--wp-primary); font-size: 14px; font-weight: 500;
    }
    .empty { color: var(--wp-text-secondary); font-size: 14px; padding: 14px 0; }
    .done { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px 0; }
    .done .check { font-size: 52px; height: 52px; width: 52px; color: var(--wp-primary); }
    .done p { font-size: 16px; font-weight: 600; margin: 0; }
    .spinner-wrap { display: flex; justify-content: center; padding: 24px 0; }
  `],
  template: `
    <div class="sheet">
      @if (done()) {
        <div class="done">
          <mat-icon class="check">check_circle</mat-icon>
          <p>Added to trip!</p>
          <button mat-stroked-button style="margin-top:4px" (click)="sheetRef.dismiss()">Close</button>
        </div>
      } @else if (adding()) {
        <div class="spinner-wrap"><mat-spinner diameter="40" /></div>
      } @else if (step() === 'trips') {
        <p class="sheet-title">Add to Trip</p>
        <p class="sheet-sub">{{ data.entityName }}</p>
        @if (loadingTrips()) {
          <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
        } @else if (trips().length === 0) {
          <p class="empty">No planning or active trips found.</p>
          <button mat-stroked-button (click)="sheetRef.dismiss()">Cancel</button>
        } @else {
          @for (t of trips(); track t.id) {
            <div class="row" (click)="selectTrip(t)">
              <mat-icon style="color:var(--wp-primary)">directions_car</mat-icon>
              <div style="flex:1;min-width:0">
                <div class="row-main">{{ t.name }}</div>
                <div class="row-meta">{{ t.status | titlecase }} · {{ t.stop_count ?? 0 }} stops</div>
              </div>
              <mat-icon style="color:var(--wp-text-hint)">chevron_right</mat-icon>
            </div>
          }
        }
      } @else if (step() === 'stops') {
        <div class="back-row" (click)="step.set('trips')">
          <mat-icon style="font-size:18px;height:18px;width:18px">arrow_back</mat-icon> Back
        </div>
        <p class="sheet-title">Select a Stop</p>
        <p class="sheet-sub">{{ selectedTrip()?.name }}</p>
        @if (loadingStops()) {
          <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
        } @else if (stops().length === 0) {
          <p class="empty">This trip has no stops yet.</p>
        } @else {
          @for (s of stops(); track s.id) {
            <div class="row" (click)="confirmStop(s)">
              <mat-icon style="color:#FFB300">place</mat-icon>
              <div style="flex:1;min-width:0">
                <div class="row-main">{{ s.destination?.name ?? ('Stop ' + s.stop_order) }}</div>
                <div class="row-meta">{{ s.destination?.city ?? '' }}</div>
              </div>
              <mat-icon style="color:var(--wp-text-hint)">chevron_right</mat-icon>
            </div>
          }
        }
      }
    </div>
  `,
})
export class AddToTripSheetComponent {
  readonly sheetRef = inject(MatBottomSheetRef<AddToTripSheetComponent>);
  readonly data     = inject<AddToTripData>(MAT_BOTTOM_SHEET_DATA);

  private tripSvc = inject(TripService);
  private stopSvc = inject(StopService);
  private snack   = inject(MatSnackBar);

  step          = signal<'trips' | 'stops'>('trips');
  loadingTrips  = signal(true);
  loadingStops  = signal(false);
  adding        = signal(false);
  done          = signal(false);
  trips         = signal<Trip[]>([]);
  stops         = signal<TripStop[]>([]);
  selectedTrip  = signal<Trip | null>(null);

  constructor() {
    this.tripSvc.list().subscribe({
      next: (all) => {
        this.trips.set(all.filter(t => t.status === 'planning' || t.status === 'active'));
        this.loadingTrips.set(false);
      },
      error: () => this.loadingTrips.set(false),
    });
  }

  selectTrip(t: Trip) {
    this.selectedTrip.set(t);
    if (this.data.entityType === 'destination') {
      this.addDestinationStop(t);
      return;
    }
    this.step.set('stops');
    this.loadingStops.set(true);
    this.stopSvc.list(t.id).subscribe({
      next: (s) => { this.stops.set(s); this.loadingStops.set(false); },
      error: () => this.loadingStops.set(false),
    });
  }

  private addDestinationStop(t: Trip) {
    this.adding.set(true);
    this.stopSvc.create(t.id, {
      destination_id: this.data.entityId,
      stop_order: (t.stop_count ?? 0) + 1,
      status: 'upcoming',
    }).subscribe({
      next: () => { this.adding.set(false); this.done.set(true); },
      error: () => {
        this.snack.open('Failed to add stop', 'Dismiss', { duration: 3000 });
        this.adding.set(false);
        this.step.set('trips');
      },
    });
  }

  confirmStop(stop: TripStop) {
    const t = this.selectedTrip();
    if (!t) return;
    this.adding.set(true);
    const { entityType, entityId } = this.data;

    const req$ =
      entityType === 'restaurant'       ? this.stopSvc.addRestaurant(t.id, stop.id, entityId) :
      entityType === 'lodging'          ? this.stopSvc.setLodging(t.id, stop.id, entityId) :
      entityType === 'special_interest' ? this.stopSvc.addSpecialInterest(t.id, stop.id, entityId) :
      null;

    if (!req$) return;
    req$.subscribe({
      next: () => { this.adding.set(false); this.done.set(true); },
      error: () => {
        this.snack.open('Failed to add to stop', 'Dismiss', { duration: 3000 });
        this.adding.set(false);
      },
    });
  }
}
