import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DatePipe, CurrencyPipe, TitleCasePipe, DecimalPipe, SlicePipe,
} from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { GoogleMap, MapAdvancedMarker, MapDirectionsRenderer } from '@angular/google-maps';
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
import { MapsService } from '../../../core/services/maps.service';
import {
  Trip, TripStatus, TripStop, TripExpense, TripJournalEntry, Lodging,
} from '../../../types/schema.types';
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
const EXP_COLORS: Record<string, string> = {
  lodging: '#7B1FA2', food: '#E65100', fuel: '#1565C0',
  activities: '#2E7D32', shopping: '#AD1457', other: '#546E7A',
};

function stopMarkerEl(order: number, status: string): HTMLElement {
  const color = STOP_STATUS_COLOR[status] ?? '#9e9e9e';
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="14" y="19" font-family="Arial" font-size="11" font-weight="bold"
          fill="white" text-anchor="middle">${order}</text></svg>`;
  return el.firstElementChild as HTMLElement;
}

function lodgingMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <rect x="2" y="2" width="20" height="20" rx="4" fill="#6a1b9a" stroke="white" stroke-width="2"/>
    <text x="12" y="17" font-size="13" text-anchor="middle" fill="white">🏨</text></svg>`;
  return el.firstElementChild as HTMLElement;
}

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule,
    DatePipe, CurrencyPipe, TitleCasePipe, DecimalPipe, SlicePipe,
    GoogleMap, MapAdvancedMarker, MapDirectionsRenderer,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    TripStopsTabComponent, TripExpensesTabComponent,
    TripPackingTabComponent, TripJournalTabComponent, TripFuelTabComponent,
  ],
  styles: [`
    :host { display:block; }

    /* ── Shared ── */
    .loading-wrap { display:flex; justify-content:center; padding:80px; }
    .status-pill  { padding:3px 10px; border-radius:10px; font-size:12px; font-weight:600;
                    background:var(--wp-surface-variant); text-transform:capitalize; }
    .return-yes-sm { font-size:11px; font-weight:700; color:#2E7D32;
                     background:#E8F5E9; padding:1px 6px; border-radius:8px; }

    /* ════════════════════════════════════════════
       SCRAPBOOK LAYOUT (completed trips)
    ════════════════════════════════════════════ */
    .scrapbook { max-width:960px; margin:0 auto; padding:0 0 48px; }

    /* Hero */
    .scrap-hero {
      width:100%; height:320px; border-radius:16px; overflow:hidden;
      position:relative; margin-bottom:24px;
      background:linear-gradient(135deg, var(--wp-primary) 0%, #4DB6AC 100%);
      background-size:cover; background-position:center;
    }
    .scrap-hero-overlay {
      position:absolute; inset:0;
      background:linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.15) 60%, transparent 100%);
      display:flex; align-items:flex-end; padding:28px;
    }
    .scrap-hero-content { color:#fff; flex:1; }
    .scrap-status-pill {
      display:inline-block; background:rgba(255,255,255,.2); border-radius:20px;
      padding:3px 12px; font-size:11px; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; margin-bottom:10px;
    }
    .scrap-title { font-size:32px; font-weight:800; margin:0 0 4px; line-height:1.2; }
    .scrap-dates { font-size:14px; opacity:.85; margin:0 0 10px; }
    .scrap-hero-stats { display:flex; gap:12px; font-size:13px; opacity:.9; flex-wrap:wrap; margin-bottom:14px; }
    .scrap-hero-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .scrap-btn-white  { background:#fff !important; color:var(--wp-primary) !important; font-weight:700 !important; }
    .scrap-btn-ghost  { border-color:rgba(255,255,255,.5) !important; color:#fff !important; }

    /* Map strip */
    .scrap-map-strip {
      border-radius:12px; overflow:hidden; margin-bottom:24px;
      box-shadow:0 2px 8px rgba(0,0,0,.10);
    }

    /* Timeline */
    .tl-heading { font-size:18px; font-weight:700; margin:0 0 16px; }
    .tl-wrap    { position:relative; }

    .tl-row {
      display:grid; grid-template-columns:36px 1fr; gap:0 14px; position:relative;
    }
    .tl-num-col { display:flex; flex-direction:column; align-items:center; }
    .tl-num {
      width:32px; height:32px; border-radius:50%; background:var(--wp-primary); color:#fff;
      display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700;
      flex-shrink:0; z-index:1;
    }
    .tl-line { flex:1; width:2px; background:var(--wp-border); margin:4px 0; min-height:20px; }

    .tl-card {
      background:var(--wp-surface); border-radius:12px; border:1px solid var(--wp-border);
      overflow:hidden; margin-bottom:6px;
    }
    .tl-card-header {
      padding:14px 16px 10px; border-bottom:1px solid var(--wp-border);
      display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap;
    }
    .tl-city  { font-size:17px; font-weight:700; margin:0; }
    .tl-dates { font-size:12px; color:var(--wp-text-secondary); }

    .tl-section { padding:10px 16px; border-bottom:1px solid var(--wp-border); }
    .tl-section:last-child { border-bottom:none; }
    .tl-section-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em;
                        color:var(--wp-text-hint); margin-bottom:8px; }

    .tl-lodging-row { display:flex; align-items:flex-start; gap:10px; }
    .tl-lodging-icon { font-size:20px; line-height:1; flex-shrink:0; margin-top:2px; }
    .tl-lodging-name { font-size:14px; font-weight:600; }
    .tl-meta { font-size:12px; color:var(--wp-text-secondary); margin-top:2px; }

    .tl-rest-grid { display:flex; flex-wrap:wrap; gap:8px; }
    .tl-rest-card {
      background:var(--wp-bg); border-radius:8px; padding:8px 12px; min-width:140px;
      border:1px solid var(--wp-border);
    }
    .tl-rest-name { font-size:13px; font-weight:600; margin-bottom:4px; }
    .tl-rest-meta { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .tl-tag  { font-size:11px; background:var(--wp-surface-variant); padding:1px 7px; border-radius:8px; color:var(--wp-text-secondary); }
    .tl-star { font-size:12px; }

    .tl-journal-card {
      background:var(--wp-bg); border-left:3px solid var(--wp-accent);
      border-radius:0 8px 8px 0; padding:10px 12px; margin-bottom:6px;
    }
    .tl-journal-title { font-size:13px; font-weight:700; margin-bottom:4px; }
    .tl-journal-body  { font-size:13px; line-height:1.6; color:var(--wp-text-secondary); }

    .tl-exp-row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .tl-exp-total { font-size:13px; font-weight:700; color:var(--wp-primary); }
    .tl-exp-pill {
      font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600;
      background:var(--wp-surface-variant); color:var(--wp-text-secondary);
    }

    .tl-connector {
      display:flex; align-items:center; gap:10px; padding:8px 0 8px 50px;
      color:var(--wp-text-hint); font-size:12px;
    }
    .tl-connector-line { flex:0 0 40px; height:1px; background:var(--wp-border); }

    /* Scrapbook summary + tabs */
    .scrap-ai  { margin:24px 0; }
    .ai-box    { background:var(--wp-surface-variant); border-left:3px solid var(--wp-accent);
                 border-radius:0 8px 8px 0; padding:16px; font-size:14px; line-height:1.8;
                 white-space:pre-wrap; margin-top:12px; }
    .scrap-tabs { margin-top:24px; background:var(--wp-surface); border-radius:12px;
                  border:1px solid var(--wp-border); overflow:hidden; }

    /* ════════════════════════════════════════════
       COMPANION LAYOUT (active / planning trips)
    ════════════════════════════════════════════ */
    .companion-layout {
      display:grid; grid-template-columns:400px 1fr;
      height:calc(100vh - 56px); overflow:hidden;
    }
    @media(max-width:900px) {
      .companion-layout { grid-template-columns:1fr; grid-template-rows:auto 1fr; }
    }
    .left-panel { overflow-y:auto; background:var(--wp-bg); border-right:1px solid var(--wp-border); }
    .trip-header {
      padding:14px 16px; background:var(--wp-surface);
      border-bottom:1px solid var(--wp-border); position:sticky; top:0; z-index:10;
    }
    .trip-name  { font-size:19px; font-weight:700; margin:0 0 2px; }
    .trip-dates { font-size:13px; color:var(--wp-text-secondary); margin:0 0 8px; }
    .header-meta { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .stops-list { padding:10px; }
    .stop-card {
      border-radius:10px; background:var(--wp-surface); margin-bottom:10px;
      border:2px solid var(--wp-border); overflow:hidden; transition:border-color .2s;
    }
    .stop-card.current   { border-color:#1565c0; }
    .stop-card.completed { border-color:#2e7d32; }
    .stop-card.editing   { border-color:var(--wp-accent); }
    .stop-header { display:flex; align-items:center; gap:8px; padding:12px 14px 6px; }
    .stop-num { width:26px;height:26px;border-radius:50%;background:var(--wp-primary);
                color:#fff;display:flex;align-items:center;justify-content:center;
                font-size:11px;font-weight:700;flex-shrink:0; }
    .stop-city { font-size:15px; font-weight:600; flex:1; }
    .stop-row  { padding:2px 14px; font-size:13px; color:var(--wp-text-secondary);
                 display:flex; align-items:center; gap:6px; }
    .stop-row mat-icon { font-size:14px; width:14px; height:14px; flex-shrink:0; }
    .gas-flag  { color:#e65100; font-weight:600; }
    .stop-actions { display:flex; gap:6px; padding:8px 14px;
                    border-top:1px solid var(--wp-divider); flex-wrap:wrap; }
    .edit-form { padding:12px 14px; background:var(--wp-surface-variant); }
    .edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 10px; }
    .edit-full { grid-column:1/-1; }
    .hotel-panel { margin:8px 14px; padding:12px; border-radius:8px; background:var(--wp-surface-variant); }
    .hotel-option { display:flex; align-items:center; gap:10px; padding:8px; border-radius:6px; cursor:pointer; margin-bottom:4px; }
    .hotel-option:hover { background:var(--wp-surface); }
    .hotel-option.selected { background:var(--wp-primary); color:#fff; }
    .hotel-option.selected .hotel-sub { color:rgba(255,255,255,.7); }
    .hotel-sub { font-size:12px; color:var(--wp-text-hint); }
    .right-panel { position:relative; overflow:hidden; }
    .map-recenter { position:absolute; bottom:20px; right:16px; z-index:1000;
                    background:var(--wp-surface) !important; box-shadow:0 2px 8px var(--wp-shadow) !important; }
    .ai-panel { padding:12px 14px 0; }
    .companion-ai-box { margin-top:10px; padding:12px; border-radius:8px; background:var(--wp-surface-variant);
               border-left:3px solid var(--wp-accent); font-size:14px; line-height:1.7; white-space:pre-wrap; }
    .bottom-tabs { border-top:1px solid var(--wp-border); }
    .geocoding-note { font-size:12px; color:var(--wp-text-hint); text-align:center; padding:8px; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (t) {

      <!-- ════════════════════════════════════
           SCRAPBOOK — completed trips
      ════════════════════════════════════ -->
      @if (t.status === 'completed') {
        <div class="scrapbook">

          <!-- Hero -->
          <div class="scrap-hero"
               [style.background-image]="heroPhoto() ? 'url(' + heroPhoto() + ')' : null">
            <div class="scrap-hero-overlay">
              <div class="scrap-hero-content">
                <div class="scrap-status-pill">Completed Trip</div>
                <h1 class="scrap-title">{{ t.name }}</h1>
                @if (t.start_date || t.end_date) {
                  <p class="scrap-dates">
                    {{ t.start_date | date:'MMMM d' }} – {{ t.end_date | date:'MMMM d, y' }}
                  </p>
                }
                <div class="scrap-hero-stats">
                  <span>{{ tripStats().stops }} stops</span>
                  @if (tripStats().nights) { <span>·</span><span>{{ tripStats().nights }} nights</span> }
                  @if (tripStats().states) { <span>·</span><span>{{ tripStats().states }} states</span> }
                  @if (tripStats().totalSpent) {
                    <span>·</span><span>{{ tripStats().totalSpent | currency:'USD':'symbol':'1.0-0' }} spent</span>
                  }
                </div>
                <div class="scrap-hero-actions">
                  <button mat-raised-button class="scrap-btn-white" [routerLink]="['/trips', t.id, 'edit']">
                    <mat-icon>edit</mat-icon> Edit
                  </button>
                  <button mat-stroked-button class="scrap-btn-ghost" (click)="confirmDelete()">
                    <mat-icon>delete</mat-icon> Delete
                  </button>
                  @if (googleMapsUrl()) {
                    <a [href]="googleMapsUrl()!" target="_blank" rel="noopener">
                      <button mat-stroked-button class="scrap-btn-ghost">
                        <mat-icon>map</mat-icon> View in Maps
                      </button>
                    </a>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Route map -->
          @if (sortedStops().length >= 2) {
            <div class="scrap-map-strip">
              <google-map height="240px" width="100%"
                          [center]="mapCenter()" [zoom]="mapZoom()" [options]="mapOptions">
                @if (directionsResult()) {
                  <map-directions-renderer
                    [directions]="directionsResult()!"
                    [options]="{ suppressMarkers:true, polylineOptions:{ strokeColor:'#00695C', strokeOpacity:.85, strokeWeight:4 } }" />
                }
                @for (m of stopMarkers(); track m.stopId) {
                  <map-advanced-marker [position]="m.position" [content]="m.content" [title]="m.title" />
                }
              </google-map>
            </div>
          }

          <!-- Stops timeline -->
          @if (sortedStops().length) {
            <h2 class="tl-heading">Trip Timeline</h2>
            <div class="tl-wrap">
              @for (stop of sortedStops(); track stop.id; let last = $last) {
                <div class="tl-row">
                  <!-- Number + line -->
                  <div class="tl-num-col">
                    <div class="tl-num">{{ stop.stop_order }}</div>
                    @if (!last) { <div class="tl-line"></div> }
                  </div>

                  <!-- Stop card -->
                  <div class="tl-card" style="margin-bottom: 0">
                    <div class="tl-card-header">
                      <h3 class="tl-city">
                        {{ stop.destination?.city ?? ('Stop ' + stop.stop_order) }}@if (stop.destination?.state_province) {, {{ stop.destination!.state_province }}}
                      </h3>
                      @if (stop.arrival_date || stop.departure_date) {
                        <span class="tl-dates">
                          {{ stop.arrival_date | date:'MMM d' }}@if (stop.departure_date) { – {{ stop.departure_date | date:'MMM d' }}}
                        </span>
                      }
                    </div>

                    <!-- Lodging -->
                    @if (stop.lodging; as l) {
                      <div class="tl-section">
                        <div class="tl-section-label">Lodging</div>
                        <div class="tl-lodging-row">
                          <span class="tl-lodging-icon">🏨</span>
                          <div>
                            <div class="tl-lodging-name">{{ l.name }}</div>
                            <div class="tl-meta">
                              {{ l.lodging_type | titlecase }}@if (l.price_per_night) { · {{ l.price_per_night | currency:'USD':'symbol':'1.0-0' }}/night}
                              @if (l.would_return) { &nbsp;<span class="return-yes-sm">✓ Would Return</span> }
                            </div>
                          </div>
                        </div>
                      </div>
                    }

                    <!-- Restaurants -->
                    @if (stop.restaurants?.length) {
                      <div class="tl-section">
                        <div class="tl-section-label">Restaurants</div>
                        <div class="tl-rest-grid">
                          @for (tr of stop.restaurants!; track tr.id) {
                            @if (tr.restaurant; as r) {
                              <div class="tl-rest-card">
                                <div class="tl-rest-name">{{ r.name }}</div>
                                <div class="tl-rest-meta">
                                  @if (r.cuisine_type) { <span class="tl-tag">{{ r.cuisine_type }}</span> }
                                  @for (s of stars(r.rating ?? 0); track $index) {
                                    <span class="tl-star">{{ s ? '⭐' : '' }}</span>
                                  }
                                  @if (r.would_return) { <span class="return-yes-sm">✓</span> }
                                </div>
                              </div>
                            }
                          }
                        </div>
                      </div>
                    }

                    <!-- Journal entries for this stop -->
                    @if (stopJournalsMap().get(stop.id)?.length) {
                      <div class="tl-section">
                        <div class="tl-section-label">Journal</div>
                        @for (j of stopJournalsMap().get(stop.id)!; track j.id) {
                          <div class="tl-journal-card">
                            @if (j.title) { <div class="tl-journal-title">{{ j.title }}</div> }
                            <div class="tl-journal-body">{{ j.body | slice:0:250 }}@if (j.body.length > 250) {…}</div>
                          </div>
                        }
                      </div>
                    }

                    <!-- Expense summary for this stop -->
                    @if (stopExpensesMap().get(stop.id)?.length) {
                      <div class="tl-section">
                        <div class="tl-exp-row">
                          <span class="tl-exp-total">{{ expenseTotal(stop.id) | currency:'USD':'symbol':'1.0-0' }}</span>
                          @for (e of stopExpensesMap().get(stop.id)!.slice(0,4); track e.id) {
                            <span class="tl-exp-pill" [style.background]="expColor(e.category)"
                                  [style.color]="'#fff'">{{ e.category }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- Drive connector -->
                @if (!last) {
                  <div class="tl-connector">
                    <div class="tl-connector-line"></div>
                    <span>Next stop</span>
                  </div>
                }
              }
            </div>
          }

          <!-- AI Trip summary -->
          <div class="scrap-ai">
            @if (!summaryText()) {
              <button mat-stroked-button (click)="generateSummary()" [disabled]="summaryLoading()">
                <mat-icon>auto_awesome</mat-icon>
                {{ summaryLoading() ? 'Generating…' : 'Generate Trip Story' }}
              </button>
            } @else {
              <div class="ai-box">{{ summaryText() }}</div>
              <button mat-stroked-button color="primary" style="margin-top:10px" (click)="saveAsJournal()">
                <mat-icon>menu_book</mat-icon> Save as Journal Entry
              </button>
            }
          </div>

          <!-- Management tabs -->
          <div class="scrap-tabs">
            <mat-tab-group animationDuration="150ms">
              <mat-tab label="Stops"><app-trip-stops-tab [tripId]="t.id" /></mat-tab>
              <mat-tab label="Expenses"><app-trip-expenses-tab [tripId]="t.id" [budget]="t.total_budget ?? null" /></mat-tab>
              <mat-tab label="Packing"><app-trip-packing-tab [tripId]="t.id" [tripName]="t.name" /></mat-tab>
              <mat-tab label="Journal"><app-trip-journal-tab [tripId]="t.id" /></mat-tab>
              <mat-tab label="Fuel"><app-trip-fuel-tab [tripId]="t.id" /></mat-tab>
            </mat-tab-group>
          </div>

        </div>

      <!-- ════════════════════════════════════
           COMPANION — active / planning trips
      ════════════════════════════════════ -->
      } @else {
        <div class="companion-layout">

          <!-- ── LEFT PANEL ── -->
          <div class="left-panel">
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
                @if (routeStats()) {
                  <span style="font-size:12px;color:var(--wp-text-hint)">
                    {{ routeStats()!.distanceKm | number:'1.0-0' }} km · {{ routeStats()!.durationMin | number:'1.0-0' }} min
                  </span>
                }
                <span style="margin-left:auto;display:flex;gap:4px;align-items:center">
                  @if (googleMapsUrl()) {
                    <a [href]="googleMapsUrl()!" target="_blank" rel="noopener">
                      <button mat-icon-button title="Open in Google Maps" style="color:#4285f4">
                        <mat-icon>map</mat-icon>
                      </button>
                    </a>
                  }
                  <button mat-icon-button [routerLink]="['/trips', t.id, 'edit']" title="Edit trip">
                    <mat-icon style="font-size:18px">edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="confirmDelete()" title="Delete">
                    <mat-icon style="font-size:18px">delete</mat-icon>
                  </button>
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
                <p style="text-align:center;color:var(--wp-text-hint);padding:20px;font-size:14px">
                  No stops — use the Stops tab below to plan your route.
                </p>
              }
              @for (stop of sortedStops(); track stop.id) {
                <div class="stop-card"
                     [class.current]="stop.status==='current'"
                     [class.completed]="stop.status==='completed'"
                     [class.editing]="editingStopId()===stop.id">
                  <div class="stop-header">
                    <div class="stop-num">{{ stop.stop_order }}</div>
                    <span class="stop-city">{{ stop.destination?.name ?? ('Stop ' + stop.stop_order) }}</span>
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

                  @if (stop.restaurants?.length) {
                    <div class="stop-row" style="align-items:flex-start;flex-wrap:wrap;gap:4px;padding:4px 14px 6px">
                      <mat-icon style="margin-top:2px">restaurant</mat-icon>
                      @for (tr of stop.restaurants!; track tr.id) {
                        @if (tr.restaurant; as r) {
                          <span style="font-size:12px;background:var(--wp-surface-variant);padding:2px 8px;border-radius:8px;white-space:nowrap">
                            {{ r.name }}@if (r.cuisine_type) { · {{ r.cuisine_type }}}
                          </span>
                        }
                      }
                    </div>
                  }

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
                    <div class="hotel-panel">
                      <p style="font-size:13px;font-weight:600;margin:0 0 8px">Change Hotel</p>
                      @if (cityLodgings().length === 0) {
                        <p style="font-size:12px;color:var(--wp-text-hint)">No lodging in this city yet.
                          <a [routerLink]="['/lodging/new']" style="color:var(--wp-primary)">Add one →</a>
                        </p>
                      } @else {
                        <div class="hotel-option" [class.selected]="!stop.lodging_id" (click)="changeLodging(stop, null)">
                          <mat-icon>hotel_outlined</mat-icon><span>None — I'll decide later</span>
                        </div>
                        @for (l of cityLodgings(); track l.id) {
                          <div class="hotel-option" [class.selected]="stop.lodging_id === l.id" (click)="changeLodging(stop, l.id)">
                            <mat-icon>hotel</mat-icon>
                            <div>
                              <div>{{ l.name }}</div>
                              <div class="hotel-sub">{{ l.lodging_type | titlecase }}
                                @if (l.price_per_night) { · {{ l.price_per_night | currency:'USD':'symbol':'1.0-0' }}/night }
                              </div>
                            </div>
                          </div>
                        }
                      }
                    </div>
                  }

                  <div class="stop-actions">
                    @if (stop.status === 'upcoming') {
                      <button mat-stroked-button style="font-size:12px;height:30px;line-height:30px"
                              (click)="setStopStatus(stop,'current')">Mark Current</button>
                    }
                    @if (stop.status === 'current') {
                      <button mat-stroked-button style="font-size:12px;height:30px;line-height:30px"
                              (click)="setStopStatus(stop,'completed')">Mark Completed</button>
                    }
                    <button mat-icon-button style="width:30px;height:30px" (click)="startEditStop(stop)" title="Edit">
                      <mat-icon style="font-size:16px">edit</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>

            @if (t.status === 'active') {
              <div class="ai-panel">
                <button mat-stroked-button style="width:100%" (click)="generateSummary()" [disabled]="summaryLoading()">
                  <mat-icon>auto_awesome</mat-icon>
                  {{ summaryLoading() ? 'Generating…' : 'AI Trip Summary' }}
                </button>
                @if (summaryText()) {
                  <div class="companion-ai-box">{{ summaryText() }}</div>
                  <button mat-stroked-button color="primary" style="margin-top:8px;width:100%" (click)="saveAsJournal()">
                    <mat-icon>menu_book</mat-icon> Save as Journal Entry
                  </button>
                }
              </div>
            }

            <mat-divider style="margin-top:16px" />
            <mat-tab-group animationDuration="150ms" class="bottom-tabs">
              <mat-tab label="Stops"><app-trip-stops-tab [tripId]="t.id" /></mat-tab>
              <mat-tab label="Expenses"><app-trip-expenses-tab [tripId]="t.id" [budget]="t.total_budget ?? null" /></mat-tab>
              <mat-tab label="Packing"><app-trip-packing-tab [tripId]="t.id" [tripName]="t.name" /></mat-tab>
              <mat-tab label="Journal"><app-trip-journal-tab [tripId]="t.id" /></mat-tab>
              <mat-tab label="Fuel"><app-trip-fuel-tab [tripId]="t.id" /></mat-tab>
            </mat-tab-group>
          </div>

          <!-- ── RIGHT PANEL: Google Map ── -->
          <div class="right-panel">
            <google-map height="100%" width="100%"
                        [center]="mapCenter()" [zoom]="mapZoom()" [options]="mapOptions">
              @if (directionsResult()) {
                <map-directions-renderer
                  [directions]="directionsResult()!"
                  [options]="{ suppressMarkers:true, polylineOptions:{ strokeColor:'#00695C', strokeOpacity:.85, strokeWeight:4 } }" />
              }
              @for (m of stopMarkers(); track m.stopId) {
                <map-advanced-marker [position]="m.position" [content]="m.content" [title]="m.title" [zIndex]="m.zIndex" />
              }
              @for (m of lodgingMarkers(); track m.title) {
                <map-advanced-marker [position]="m.position" [content]="m.content" [title]="m.title" [zIndex]="m.zIndex" />
              }
            </google-map>
            <button mat-mini-fab class="map-recenter" (click)="recenterMap()" title="Recenter">
              <mat-icon>my_location</mat-icon>
            </button>
          </div>

        </div>
      }
    }
  `,
})
export class TripDetailComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private svc        = inject(TripService);
  private stopSvc    = inject(StopService);
  private lodgingSvc = inject(LodgingService);
  private journalSvc = inject(JournalService);
  private claudeSvc  = inject(ClaudeService);
  private geoSvc     = inject(GeocodingService);
  private mapsSvc    = inject(MapsService);
  private snack      = inject(MatSnackBar);
  private fb         = inject(FormBuilder);

  loading             = signal(true);
  summaryLoading      = signal(false);
  summaryText         = signal('');
  geocodingInProgress = signal(false);
  editingStopId       = signal<number | null>(null);
  savingStop          = signal(false);
  cityLodgings        = signal<Lodging[]>([]);
  routeStats          = signal<{ distanceKm: number; durationMin: number } | null>(null);
  directionsResult    = signal<google.maps.DirectionsResult | null>(null);

  private coordCache = new Map<number, { lat: number; lng: number }>();
  private tripSig    = signal<Trip | null>(null);
  protected get t(): Trip | null { return this.tripSig(); }

  sortedStops = computed(() =>
    [...(this.tripSig()?.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order),
  );

  heroPhoto = computed<string | null>(() => {
    for (const stop of this.sortedStops()) {
      const photos = stop.destination?.photos;
      if (photos?.length) {
        return photos.find(p => p.is_primary)?.url ?? photos[0].url;
      }
    }
    return null;
  });

  tripStats = computed(() => {
    const stops = this.sortedStops();
    const trip  = this.tripSig();
    const states = new Set(stops.map(s => s.destination?.state_province).filter(Boolean));
    let nights = 0;
    for (const s of stops) {
      if (s.arrival_date && s.departure_date) {
        const a = new Date(s.arrival_date   + 'T00:00:00');
        const d = new Date(s.departure_date + 'T00:00:00');
        nights += Math.max(0, Math.round((d.getTime() - a.getTime()) / 86_400_000));
      }
    }
    const totalSpent = (trip?.expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    return { stops: stops.length, nights, states: states.size, totalSpent };
  });

  stopExpensesMap = computed(() => {
    const map = new Map<number, TripExpense[]>();
    for (const e of this.tripSig()?.expenses ?? []) {
      if (e.trip_stop_id != null) {
        const arr = map.get(e.trip_stop_id) ?? [];
        arr.push(e);
        map.set(e.trip_stop_id, arr);
      }
    }
    return map;
  });

  stopJournalsMap = computed(() => {
    const map = new Map<number, TripJournalEntry[]>();
    for (const j of this.tripSig()?.journal_entries ?? []) {
      if (j.trip_stop_id != null) {
        const arr = map.get(j.trip_stop_id) ?? [];
        arr.push(j);
        map.set(j.trip_stop_id, arr);
      }
    }
    return map;
  });

  mapCenter = computed<google.maps.LatLngLiteral>(() => {
    const first = this.sortedStops().find(s => this.stopCoords(s) !== null);
    return first ? (this.stopCoords(first) ?? { lat: 39.5, lng: -98.35 }) : { lat: 39.5, lng: -98.35 };
  });

  mapZoom = computed(() => this.sortedStops().length > 1 ? 5 : 9);

  stopMarkers = computed(() =>
    this.sortedStops()
      .map(s => ({ stop: s, pos: this.stopCoords(s) }))
      .filter(x => x.pos !== null)
      .map(x => ({
        stopId:   x.stop.id,
        position: x.pos!,
        title:    x.stop.destination?.name ?? `Stop ${x.stop.stop_order}`,
        content:  stopMarkerEl(x.stop.stop_order, x.stop.status),
        zIndex:   10,
      })),
  );

  lodgingMarkers = computed(() =>
    this.sortedStops()
      .filter(s => s.lodging?.latitude && s.lodging?.longitude)
      .map(s => ({
        title:    s.lodging!.name,
        position: { lat: Number(s.lodging!.latitude), lng: Number(s.lodging!.longitude) },
        content:  lodgingMarkerEl(),
        zIndex:   5,
      })),
  );

  googleMapsUrl = computed(() => {
    const pts = this.sortedStops()
      .map(s => { const c = this.stopCoords(s); return c ? `${c.lat},${c.lng}` : null; })
      .filter(Boolean);
    return pts.length >= 2 ? `https://www.google.com/maps/dir/${pts.join('/')}` : null;
  });

  readonly STOP_STATUS_COLOR = STOP_STATUS_COLOR;
  readonly mapOptions: google.maps.MapOptions = {
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
  };

  editStopForm = this.fb.group({
    arrival_date:   [null as Date | null],
    departure_date: [null as Date | null],
    notes:          [''],
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (t) => { this.tripSig.set(t); this.loading.set(false); this.geocodeAndRoute(t); },
      error: () => { this.loading.set(false); this.router.navigate(['/trips']); },
    });
  }

  private async geocodeAndRoute(t: Trip) {
    // Geocode any stops whose destination lacks coordinates (needed for map markers)
    const missing = (t.stops ?? []).filter(s => s.destination && s.destination.latitude == null);
    if (missing.length) {
      this.geocodingInProgress.set(true);
      for (const stop of missing) {
        const d = stop.destination!;
        const r = await new Promise<{ lat: number; lon: number } | null>(resolve => {
          this.geoSvc.lookup(d.city, d.state_province, 'USA')
            .subscribe({ next: r => resolve(r ? { lat: r.lat, lon: r.lon } : null), error: () => resolve(null) });
        });
        if (r) this.coordCache.set(stop.id, { lat: r.lat, lng: r.lon });
      }
      this.geocodingInProgress.set(false);
    }

    const sorted = this.sortedStops();
    if (!sorted.length) return;

    // Build direction addresses: origin (home) → each stop city → (end at origin if no addresses exist)
    const stopAddresses = sorted
      .map(s => s.destination ? `${s.destination.city}, ${s.destination.state_province}` : null)
      .filter(Boolean) as string[];

    if (stopAddresses.length === 0) return;

    const addresses: string[] = t.origin_address
      ? [t.origin_address, ...stopAddresses]
      : stopAddresses;

    if (addresses.length >= 2) {
      this.mapsSvc.loadDirectionsFromAddresses(addresses).subscribe(result => {
        this.directionsResult.set(result);
        if (result?.routes?.[0]?.legs) {
          const totalDist = result.routes[0].legs.reduce((s, l) => s + l.distance!.value, 0);
          const totalDur  = result.routes[0].legs.reduce((s, l) => s + l.duration!.value, 0);
          this.routeStats.set({ distanceKm: Math.round(totalDist / 1000), durationMin: Math.round(totalDur / 60) });
        }
      });
    }
  }

  private stopCoords(stop: TripStop): google.maps.LatLngLiteral | null {
    const d = stop.destination;
    if (d?.latitude && d?.longitude) return { lat: Number(d.latitude), lng: Number(d.longitude) };
    return this.coordCache.get(stop.id) ?? null;
  }

  recenterMap() { /* mapCenter computed is reactive — bound to map center input */ }

  startEditStop(stop: TripStop) {
    if (this.editingStopId() === stop.id) { this.editingStopId.set(null); return; }
    this.editStopForm.patchValue({
      arrival_date:   stop.arrival_date   ? new Date(stop.arrival_date)   : null,
      departure_date: stop.departure_date ? new Date(stop.departure_date) : null,
      notes: stop.notes ?? '',
    });
    this.editingStopId.set(stop.id);
    const city = stop.destination?.city;
    if (city) {
      this.lodgingSvc.list().subscribe(all =>
        this.cityLodgings.set(all.filter(l => l.city.toLowerCase() === city.toLowerCase())),
      );
    }
  }

  saveStopEdit(stop: TripStop) {
    this.savingStop.set(true);
    const v = this.editStopForm.getRawValue();
    const fmt = (d: Date | null) => d ? d.toISOString().split('T')[0] : null;
    this.stopSvc.update(this.tripSig()!.id, stop.id, {
      destination_id: stop.destination_id ?? null, lodging_id: stop.lodging_id ?? null,
      stop_order: stop.stop_order, status: stop.status,
      arrival_date: fmt(v.arrival_date as Date | null),
      departure_date: fmt(v.departure_date as Date | null),
      notes: v.notes ?? null,
    }).subscribe({
      next: () => { this.savingStop.set(false); this.editingStopId.set(null); this.reload(); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.savingStop.set(false); },
    });
  }

  changeLodging(stop: TripStop, lodgingId: number | null) {
    const v = this.editStopForm.getRawValue();
    const fmt = (d: Date | null) => d ? d.toISOString().split('T')[0] : null;
    this.stopSvc.update(this.tripSig()!.id, stop.id, {
      destination_id: stop.destination_id ?? null, lodging_id: lodgingId,
      stop_order: stop.stop_order, status: stop.status,
      arrival_date: fmt(v.arrival_date as Date | null) ?? stop.arrival_date ?? null,
      departure_date: fmt(v.departure_date as Date | null) ?? stop.departure_date ?? null,
      notes: v.notes ?? stop.notes ?? null,
    }).subscribe(() => this.reload());
  }

  private reload() {
    this.svc.get(this.tripSig()!.id).subscribe(t => {
      this.tripSig.set(t);
      this.geocodeAndRoute(t);
    });
  }

  setStopStatus(stop: TripStop, status: 'current' | 'completed') {
    fetch(`/api/trips/${this.tripSig()!.id}/stops/${stop.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(() => this.reload());
  }

  setStatus(status: TripStatus) {
    this.svc.updateStatus(this.tripSig()!.id, status).subscribe({
      next: t => this.tripSig.update(cur => ({ ...cur!, status: t.status })),
      error: () => this.snack.open('Status update failed', 'Dismiss', { duration: 3000 }),
    });
  }

  generateSummary() {
    const trip = this.tripSig(); if (!trip) return;
    this.summaryLoading.set(true); this.summaryText.set('');
    this.claudeSvc.tripSummary(trip).subscribe({
      next: r => { this.summaryText.set(r.result); this.summaryLoading.set(false); },
      error: () => { this.snack.open('AI failed', 'Dismiss', { duration: 3000 }); this.summaryLoading.set(false); },
    });
  }

  saveAsJournal() {
    const trip = this.tripSig(); if (!trip || !this.summaryText()) return;
    this.journalSvc.create(trip.id, {
      title: `Trip Summary: ${trip.name}`, body: this.summaryText(),
      entry_date: new Date().toISOString().split('T')[0],
    }).subscribe(() => { this.snack.open('Saved!', 'OK', { duration: 2500 }); this.summaryText.set(''); });
  }

  confirmDelete() {
    if (!confirm('Delete this trip?')) return;
    this.svc.delete(this.tripSig()!.id).subscribe(() => this.router.navigate(['/trips']));
  }

  expenseTotal(stopId: number): number {
    return (this.stopExpensesMap().get(stopId) ?? []).reduce((s, e) => s + Number(e.amount), 0);
  }

  expColor(cat: string): string { return EXP_COLORS[cat] ?? '#546E7A'; }

  stars(rating: number): boolean[] {
    return Array.from({ length: Math.round(rating) }, () => true);
  }

  statusColor(s: TripStatus): string { return STATUS_COLOR[s] ?? '#666'; }
  lodgingAddress(stop: TripStop): string | null { return stop.lodging?.address ?? null; }
}
