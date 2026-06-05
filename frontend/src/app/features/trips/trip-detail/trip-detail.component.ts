import {
  Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectionStrategy, NgZone, inject, signal, computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { TripService } from '../../../core/services/trip.service';
import { StopService } from '../../../core/services/stop.service';
import { LodgingService } from '../../../core/services/lodging.service';
import { JournalService } from '../../../core/services/journal.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { Trip, TripStatus, TripStop, Lodging } from '../../../types/schema.types';
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

function stopMarkerIcon(stop: TripStop): L.DivIcon {
  const color = STOP_STATUS_COLOR[stop.status] ?? '#9e9e9e';
  return L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:white;
                 display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
                 border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)">${stop.stop_order}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16], className: '',
  });
}

function lodgingIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:22px;height:22px;border-radius:4px;background:#6a1b9a;color:white;
                 display:flex;align-items:center;justify-content:center;font-size:12px;
                 border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)">🏨</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12], className: '',
  });
}

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule, DatePipe, CurrencyPipe, TitleCasePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    TripStopsTabComponent, TripExpensesTabComponent,
    TripPackingTabComponent, TripJournalTabComponent, TripFuelTabComponent,
  ],
  styles: [`
    :host { display:block; }
    .companion-layout {
      display: grid;
      grid-template-columns: 400px 1fr;
      height: calc(100vh - 56px);
      overflow: hidden;
    }
    @media (max-width: 900px) {
      .companion-layout { grid-template-columns:1fr; grid-template-rows:auto 1fr; }
    }

    /* LEFT */
    .left-panel { overflow-y:auto; background:var(--wp-bg); border-right:1px solid var(--wp-border); }
    .trip-header {
      padding:14px 16px; background:var(--wp-surface);
      border-bottom:1px solid var(--wp-border); position:sticky; top:0; z-index:10;
    }
    .trip-name  { font-size:19px; font-weight:700; margin:0 0 2px; }
    .trip-dates { font-size:13px; color:var(--wp-text-secondary); margin:0 0 8px; }
    .header-meta { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .status-pill { padding:3px 10px; border-radius:10px; font-size:12px; font-weight:600; background:var(--wp-surface-variant); text-transform:capitalize; }

    /* Stop cards */
    .stops-list { padding:10px; }
    .stop-card {
      border-radius:10px; background:var(--wp-surface); margin-bottom:10px;
      border:2px solid var(--wp-border); overflow:hidden; transition:border-color .2s;
    }
    .stop-card.current   { border-color:#1565c0; }
    .stop-card.completed { border-color:#2e7d32; }
    .stop-card.editing   { border-color:var(--wp-accent); }

    .stop-header { display:flex; align-items:center; gap:8px; padding:12px 14px 6px; }
    .stop-num { width:26px;height:26px;border-radius:50%;background:var(--wp-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0; }
    .stop-city { font-size:15px; font-weight:600; flex:1; }

    .stop-row  { padding:2px 14px; font-size:13px; color:var(--wp-text-secondary); display:flex; align-items:center; gap:6px; }
    .stop-row mat-icon { font-size:14px; width:14px; height:14px; flex-shrink:0; }
    .gas-flag  { color:#e65100; font-weight:600; }

    .stop-actions { display:flex; gap:6px; padding:8px 14px; border-top:1px solid var(--wp-divider); flex-wrap:wrap; }

    /* Edit form */
    .edit-form { padding:12px 14px; background:var(--wp-surface-variant); }
    .edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 10px; }
    .edit-full { grid-column:1/-1; }

    /* Hotel panel */
    .hotel-panel { margin:8px 14px; padding:12px; border-radius:8px; background:var(--wp-surface-variant); }
    .hotel-option { display:flex; align-items:center; gap:10px; padding:8px; border-radius:6px; cursor:pointer; margin-bottom:4px; }
    .hotel-option:hover { background:var(--wp-surface); }
    .hotel-option.selected { background:var(--wp-primary); color:#fff; }
    .hotel-option.selected .hotel-sub { color:rgba(255,255,255,.7); }
    .hotel-sub { font-size:12px; color:var(--wp-text-hint); }

    /* RIGHT */
    .right-panel { position:relative; }
    .map-el { width:100%; height:100%; }
    .map-fab {
      position:absolute; bottom:20px; right:16px; z-index:1000;
      background:var(--wp-surface) !important; box-shadow:0 2px 8px var(--wp-shadow) !important;
    }

    /* AI */
    .ai-panel { padding:12px 14px 0; }
    .ai-box { margin-top:10px; padding:12px; border-radius:8px; background:var(--wp-surface-variant); border-left:3px solid var(--wp-accent); font-size:14px; line-height:1.7; white-space:pre-wrap; }

    .bottom-tabs { border-top:1px solid var(--wp-border); }
    .geocoding-note { font-size:12px; color:var(--wp-text-hint); text-align:center; padding:8px; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (t) {
      <div class="companion-layout">

        <!-- ── LEFT PANEL ────────────────────────────────────────── -->
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
            <div class="header-meta">
              <span class="status-pill" [style.color]="statusColor(t.status)">{{ t.status }}</span>
              @if (t.total_budget) {
                <span style="font-size:12px;color:var(--wp-text-hint)">{{ t.total_budget | currency:'USD':'symbol':'1.0-0' }} budget</span>
              }
              <span style="margin-left:auto;display:flex;gap:4px">
                <button mat-icon-button [routerLink]="['/trips', t.id, 'edit']" title="Edit trip"><mat-icon style="font-size:18px">edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="confirmDelete()" title="Delete"><mat-icon style="font-size:18px">delete</mat-icon></button>
              </span>
            </div>
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

          @if (geocodingInProgress()) {
            <p class="geocoding-note">📍 Locating stops on map…</p>
          }

          <!-- Stop cards -->
          <div class="stops-list">
            @if (!sortedStops().length) {
              <p style="text-align:center;color:var(--wp-text-hint);padding:20px;font-size:14px">No stops — use the Stops tab below to plan your route.</p>
            }
            @for (stop of sortedStops(); track stop.id) {
              <div class="stop-card"
                   [class.current]="stop.status==='current'"
                   [class.completed]="stop.status==='completed'"
                   [class.editing]="editingStopId()===stop.id">

                <!-- Stop header -->
                <div class="stop-header">
                  <div class="stop-num">{{ stop.stop_order }}</div>
                  <span class="stop-city">
                    {{ stop.destination?.name ?? ('Stop ' + stop.stop_order) }}
                  </span>
                  <span class="status-pill" [style.color]="STOP_STATUS_COLOR[stop.status]">{{ stop.status }}</span>
                </div>

                @if (stop.destination) {
                  <p class="stop-row" style="color:var(--wp-text-hint)">
                    <mat-icon>place</mat-icon>{{ stop.destination.city }}, {{ stop.destination.state_province }}
                  </p>
                }
                @if (stop.arrival_date || stop.departure_date) {
                  <p class="stop-row">
                    <mat-icon>calendar_today</mat-icon>
                    @if (stop.arrival_date)   { Arrive {{ stop.arrival_date | date:'MMM d' }} }
                    @if (stop.arrival_date && stop.departure_date) { → }
                    @if (stop.departure_date) { Depart {{ stop.departure_date | date:'MMM d' }} }
                  </p>
                }
                @if (stop.notes?.includes('Fuel')) {
                  <p class="stop-row gas-flag"><mat-icon>local_gas_station</mat-icon> Fuel up before this stop</p>
                }

                <!-- Lodging info -->
                @if (stop.lodging) {
                  <p class="stop-row"><mat-icon>hotel</mat-icon>
                    <span>
                      <strong>{{ stop.lodging.name }}</strong>
                      @if (lodgingAddress(stop)) {
                        <br/><span style="font-size:12px;color:var(--wp-text-hint)">{{ lodgingAddress(stop) }}</span>
                      }
                      @if (stop.lodging.price_per_night) {
                        <span style="font-size:12px;color:var(--wp-primary);margin-left:6px">{{ stop.lodging.price_per_night | currency:'USD':'symbol':'1.0-0' }}/night</span>
                      }
                    </span>
                  </p>
                } @else {
                  <p class="stop-row" style="color:var(--wp-text-hint)"><mat-icon>hotel</mat-icon> No lodging set</p>
                }

                <!-- Inline edit form -->
                @if (editingStopId() === stop.id) {
                  <div class="edit-form">
                    <form [formGroup]="editStopForm" (ngSubmit)="saveStopEdit(stop)">
                      <div class="edit-grid">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Arrive</mat-label>
                          <input matInput [matDatepicker]="ep1" formControlName="arrival_date" />
                          <mat-datepicker-toggle matSuffix [for]="ep1" />
                          <mat-datepicker #ep1 />
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Depart</mat-label>
                          <input matInput [matDatepicker]="ep2" formControlName="departure_date" />
                          <mat-datepicker-toggle matSuffix [for]="ep2" />
                          <mat-datepicker #ep2 />
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="edit-full">
                          <mat-label>Notes</mat-label>
                          <input matInput formControlName="notes" />
                        </mat-form-field>
                      </div>
                      <div style="display:flex;gap:8px;margin-top:8px">
                        <button mat-raised-button color="primary" type="submit" [disabled]="savingStop()">
                          {{ savingStop() ? 'Saving…' : 'Save' }}
                        </button>
                        <button mat-stroked-button type="button" (click)="editingStopId.set(null)">Cancel</button>
                      </div>
                    </form>
                  </div>

                  <!-- Hotel change panel -->
                  <div class="hotel-panel">
                    <p style="font-size:13px;font-weight:600;margin:0 0 8px">Change Hotel</p>
                    @if (cityLodgings().length === 0) {
                      <p style="font-size:12px;color:var(--wp-text-hint)">No lodging in this city yet.
                        <a [routerLink]="['/lodging/new']" style="color:var(--wp-primary)">Add one →</a>
                      </p>
                    } @else {
                      <div class="hotel-option" [class.selected]="!stop.lodging_id" (click)="changeLodging(stop, null)">
                        <mat-icon>hotel_outlined</mat-icon>
                        <span>None — I'll decide later</span>
                      </div>
                      @for (l of cityLodgings(); track l.id) {
                        <div class="hotel-option" [class.selected]="stop.lodging_id === l.id" (click)="changeLodging(stop, l.id)">
                          <mat-icon>hotel</mat-icon>
                          <div>
                            <div>{{ l.name }}</div>
                            <div class="hotel-sub">{{ l.lodging_type | titlecase }} @if (l.price_per_night) { · {{ l.price_per_night | currency:'USD':'symbol':'1.0-0' }}/night } </div>
                          </div>
                        </div>
                      }
                    }
                  </div>
                }

                <!-- Stop actions -->
                <div class="stop-actions">
                  @if (stop.status === 'upcoming') {
                    <button mat-stroked-button style="font-size:12px;height:30px;line-height:30px" (click)="setStopStatus(stop,'current')">Mark Current</button>
                  }
                  @if (stop.status === 'current') {
                    <button mat-stroked-button style="font-size:12px;height:30px;line-height:30px" (click)="setStopStatus(stop,'completed')">Mark Completed</button>
                  }
                  <button mat-icon-button style="width:30px;height:30px" (click)="startEditStop(stop)" title="Edit stop">
                    <mat-icon style="font-size:16px">edit</mat-icon>
                  </button>
                </div>

              </div>
            }
          </div>

          <!-- AI Trip Summary -->
          @if (t.status === 'active' || t.status === 'completed') {
            <div class="ai-panel">
              <button mat-stroked-button style="width:100%" (click)="generateSummary()" [disabled]="summaryLoading()">
                <mat-icon>auto_awesome</mat-icon>
                {{ summaryLoading() ? 'Generating…' : 'AI Trip Summary' }}
              </button>
              @if (summaryText()) {
                <div class="ai-box">{{ summaryText() }}</div>
                <button mat-stroked-button color="primary" style="margin-top:8px;width:100%" (click)="saveAsJournal()">
                  <mat-icon>menu_book</mat-icon> Save as Journal Entry
                </button>
              }
            </div>
          }

          <!-- Bottom tabs -->
          <mat-divider style="margin-top:16px" />
          <mat-tab-group animationDuration="150ms" class="bottom-tabs">
            <mat-tab label="Stops"><app-trip-stops-tab [tripId]="t.id" /></mat-tab>
            <mat-tab label="Expenses"><app-trip-expenses-tab [tripId]="t.id" [budget]="t.total_budget ?? null" /></mat-tab>
            <mat-tab label="Packing"><app-trip-packing-tab [tripId]="t.id" [tripName]="t.name" /></mat-tab>
            <mat-tab label="Journal"><app-trip-journal-tab [tripId]="t.id" /></mat-tab>
            <mat-tab label="Fuel"><app-trip-fuel-tab [tripId]="t.id" /></mat-tab>
          </mat-tab-group>

        </div>

        <!-- ── RIGHT PANEL: Map ──────────────────────────────────── -->
        <div class="right-panel">
          <div #mapEl class="map-el"></div>
          <button mat-mini-fab class="map-fab" (click)="recenterMap()" title="Recenter on current stop">
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
  private stopSvc    = inject(StopService);
  private lodgingSvc = inject(LodgingService);
  private journalSvc = inject(JournalService);
  private claudeSvc  = inject(ClaudeService);
  private geoSvc     = inject(GeocodingService);
  private snack      = inject(MatSnackBar);
  private ngZone     = inject(NgZone);
  private fb         = inject(FormBuilder);

  loading            = signal(true);
  summaryLoading     = signal(false);
  summaryText        = signal('');
  geocodingInProgress = signal(false);
  editingStopId      = signal<number | null>(null);
  savingStop         = signal(false);
  cityLodgings       = signal<Lodging[]>([]);

  private tripSig = signal<Trip | null>(null);
  protected get t(): Trip | null { return this.tripSig(); }

  sortedStops = computed(() =>
    [...(this.tripSig()?.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order),
  );

  readonly STOP_STATUS_COLOR = STOP_STATUS_COLOR;

  editStopForm = this.fb.group({
    arrival_date:   [null as Date | null],
    departure_date: [null as Date | null],
    notes:          [''],
  });

  private map?: L.Map;
  private routeLayer = L.layerGroup();
  // Local coordinates cache for stops that may lack DB lat/lon
  private coordCache = new Map<number, { lat: number; lon: number }>();

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (t) => {
        this.tripSig.set(t);
        this.loading.set(false);
        this.geocodeMissingStops(t);
      },
      error: () => { this.loading.set(false); this.router.navigate(['/trips']); },
    });
  }

  ngAfterViewInit() {
    const checkInterval = setInterval(() => {
      if (!this.loading() && this.mapEl) {
        clearInterval(checkInterval);
        this.ngZone.runOutsideAngular(() => this.initMap());
      }
    }, 100);
  }

  ngOnDestroy() { this.map?.remove(); }

  // ── Geocode stops that lack coordinates ───────────────────────────────────
  private async geocodeMissingStops(t: Trip) {
    const missing = (t.stops ?? []).filter(
      (s) => s.destination && s.destination.latitude == null,
    );
    if (!missing.length) return;

    this.geocodingInProgress.set(true);
    for (const stop of missing) {
      const d = stop.destination!;
      const result = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
        this.geoSvc.lookup(d.city, d.state_province, 'USA').subscribe({
          next: (r) => resolve(r ? { lat: r.lat, lon: r.lon } : null),
          error: () => resolve(null),
        });
      });
      if (result) this.coordCache.set(stop.id, result);
    }
    this.geocodingInProgress.set(false);

    // Redraw map with newly geocoded coordinates
    this.ngZone.runOutsideAngular(() => this.drawRoute());
  }

  private stopCoords(stop: TripStop): [number, number] | null {
    const d = stop.destination;
    if (d?.latitude && d?.longitude) return [Number(d.latitude), Number(d.longitude)];
    const cached = this.coordCache.get(stop.id);
    if (cached) return [cached.lat, cached.lon];
    return null;
  }

  // ── Map ───────────────────────────────────────────────────────────────────
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

    const stops = this.sortedStops();
    const positioned = stops
      .map((s) => ({ stop: s, coords: this.stopCoords(s) }))
      .filter((x) => x.coords !== null) as { stop: TripStop; coords: [number, number] }[];

    if (!positioned.length) return;

    const latlngs = positioned.map((x) => x.coords);

    // Route polyline
    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: '#00695C', weight: 3, dashArray: '10,8', opacity: .85 })
        .addTo(this.routeLayer);
    }

    // Stop markers
    for (const { stop, coords } of positioned) {
      const popupHtml = `
        <strong>${stop.destination?.name ?? 'Stop ' + stop.stop_order}</strong><br/>
        <small>${stop.destination?.city ?? ''}, ${stop.destination?.state_province ?? ''}</small><br/>
        <small>Status: <b>${stop.status}</b></small>
        ${stop.arrival_date  ? '<br/><small>Arrive: '  + stop.arrival_date  + '</small>' : ''}
        ${stop.departure_date? '<br/><small>Depart: '  + stop.departure_date+ '</small>' : ''}
        ${stop.lodging ? '<br/><small>🏨 ' + stop.lodging.name + '</small>' : ''}
      `;
      L.marker(coords, { icon: stopMarkerIcon(stop) })
        .bindPopup(popupHtml)
        .addTo(this.routeLayer);

      // Lodging marker if it has coordinates
      if (stop.lodging?.latitude && stop.lodging?.longitude) {
        L.marker([Number(stop.lodging.latitude), Number(stop.lodging.longitude)], { icon: lodgingIcon() })
          .bindPopup(`<strong>🏨 ${stop.lodging.name}</strong><br/><small>${stop.lodging.address ?? ''}</small>`)
          .addTo(this.routeLayer);
      }
    }

    // Fit to route
    if (latlngs.length > 1) {
      this.map.fitBounds(latlngs, { padding: [50, 50], maxZoom: 10 });
    } else {
      this.map.setView(latlngs[0], 10);
    }
  }

  recenterMap() {
    const current = this.sortedStops().find((s) => s.status === 'current')
      ?? this.sortedStops()[0];
    if (!current) return;
    const coords = this.stopCoords(current);
    if (coords && this.map) this.map.setView(coords, 11);
  }

  // ── Inline stop editing ───────────────────────────────────────────────────
  startEditStop(stop: TripStop) {
    if (this.editingStopId() === stop.id) {
      this.editingStopId.set(null);
      return;
    }
    this.editStopForm.patchValue({
      arrival_date:   stop.arrival_date   ? new Date(stop.arrival_date)   : null,
      departure_date: stop.departure_date ? new Date(stop.departure_date) : null,
      notes: stop.notes ?? '',
    });
    this.editingStopId.set(stop.id);
    // Load lodging options for this stop's city
    const city = stop.destination?.city;
    if (city) {
      this.lodgingSvc.list().subscribe((all) =>
        this.cityLodgings.set(all.filter((l) => l.city.toLowerCase() === city.toLowerCase())),
      );
    }
  }

  saveStopEdit(stop: TripStop) {
    this.savingStop.set(true);
    const v = this.editStopForm.getRawValue();
    const fmtDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : null;
    this.stopSvc.update(this.tripSig()!.id, stop.id, {
      destination_id: stop.destination_id ?? null,
      lodging_id:     stop.lodging_id     ?? null,
      stop_order:     stop.stop_order,
      status:         stop.status,
      arrival_date:   fmtDate(v.arrival_date as Date | null),
      departure_date: fmtDate(v.departure_date as Date | null),
      notes:          v.notes ?? null,
    }).subscribe({
      next: () => {
        this.savingStop.set(false);
        this.editingStopId.set(null);
        this.reload();
      },
      error: () => {
        this.snack.open('Save failed', 'Dismiss', { duration: 3000 });
        this.savingStop.set(false);
      },
    });
  }

  changeLodging(stop: TripStop, lodgingId: number | null) {
    const v = this.editStopForm.getRawValue();
    const fmtDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : null;
    this.stopSvc.update(this.tripSig()!.id, stop.id, {
      destination_id: stop.destination_id ?? null,
      lodging_id: lodgingId,
      stop_order: stop.stop_order,
      status: stop.status,
      arrival_date: fmtDate(v.arrival_date as Date | null) ?? stop.arrival_date ?? null,
      departure_date: fmtDate(v.departure_date as Date | null) ?? stop.departure_date ?? null,
      notes: v.notes ?? stop.notes ?? null,
    }).subscribe(() => this.reload());
  }

  private reload() {
    this.svc.get(this.tripSig()!.id).subscribe((t) => {
      this.tripSig.set(t);
      this.ngZone.runOutsideAngular(() => this.drawRoute());
    });
  }

  // ── Stop status ───────────────────────────────────────────────────────────
  setStopStatus(stop: TripStop, status: 'current' | 'completed') {
    fetch(`/api/trips/${this.tripSig()!.id}/stops/${stop.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(() => this.reload());
  }

  // ── Trip status ───────────────────────────────────────────────────────────
  setStatus(status: TripStatus) {
    this.svc.updateStatus(this.tripSig()!.id, status).subscribe({
      next: (t) => this.tripSig.update((cur) => ({ ...cur!, status: t.status })),
      error: () => this.snack.open('Status update failed', 'Dismiss', { duration: 3000 }),
    });
  }

  // ── AI summary ────────────────────────────────────────────────────────────
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

  lodgingAddress(stop: TripStop): string | null {
    return stop.lodging?.address ?? null;
  }
}
