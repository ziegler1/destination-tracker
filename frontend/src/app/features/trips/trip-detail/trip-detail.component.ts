import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TripService } from '../../../core/services/trip.service';
import { JournalService } from '../../../core/services/journal.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { Trip, TripStatus } from '../../../types/schema.types';
import { TripStopsTabComponent }   from '../trip-stops-tab/trip-stops-tab.component';
import { TripExpensesTabComponent } from '../trip-expenses-tab/trip-expenses-tab.component';
import { TripPackingTabComponent }  from '../trip-packing-tab/trip-packing-tab.component';
import { TripJournalTabComponent }  from '../trip-journal-tab/trip-journal-tab.component';
import { TripFuelTabComponent }     from '../trip-fuel-tab/trip-fuel-tab.component';

const STATUS_COLOR: Record<TripStatus, string> = {
  planning: '#1565c0', active: '#2e7d32', completed: '#6a1b9a', cancelled: '#b71c1c',
};

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DatePipe, CurrencyPipe, TitleCasePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatSnackBarModule,
    TripStopsTabComponent, TripExpensesTabComponent,
    TripPackingTabComponent, TripJournalTabComponent, TripFuelTabComponent,
  ],
  styles: [`
    .hero { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:16px; margin-bottom:20px; }
    .trip-title { font-size:28px; font-weight:700; margin:0 0 4px; }
    .trip-dates { font-size:14px; color:var(--wp-text-secondary); margin:0 0 10px; }
    .meta-chips { display:flex; gap:10px; flex-wrap:wrap; }
    .meta-chip {
      display:inline-flex; align-items:center; gap:4px;
      padding:4px 12px; border-radius:12px; font-size:13px; font-weight:500;
      background:var(--wp-surface-variant);
    }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }
    .description { color:var(--wp-text-secondary); line-height:1.6; margin-bottom:20px; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (t) {
      <div class="page-container">

        <!-- ── Header ─────────────────────────────────────────────── -->
        <div class="hero">
          <div>
            <h1 class="trip-title">{{ t.name }}</h1>
            <p class="trip-dates">
              @if (t.start_date) { {{ t.start_date | date:'MMM d, y' }} }
              @if (t.start_date && t.end_date) { &nbsp;→&nbsp; }
              @if (t.end_date)   { {{ t.end_date | date:'MMM d, y' }} }
              @if (!t.start_date && !t.end_date) { Dates not set }
            </p>
            <div class="meta-chips">
              <span class="meta-chip" [style.color]="statusColor(t.status)">
                <mat-icon style="font-size:15px;width:15px;height:15px">{{ statusIcon(t.status) }}</mat-icon>
                {{ t.status | titlecase }}
              </span>
              @if (t.stops?.length) {
                <span class="meta-chip">
                  <mat-icon style="font-size:15px;width:15px;height:15px">place</mat-icon>
                  {{ t.stops!.length }} {{ t.stops!.length === 1 ? 'stop' : 'stops' }}
                </span>
              }
              @if (t.total_budget) {
                <span class="meta-chip">
                  <mat-icon style="font-size:15px;width:15px;height:15px">savings</mat-icon>
                  {{ t.total_budget | currency:'USD':'symbol':'1.0-0' }} budget
                </span>
              }
            </div>
          </div>

          <div class="actions">
            @if (t.status === 'planning') {
              <button mat-raised-button color="primary" (click)="setStatus('active')">
                <mat-icon>flight_takeoff</mat-icon> Start Trip
              </button>
            }
            @if (t.status === 'active') {
              <button mat-raised-button color="accent" (click)="setStatus('completed')">
                <mat-icon>check_circle</mat-icon> Complete Trip
              </button>
            }
            <button mat-stroked-button [routerLink]="['/trips', t.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="confirmDelete()">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>

        @if (t.description) {
          <p class="description">{{ t.description }}</p>
        }

        <!-- ── AI Trip Summary ─────────────────────────────────── -->
        @if (t.status === 'active' || t.status === 'completed') {
          <div style="margin-bottom:20px">
            <button mat-stroked-button (click)="generateSummary()" [disabled]="summaryLoading()">
              <mat-icon>auto_awesome</mat-icon>
              {{ summaryLoading() ? 'Generating…' : 'AI Trip Summary' }}
            </button>
            @if (summaryText()) {
              <div style="margin-top:12px;padding:16px;border-radius:8px;background:var(--wp-surface-variant);border-left:3px solid var(--wp-accent);font-size:14px;line-height:1.7;white-space:pre-wrap">
                {{ summaryText() }}
              </div>
              <button mat-stroked-button color="primary" style="margin-top:8px" (click)="saveAsJournal()">
                <mat-icon>menu_book</mat-icon> Save as Journal Entry
              </button>
            }
          </div>
        }

        <!-- ── Tabs ───────────────────────────────────────────────── -->
        <mat-tab-group animationDuration="200ms">

          <mat-tab label="Overview">
            <app-trip-stops-tab [tripId]="t.id" />
          </mat-tab>

          <mat-tab label="Expenses">
            <app-trip-expenses-tab [tripId]="t.id" [budget]="t.total_budget ?? null" />
          </mat-tab>

          <mat-tab label="Packing">
            <app-trip-packing-tab [tripId]="t.id" [tripName]="t.name" />
          </mat-tab>

          <mat-tab label="Journal">
            <app-trip-journal-tab [tripId]="t.id" />
          </mat-tab>

          <mat-tab label="Fuel">
            <app-trip-fuel-tab [tripId]="t.id" />
          </mat-tab>

        </mat-tab-group>
      </div>
    }
  `,
})
export class TripDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc        = inject(TripService);
  private journalSvc = inject(JournalService);
  private claudeSvc  = inject(ClaudeService);
  private snack      = inject(MatSnackBar);

  loading      = signal(true);
  summaryLoading = signal(false);
  summaryText    = signal('');

  private trip = signal<Trip | null>(null);
  protected get t(): Trip | null { return this.trip(); }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (t) => { this.trip.set(t); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/trips']); },
    });
  }

  setStatus(status: TripStatus) {
    const id = this.trip()!.id;
    this.svc.updateStatus(id, status).subscribe({
      next: (t) => this.trip.update((cur) => ({ ...cur!, status: t.status })),
      error: () => this.snack.open('Status update failed', 'Dismiss', { duration: 3000 }),
    });
  }

  confirmDelete() {
    if (!confirm('Delete this trip and all its data?')) return;
    this.svc.delete(this.trip()!.id).subscribe(() => this.router.navigate(['/trips']));
  }

  generateSummary(): void {
    const trip = this.trip();
    if (!trip) return;
    this.summaryLoading.set(true);
    this.summaryText.set('');
    this.claudeSvc.tripSummary(trip).subscribe({
      next: (res) => { this.summaryText.set(res.result); this.summaryLoading.set(false); },
      error: () => { this.snack.open('AI request failed', 'Dismiss', { duration: 3000 }); this.summaryLoading.set(false); },
    });
  }

  saveAsJournal(): void {
    const trip = this.trip();
    if (!trip || !this.summaryText()) return;
    this.journalSvc.create(trip.id, {
      title: `Trip Summary: ${trip.name}`,
      body: this.summaryText(),
      entry_date: new Date().toISOString().split('T')[0],
    }).subscribe(() => {
      this.snack.open('Saved to journal!', 'OK', { duration: 2500 });
      this.summaryText.set('');
    });
  }

  statusColor(s: TripStatus): string { return STATUS_COLOR[s] ?? '#666'; }
  statusIcon(s: TripStatus): string {
    return ({ planning: 'edit_calendar', active: 'flight_takeoff', completed: 'check_circle', cancelled: 'cancel' } as Record<TripStatus, string>)[s] ?? 'trip_origin';
  }
}
