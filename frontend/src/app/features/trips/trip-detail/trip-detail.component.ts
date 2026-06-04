import {
  Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectionStrategy, NgZone, inject, signal, computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import * as L from 'leaflet';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { TripService } from '../../../core/services/trip.service';
import { JournalService } from '../../../core/services/journal.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { Trip, TripStatus, TripStop } from '../../../types/schema.types';
import { TripStopsTabComponent }   from '../trip-stops-tab/trip-stops-tab.component';
import { TripExpensesTabComponent } from '../trip-expenses-tab/trip-expenses-tab.component';
import { TripPackingTabComponent }  from '../trip-packing-tab/trip-packing-tab.component';
import { TripJournalTabComponent }  from '../trip-journal-tab/trip-journal-tab.component';
import { TripFuelTabComponent }     from '../trip-fuel-tab/trip-fuel-tab.component';

const STATUS_COLOR: Record<TripStatus, string> = {
  planning: '#1565c0', active: '#2e7d32', completed: '#6a1b9a', cancelled: '#b71c1c',
};
const STOP_STATUS_COLOR: Record<string, string> = {
  upcoming: '#9e9e9e', current: '#1565c0', completed: '#2e7d32',
};

function stopIcon(stop: TripStop): L.DivIcon {
  const color = STOP_STATUS_COLOR[stop.status] ?? '#9e9e9e';
  return L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:white;
                 display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
                 border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)">${stop.stop_order}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16], className: '',
  });
}

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DatePipe, CurrencyPipe, TitleCasePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatChipsModule, MatDividerModule,
    TripStopsTabComponent, TripExpensesTabComponent,
    TripPackingTabComponent, TripJournalTabComponent, TripFuelTabComponent,
  ],
  styles: [`
    :host { display:block; }

    /* Two-panel layout */
    .companion-layout {
      display: grid;
      grid-template-columns: 380px 1fr;
      height: calc(100vh - 56px);
      overflow: hidden;
    }
    @media (max-width: 900px) {
      .companion-layout { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    }

    /* LEFT PANEL */
    .left-panel {
      overflow-y: auto; background: var(--wp-bg);
      border-right: 1px solid var(--wp-border);
    }
    .trip-header {
      padding: 16px; background: var(--wp-surface);
      border-bottom: 1px solid var(--wp-border); position: sticky; top: 0; z-index: 10;
    }
    .trip-name  { font-size:20px; font-weight:700; margin:0 0 2px; }
    .trip-dates { font-size:13px; color:var(--wp-text-secondary); margin:0 0 8px; }
    .trip-meta  { display:flex; gap:8px; flex-wrap:wrap; }
    .status-pill {
      padding:3px 10px; border-radius:10px; font-size:12px; font-weight:600;
      background:var(--wp-surface-variant); text-transform:capitalize;
    }
    .budget-pill { font-size:12px; color:var(--wp-text-hint); }

    /* Stop cards */
    .stops-list { padding:12px; }
    .stop-card {
      border-radius:10px; background:var(--wp-surface); margin-bottom:10px;
      border:2px solid var(--wp-border); overflow:hidden; transition:border-color .2s;
    }
    .stop-card.current  { border-color:#1565c0; }
    .stop-card.completed{ border-color:#2e7d32; }

    .stop-card-header {
      display:flex; align-items:center; gap:8px; padding:12px 14px 8px;
    }
    .stop-num {
      width:26px; height:26px; border-radius:50%; background:var(--wp-primary);
      color:#fff; display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:700; flex-shrink:0;
    }
    .stop-city  { font-size:15px; font-weight:600; flex:1; }
    .stop-dates-row { font-size:12px; color:var(--wp-text-secondary); padding:0 14px 6px; }
    .stop-drive { font-size:12px; color:var(--wp-text-hint); padding:0 14px 4px; display:flex; align-items:center; gap:4px; }
    .stop-lodging { font-size:13px; color:var(--wp-text-secondary); padding:4px 14px; display:flex; align-items:center; gap:4px; }
    .stop-actions { display:flex; gap:6px; padding:8px 14px; border-top:1px solid var(--wp-divider); }

    /* RIGHT PANEL — map */
    .right-panel { position:relative; }
    .map-el { width:100%; height:100%; }
    .recenter-btn {
      position:absolute; bottom:20px; right:16px; z-index:1000;
      background:var(--wp-surface) !important; box-shadow:0 2px 8px var(--wp-shadow) !important;
    }

    /* Bottom drawer tabs (below left panel on mobile, always visible on desktop in left panel) */
    .bottom-tabs { border-top:1px solid var(--wp-border); }

    /* AI summary */
    .ai-panel {
      padding:16px; border-radius:8px; margin:12px 12px 0;
      background:var(--wp-surface-variant); border-left:3px solid var(--wp-accent);
      font-size:14px; line-height:1.7; white-space:pre-wrap;
    }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (t) {
      <div class="companion-layout">

        <!-- ── LEFT PANEL ─────────────────────────────────────────── -->
        <div class="left-panel">

          <!-- Trip header -->
          <div class="trip-header">
            <p class="trip-name">{{ t.name }}</p>
            <p class="trip-dates">
              @if (t.start_date) { {{ t.start_date | date:'MMM d' }} }
              @if (t.start_date && t.end_date) { → }
              @if (t.end_date) { {{ t.end_date | date:'MMM d, y' }} }
              @if (!t.start_date && !t.end_date) { Dates not set }
            </p>
            <div class="trip-meta">
              <span class="status-pill" [style.color]="statusColor(t.status)">
                {{ t.status }}
              </span>
              @if (t.total_budget) {
                <span class="budget-pill">Budget: {{ t.total_budget | currency:'USD':'symbol':'1.0-0' }}</span>
              }
              <span style="margin-left:auto;display:flex;gap:6px">
                <button mat-icon-button [routerLink]="['/trips', t.id, 'edit']" title="Edit trip">
                  <mat-icon style="font-size:18px">edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="confirmDelete()" title="Delete trip">
                  <mat-icon style="font-size:18px">delete</mat-icon>
                </button>
              </span>
            </div>
            <!-- Status action -->
            @if (t.status === 'planning') {
              <button mat-raised-button color="primary" style="margin-top:10px;width:100%" (click)="setStatus('active')">
                <mat-icon>flight_takeoff</mat-icon> Start Trip
              </button>
            }
            @if (t.status === 'active') {
              <button mat-raised-button color="accent" style="margin-top:10px;width:100%" (click)="setStatus('completed')">
                <mat-icon>check_circle</mat-icon> Complete Trip
              </button>
            }
          </div>

          <!-- Stop list -->
          <div class="stops-list">
            @if (!t.stops?.length) {
              <p style="text-align:center;color:var(--wp-text-hint);padding:20px;font-size:14px">
                No stops yet — add stops below to build your route.
              </p>
            }
            @for (stop of sortedStops(); track stop.id) {
              <div class="stop-card" [class.current]="stop.status==='current'" [class.completed]="stop.status==='completed'">
                <div class="stop-card-header">
                  <div class="stop-num">{{ stop.stop_order }}</div>
                  <span class="stop-city">{{ stop.destination?.name ?? 'Stop ' + stop.stop_order }}</span>
                  <span class="status-pill" [style.color]="STOP_STATUS_COLOR[stop.status]">{{ stop.status }}</span>
                </div>
                @if (stop.destination) {
                  <p class="stop-dates-row">{{ stop.destination.city }}, {{ stop.destination.state_province }}</p>
                }
                @if (stop.arrival_date || stop.departure_date) {
                  <p class="stop-dates-row">
                    @if (stop.arrival_date) { Arrive {{ stop.arrival_date | date:'MMM d' }} }
                    @if (stop.arrival_date && stop.departure_date) { → }
                    @if (stop.departure_date) { Depart {{ stop.departure_date | date:'MMM d' }} }
                  </p>
                }
                @if (stop.notes?.includes('Fuel')) {
                  <p class="stop-drive"><mat-icon style="font-size:14px;width:14px;height:14px;color:#e65100">local_gas_station</mat-icon> Fuel stop recommended</p>
                }
                @if (stop.lodging) {
                  <p class="stop-lodging"><mat-icon style="font-size:14px;width:14px;height:14px">hotel</mat-icon> {{ stop.lodging.name }}</p>
                }
                @if (stop.status !== 'completed') {
                  <div class="stop-actions">
                    @if (stop.status === 'upcoming') {
                      <button mat-stroked-button style="font-size:12px;height:32px;line-height:32px" (click)="setStopStatus(stop, 'current')">
                        Mark Current
                      </button>
                    }
                    @if (stop.status === 'current') {
                      <button mat-stroked-button style="font-size:12px;height:32px;line-height:32px" (click)="setStopStatus(stop, 'completed')">
                        Mark Completed
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- AI Trip Summary -->
          @if (t.status === 'active' || t.status === 'completed') {
            <div style="padding:0 12px 12px">
              <button mat-stroked-button style="width:100%" (click)="generateSummary()" [disabled]="summaryLoading()">
                <mat-icon>auto_awesome</mat-icon>
                {{ summaryLoading() ? 'Generating…' : 'AI Trip Summary' }}
              </button>
              @if (summaryText()) {
                <div class="ai-panel">{{ summaryText() }}</div>
                <button mat-stroked-button color="primary" style="margin-top:8px;width:100%" (click)="saveAsJournal()">
                  <mat-icon>menu_book</mat-icon> Save as Journal Entry
                </button>
              }
            </div>
          }

          <!-- Bottom tabs -->
          <mat-divider />
          <mat-tab-group animationDuration="150ms" class="bottom-tabs">
            <mat-tab label="Stops"><app-trip-stops-tab [tripId]="t.id" /></mat-tab>
            <mat-tab label="Expenses"><app-trip-expenses-tab [tripId]="t.id" [budget]="t.total_budget ?? null" /></mat-tab>
            <mat-tab label="Packing"><app-trip-packing-tab [tripId]="t.id" [tripName]="t.name" /></mat-tab>
            <mat-tab label="Journal"><app-trip-journal-tab [tripId]="t.id" /></mat-tab>
            <mat-tab label="Fuel"><app-trip-fuel-tab [tripId]="t.id" /></mat-tab>
          </mat-tab-group>

        </div>

        <!-- ── RIGHT PANEL: Map ───────────────────────────────────── -->
        <div class="right-panel">
          <div #mapEl class="map-el"></div>
          <button mat-mini-fab class="recenter-btn" (click)="recenterMap()" title="Recenter on current stop">
            <mat-icon>my_location</mat-icon>
          </button>
        </div>

      </div>
    }
  `,
})
export class TripDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: false }) mapEl?: ElementRef<HTMLDivElement>;

  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private svc        = inject(TripService);
  private journalSvc = inject(JournalService);
  private claudeSvc  = inject(ClaudeService);
  private snack      = inject(MatSnackBar);
  private ngZone     = inject(NgZone);

  loading        = signal(true);
  summaryLoading = signal(false);
  summaryText    = signal('');

  private tripSig = signal<Trip | null>(null);
  protected get t(): Trip | null { return this.tripSig(); }

  sortedStops = computed(() =>
    [...(this.tripSig()?.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order),
  );

  // Expose to template
  readonly STOP_STATUS_COLOR = STOP_STATUS_COLOR;

  private map?: L.Map;
  private routeLayer = L.layerGroup();

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (t) => {
        this.tripSig.set(t);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.router.navigate(['/trips']); },
    });
  }

  ngAfterViewInit() {
    // Map initialises after loading — watch for the flag
    const checkMap = setInterval(() => {
      if (!this.loading() && this.mapEl) {
        clearInterval(checkMap);
        this.ngZone.runOutsideAngular(() => this.initMap());
      }
    }, 100);
  }

  ngOnDestroy() { this.map?.remove(); }

  private initMap() {
    if (!this.mapEl) return;
    this.map = L.map(this.mapEl.nativeElement, { center: [39.5, -98.35], zoom: 4 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.drawRoute();
  }

  private drawRoute() {
    if (!this.map) return;
    this.routeLayer.clearLayers();
    const stops = this.sortedStops().filter(
      (s) => s.destination?.latitude != null && s.destination?.longitude != null,
    );
    if (!stops.length) return;

    const latlngs: [number, number][] = stops.map((s) => [
      Number(s.destination!.latitude), Number(s.destination!.longitude),
    ]);

    L.polyline(latlngs, { color: '#00695C', weight: 3, dashArray: '10,8' }).addTo(this.routeLayer);

    for (const stop of stops) {
      const lat = Number(stop.destination!.latitude);
      const lon = Number(stop.destination!.longitude);
      L.marker([lat, lon], { icon: stopIcon(stop) })
        .bindPopup(`
          <strong>${stop.destination!.name}</strong><br/>
          <small>${stop.destination!.city}, ${stop.destination!.state_province}</small><br/>
          <small>Status: ${stop.status}</small>
          ${stop.lodging ? '<br/><small>🏨 ' + stop.lodging.name + '</small>' : ''}
        `)
        .addTo(this.routeLayer);
    }

    if (latlngs.length > 1) {
      this.map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 10 });
    } else {
      this.map.setView(latlngs[0], 10);
    }
  }

  recenterMap() {
    if (!this.map) return;
    const current = this.sortedStops().find((s) => s.status === 'current')
      ?? this.sortedStops()[0];
    if (current?.destination?.latitude && current.destination.longitude) {
      this.map.setView([Number(current.destination.latitude), Number(current.destination.longitude)], 11);
    }
  }

  setStatus(status: TripStatus) {
    this.svc.updateStatus(this.tripSig()!.id, status).subscribe({
      next: (t) => this.tripSig.update((cur) => ({ ...cur!, status: t.status })),
      error: () => this.snack.open('Status update failed', 'Dismiss', { duration: 3000 }),
    });
  }

  setStopStatus(stop: TripStop, status: 'current' | 'completed') {
    this.svc.get(this.tripSig()!.id).subscribe(); // will reload after patch
    const url = `/api/trips/${this.tripSig()!.id}/stops/${stop.id}/status`;
    // Use the StopService indirectly — just reload the trip after patching
    fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      .then(() => this.svc.get(this.tripSig()!.id).subscribe((t) => {
        this.tripSig.set(t);
        this.ngZone.runOutsideAngular(() => this.drawRoute());
      }));
  }

  generateSummary() {
    const trip = this.tripSig();
    if (!trip) return;
    this.summaryLoading.set(true);
    this.summaryText.set('');
    this.claudeSvc.tripSummary(trip).subscribe({
      next: (res) => { this.summaryText.set(res.result); this.summaryLoading.set(false); },
      error: () => { this.snack.open('AI request failed', 'Dismiss', { duration: 3000 }); this.summaryLoading.set(false); },
    });
  }

  saveAsJournal() {
    const trip = this.tripSig();
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

  confirmDelete() {
    if (!confirm('Delete this trip and all its data?')) return;
    this.svc.delete(this.tripSig()!.id).subscribe(() => this.router.navigate(['/trips']));
  }

  statusColor(s: TripStatus): string { return STATUS_COLOR[s] ?? '#666'; }
}
