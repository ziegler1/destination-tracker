import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SkeletonGridComponent } from '../../../shared/skeleton-grid/skeleton-grid.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TripService } from '../../../core/services/trip.service';
import { Trip, TripStatus } from '../../../types/schema.types';

type StatusFilter = TripStatus | 'all';

const STATUS_META: Record<TripStatus, { label: string; icon: string; color: string }> = {
  planning:  { label: 'Planning',  icon: 'edit_calendar', color: '#1565c0' },
  active:    { label: 'Active',    icon: 'flight_takeoff', color: '#2e7d32' },
  completed: { label: 'Completed', icon: 'check_circle',  color: '#6a1b9a' },
  cancelled: { label: 'Cancelled', icon: 'cancel',        color: '#b71c1c' },
};

@Component({
  selector: 'app-trips-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DatePipe, CurrencyPipe,
    MatCardModule, MatIconModule,
    MatButtonModule, MatProgressSpinnerModule, MatTooltipModule, SkeletonGridComponent,
    EmptyStateComponent,
  ],
  styles: [`
    .chips { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
    .chip {
      padding:4px 14px; border-radius:16px; border:1.5px solid var(--wp-border);
      background:var(--wp-surface); cursor:pointer; font-size:13px;
      color:var(--wp-text-secondary); transition:all .2s;
    }
    .chip.active { background:var(--wp-primary); color:#fff; border-color:var(--wp-primary); }

    .grid { display:flex; flex-direction:column; gap:12px; }

    .trip-card {
      cursor:pointer; padding:0 !important; overflow:hidden;
      transition:transform .15s, box-shadow .15s;
    }
    .trip-card:hover { transform:translateX(3px); box-shadow:0 4px 16px var(--wp-shadow) !important; }

    .card-inner { display:flex; align-items:stretch; }
    .status-bar { width:5px; flex-shrink:0; }
    .card-content { padding:16px 18px; flex:1; }

    .trip-name { font-size:17px; font-weight:600; margin:0 0 4px; }
    .trip-meta { font-size:13px; color:var(--wp-text-secondary); margin:0 0 10px; }
    .trip-footer { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }

    .status-chip {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 10px; border-radius:12px; font-size:12px; font-weight:500;
      background:var(--wp-surface-variant);
    }
    .stop-count { font-size:12px; color:var(--wp-text-hint); display:flex; align-items:center; gap:3px; }
    .budget { font-size:13px; font-weight:600; color:var(--wp-primary); margin-left:auto; }

    .empty { text-align:center; color:var(--wp-text-secondary); padding:60px 0; }
    .empty-icon { font-size:56px; display:block; margin-bottom:12px; }

    .fab {
      position:fixed; bottom:28px; right:28px;
      background:var(--wp-primary) !important; color:#fff !important;
      box-shadow:0 4px 12px var(--wp-shadow) !important;
    }
  `],
  template: `
    <div class="page-container">

      <div class="chips">
        @for (c of statusChips; track c.value) {
          <span class="chip" [class.active]="statusFilter() === c.value"
                (click)="statusFilter.set(c.value)">
            {{ c.label }}
          </span>
        }
      </div>

      @if (loading()) {
        <app-skeleton-grid [count]="4" />
      } @else if (trips().length === 0) {
        <app-empty-state icon="🗺️" title="No trips yet"
          subtitle="Plan your first road trip and Waypoint will build a complete itinerary"
          ctaLabel="Plan a Trip" ctaRoute="/trips/new" />
      } @else if (filtered().length === 0) {
        <div class="empty">
          <span class="empty-icon">✈️</span>
          <p>No trips match this filter</p>
        </div>
      } @else {
        <div class="grid">
          @for (t of filtered(); track t.id) {
            <mat-card class="trip-card" [routerLink]="['/trips', t.id]">
              <div class="card-inner">
                <div class="status-bar" [style.background]="statusColor(t.status)"></div>
                <div class="card-content">
                  <p class="trip-name">{{ t.name }}</p>
                  <p class="trip-meta">
                    @if (t.start_date) { {{ t.start_date | date:'MMM d, y' }} }
                    @if (t.start_date && t.end_date) { → }
                    @if (t.end_date) { {{ t.end_date | date:'MMM d, y' }} }
                    @if (!t.start_date && !t.end_date) { No dates set }
                  </p>
                  <div class="trip-footer">
                    <span class="status-chip" [style.color]="statusColor(t.status)">
                      <mat-icon style="font-size:14px;width:14px;height:14px">{{ statusIcon(t.status) }}</mat-icon>
                      {{ statusLabel(t.status) }}
                    </span>
                    @if (t.stop_count) {
                      <span class="stop-count">
                        <mat-icon style="font-size:14px;width:14px;height:14px">place</mat-icon>
                        {{ t.stop_count }} {{ t.stop_count === 1 ? 'stop' : 'stops' }}
                      </span>
                    }
                    @if (t.total_budget) {
                      <span class="budget">{{ t.total_budget | currency:'USD':'symbol':'1.0-0' }} budget</span>
                    }
                  </div>
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>

    <button mat-fab class="fab" [routerLink]="['/trips/new']" matTooltip="Plan a trip">
      <mat-icon>add</mat-icon>
    </button>
  `,
})
export class TripsListComponent implements OnInit {
  private svc = inject(TripService);

  loading = signal(true);
  trips = signal<Trip[]>([]);
  statusFilter = signal<StatusFilter>('all');

  readonly statusChips: { label: string; value: StatusFilter }[] = [
    { label: 'All',       value: 'all' },
    { label: 'Active',    value: 'active' },
    { label: 'Planning',  value: 'planning' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  filtered = computed(() => {
    const f = this.statusFilter();
    return f === 'all' ? this.trips() : this.trips().filter((t) => t.status === f);
  });

  ngOnInit() {
    this.svc.list().subscribe({
      next: (list) => { this.trips.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  statusColor(s: TripStatus): string { return STATUS_META[s]?.color ?? '#666'; }
  statusIcon(s: TripStatus): string  { return STATUS_META[s]?.icon ?? 'trip_origin'; }
  statusLabel(s: TripStatus): string { return STATUS_META[s]?.label ?? s; }
}
