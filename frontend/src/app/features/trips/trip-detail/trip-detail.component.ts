import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed, viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DatePipe, CurrencyPipe, TitleCasePipe, DecimalPipe, SlicePipe,
} from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { GoogleMap, MapAdvancedMarker, MapDirectionsRenderer, MapInfoWindow } from '@angular/google-maps';
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
import { RestaurantService } from '../../../core/services/restaurant.service';
import { SpecialInterestService } from '../../../core/services/special-interest.service';
import { JournalService } from '../../../core/services/journal.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { MapsService } from '../../../core/services/maps.service';
import { parseApiDate } from '../../../core/utils/date.utils';
import { stopAddress, stopCoords as resolveStopCoords, redactStreetNumber } from '../../../core/utils/stop-location.util';
import {
  Trip, TripStatus, TripStop, TripExpense, TripJournalEntry, Lodging, Restaurant, SpecialInterestPlace,
} from '../../../types/schema.types';
import { AddStopSheetComponent } from '../../../shared/components/add-stop-sheet/add-stop-sheet.component';
import { PlacesAutocompleteComponent, PlaceSelectedEvent } from '../../../shared/components/places-autocomplete/places-autocomplete.component';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { TripStopsTabComponent }   from '../trip-stops-tab/trip-stops-tab.component';
import { TripExpensesTabComponent } from '../trip-expenses-tab/trip-expenses-tab.component';
import { TripPackingTabComponent }  from '../trip-packing-tab/trip-packing-tab.component';
import { TripJournalTabComponent }  from '../trip-journal-tab/trip-journal-tab.component';
import { TripFuelTabComponent }     from '../trip-fuel-tab/trip-fuel-tab.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

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

function stopMarkerEl(stop: TripStop): HTMLElement {
  const color = STOP_STATUS_COLOR[stop.status] ?? '#9e9e9e';
  const type  = stop.place_type ?? 'city';
  const el = document.createElement('div');
  const badge = (emoji: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26">
    <rect x="2" y="2" width="22" height="22" rx="5" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="13" y="18" font-size="13" text-anchor="middle" fill="white">${emoji}</text></svg>`;
  if (type === 'hotel') {
    el.innerHTML = badge('🏨');
  } else if (type === 'rental' || type === 'residence') {
    el.innerHTML = badge('🏠');
  } else if (type === 'campsite') {
    el.innerHTML = badge('⛺');
  } else {
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
      <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="14" y="19" font-family="Arial" font-size="11" font-weight="bold"
            fill="white" text-anchor="middle">${stop.stop_order}</text></svg>`;
  }
  return el.firstElementChild as HTMLElement;
}

function homeMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26">
    <circle cx="13" cy="13" r="12" fill="#37474F" stroke="white" stroke-width="2"/>
    <text x="13" y="18" font-size="13" text-anchor="middle" fill="white">🏠</text></svg>`;
  return el.firstElementChild as HTMLElement;
}

function lodgingMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <rect x="2" y="2" width="20" height="20" rx="4" fill="#6a1b9a" stroke="white" stroke-width="2"/>
    <text x="12" y="17" font-size="13" text-anchor="middle" fill="white">🏨</text></svg>`;
  return el.firstElementChild as HTMLElement;
}

function restaurantMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <rect x="2" y="2" width="20" height="20" rx="4" fill="#FF8F00" stroke="white" stroke-width="2"/>
    <text x="12" y="17" font-size="13" text-anchor="middle" fill="white">🍴</text></svg>`;
  return el.firstElementChild as HTMLElement;
}

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule,
    DatePipe, CurrencyPipe, TitleCasePipe, DecimalPipe, SlicePipe,
    GoogleMap, MapAdvancedMarker, MapDirectionsRenderer, MapInfoWindow,
    MatCardModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    TripStopsTabComponent, TripExpensesTabComponent,
    TripPackingTabComponent, TripJournalTabComponent, TripFuelTabComponent,
    PageHeaderComponent, PlacesAutocompleteComponent,
  ],
  styles: [`
    :host { display:block; }

    // Shared
    .loading-wrap { display:flex; justify-content:center; padding:80px; }
    .status-pill  { padding:3px 10px; border-radius:10px; font-size:12px; font-weight:600;
                    background:var(--wp-surface-variant); text-transform:capitalize; }
    .return-yes-sm { font-size:11px; font-weight:700; color:#2E7D32;
                     background:#E8F5E9; padding:1px 6px; border-radius:8px; }
    .planning-banner {
      display:flex; align-items:center; gap:8px; margin-top:12px;
      padding:8px 12px; border-radius:8px; background:var(--wp-surface-variant);
      font-size:12px; color:var(--wp-text-secondary); line-height:1.4;
    }
    .planning-banner mat-icon { flex-shrink:0; font-size:18px; width:18px; height:18px; color:var(--wp-primary); }

    // SCRAPBOOK LAYOUT (completed trips)
    .scrapbook { max-width:960px; margin:0 auto; padding:0 0 48px; }

    // Hero
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

    // Map strip
    .scrap-map-strip {
      border-radius:12px; overflow:hidden; margin-bottom:24px;
      box-shadow:0 2px 8px rgba(0,0,0,.10);
    }

    // Timeline
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

    // Scrapbook summary + tabs
    .scrap-ai  { margin:24px 0; }
    .ai-box    { background:var(--wp-surface-variant); border-left:3px solid var(--wp-accent);
                 border-radius:0 8px 8px 0; padding:16px; font-size:14px; line-height:1.8;
                 white-space:pre-wrap; margin-top:12px; }
    .scrap-tabs { margin-top:24px; background:var(--wp-surface); border-radius:12px;
                  border:1px solid var(--wp-border); overflow:hidden; }

    // COMPANION LAYOUT (active / planning trips)
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
    .stop-directions-btn { margin:6px 14px 4px; width:calc(100% - 28px); }
    .edit-form { padding:12px 14px; background:var(--wp-surface-variant); }
    .edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 10px; }
    .edit-full { grid-column:1/-1; }
    .places-panel { margin:8px 14px; padding:12px; border-radius:8px; background:var(--wp-surface-variant); }
    .places-section { margin-bottom:16px; }
    .places-section:last-child { margin-bottom:0; }
    .places-section-title { font-size:13px; font-weight:600; margin:0 0 8px; }
    .place-option { display:flex; align-items:center; gap:10px; padding:8px; border-radius:6px; cursor:pointer; margin-bottom:4px; }
    .place-option:hover { background:var(--wp-surface); }
    .place-option.selected { background:var(--wp-primary); color:#fff; }
    .place-option.selected .place-sub { color:rgba(255,255,255,.7); }
    .place-sub { font-size:12px; color:var(--wp-text-hint); }
    .place-search-label { font-size:12px; color:var(--wp-text-hint); margin:8px 0 4px; }
    .place-chip { font-size:12px; background:var(--wp-surface-variant); padding:2px 6px 2px 8px;
                  border-radius:8px; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; }
    .chip-remove { border:none; background:none; cursor:pointer; padding:0 2px; font-size:12px;
                   line-height:1; color:var(--wp-text-hint); }
    .chip-remove:hover { color:#b71c1c; }
    .right-panel { position:relative; overflow:hidden; }
    .map-recenter { position:absolute; bottom:20px; right:16px; z-index:1000;
                    background:var(--wp-surface) !important; box-shadow:0 2px 8px var(--wp-shadow) !important; }
    .ai-panel { padding:12px 14px 0; }
    .companion-ai-box { margin-top:10px; padding:12px; border-radius:8px; background:var(--wp-surface-variant);
               border-left:3px solid var(--wp-accent); font-size:14px; line-height:1.7; white-space:pre-wrap; }
    .bottom-tabs { border-top:1px solid var(--wp-border); }
    /* Allow tab headers to scroll horizontally on narrow screens */
    .bottom-tabs ::ng-deep .mat-mdc-tab-header,
    .scrap-tabs  ::ng-deep .mat-mdc-tab-header {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .bottom-tabs ::ng-deep .mat-mdc-tab-header::-webkit-scrollbar,
    .scrap-tabs  ::ng-deep .mat-mdc-tab-header::-webkit-scrollbar { display: none; }
    .bottom-tabs ::ng-deep .mat-mdc-tab-list,
    .scrap-tabs  ::ng-deep .mat-mdc-tab-list { min-width: max-content; overflow: visible !important; }
    /* Fade gradient indicating more tabs to the right */
    .tab-scroll-wrap { position: relative; }
    .tab-scroll-wrap::after {
      content: ''; pointer-events: none;
      position: absolute; top: 0; right: 0;
      width: 32px; height: 48px;
      background: linear-gradient(to right, transparent, var(--wp-surface));
      z-index: 2;
    }
    .geocoding-note { font-size:12px; color:var(--wp-text-hint); text-align:center; padding:8px; }

    // Map tab — compact prompt that opens a full-screen map overlay
    .map-tab-prompt {
      display:flex; flex-direction:column; align-items:center; text-align:center;
      gap:12px; padding:48px 24px;
    }
    .map-tab-icon { font-size:48px; height:48px; width:48px; color:var(--wp-primary); opacity:.45; }
    .map-tab-text { font-size:14px; color:var(--wp-text-secondary); max-width:320px; margin:0; line-height:1.5; }
    .open-map-btn { background:#00695C !important; color:#fff !important; }

    // Full-screen overlay — escapes companion-layout's overflow:hidden via position:fixed
    .map-overlay {
      position:fixed; inset:0; z-index:1000; background:var(--wp-bg);
      display:flex; flex-direction:column;
    }
    .map-overlay-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 8px 10px 16px; background:var(--wp-surface);
      border-bottom:1px solid var(--wp-border); flex:0 0 auto;
    }
    .map-overlay-title { font-size:16px; font-weight:700; }
    .map-overlay-body { flex:1 1 auto; position:relative; min-height:0; }
    .map-overlay .stop-strip { flex:0 0 auto; }
    .map-overlay .add-stop-btn { flex:0 0 auto; }

    .stop-strip {
      display:flex; gap:10px; overflow-x:auto; padding:12px;
      -webkit-overflow-scrolling:touch;
    }
    .strip-card {
      flex:0 0 auto; min-width:150px; padding:10px 12px; border-radius:10px;
      background:var(--wp-surface); border:2px solid var(--wp-border); cursor:pointer;
      transition:border-color .2s;
    }
    .strip-card.active { border-color:#1565c0; box-shadow:0 0 0 1px #1565c0; }
    .strip-card.status-current {
      background:#00695C; border-color:#00695C;
    }
    .strip-card.status-current .strip-num,
    .strip-card.status-current .strip-city,
    .strip-card.status-current .strip-dates { color:#fff; }
    .strip-card.status-completed { border-color:#2e7d32; }
    .strip-num   { font-size:11px; font-weight:700; color:var(--wp-text-hint); text-transform:uppercase; letter-spacing:.04em; }
    .strip-city  { font-size:14px; font-weight:600; margin:2px 0; }
    .strip-check { color:#2e7d32; font-weight:700; }
    .status-current .strip-check { color:#fff; }
    .strip-dates { font-size:12px; color:var(--wp-text-secondary); margin-bottom:4px; }
    .add-stop-btn { margin:0 12px 12px; background:#00695C !important; color:#fff !important; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (t) {

      <app-page-header [title]="isJournalRoute() ? 'Journal' : 'Trip'" [backRoute]="headerBackRoute()" />

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
                    {{ t.start_date | date:'MMMM d':'UTC' }} – {{ t.end_date | date:'MMMM d, y':'UTC' }}
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
                @if (originMarker(); as m) {
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
                        {{ stopDisplayName(stop) }}
                      </h3>
                      @if (stop.arrival_date || stop.departure_date) {
                        <span class="tl-dates">
                          {{ stop.arrival_date | date:'MMM d':'UTC' }}@if (stop.departure_date) { – {{ stop.departure_date | date:'MMM d':'UTC' }}}
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
          <div class="scrap-tabs tab-scroll-wrap">
            <mat-tab-group animationDuration="150ms" mat-stretch-tabs="false">
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
                @if (t.start_date) { {{ t.start_date | date:'MMM d':'UTC' }} }
                @if (t.start_date && t.end_date) { → }
                @if (t.end_date) { {{ t.end_date | date:'MMM d, y':'UTC' }} }
                @if (!t.start_date && !t.end_date) { Dates not set }
              </p>
              <div class="header-meta">
                <span class="status-pill" [style.color]="statusColor(t.status)">{{ t.status }}</span>
                @if (t.total_budget) {
                  <span style="font-size:12px;color:var(--wp-text-hint)">{{ t.total_budget | currency:'USD':'symbol':'1.0-0' }} budget</span>
                }
                @if (routeStats()) {
                  <span style="font-size:12px;color:var(--wp-text-hint)">
                    {{ routeStats()!.distanceMi | number:'1.0-0' }} mi · {{ driveLbl(routeStats()!.durationMin) }}
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
                <div class="planning-banner">
                  <mat-icon>edit_road</mat-icon>
                  <span>Still planning? You can adjust your route, stops, and order anytime.</span>
                </div>
                <button mat-stroked-button style="margin-top:8px;width:100%" [routerLink]="['/trips', t.id, 'edit-wizard']">
                  <mat-icon>edit_road</mat-icon> Edit Route & Stops
                </button>
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
                    <span class="stop-city">{{ stopDisplayName(stop) }}</span>
                    <span class="status-pill" [style.color]="STOP_STATUS_COLOR[stop.status]">{{ stop.status }}</span>
                    <button mat-icon-button style="width:30px;height:30px;flex-shrink:0;line-height:30px" (click)="onStopFocused(stop)" title="View on map">
                      <mat-icon style="font-size:18px">map</mat-icon>
                    </button>
                  </div>
                  @if (stopLocationText(stop); as loc) {
                    <p class="stop-row" style="color:var(--wp-text-hint)">
                      <mat-icon>place</mat-icon>{{ loc }}
                    </p>
                  }
                  @if (stop.arrival_date || stop.departure_date) {
                    <p class="stop-row">
                      <mat-icon>calendar_today</mat-icon>
                      @if (stop.arrival_date)   { Arrive {{ stop.arrival_date | date:'MMM d':'UTC' }} }
                      @if (stop.arrival_date && stop.departure_date) { → }
                      @if (stop.departure_date) { Depart {{ stop.departure_date | date:'MMM d':'UTC' }} }
                    </p>
                  }
                  @if (stop.drive_minutes_from_prev && stop.drive_minutes_from_prev > 0) {
                    <p class="stop-row" style="color:var(--wp-text-hint)">
                      <mat-icon>directions_car</mat-icon>
                      {{ driveLbl(stop.drive_minutes_from_prev) }} drive
                      @if (stop.estimated_fuel_cost) {
                        &nbsp;·&nbsp;~{{ stop.estimated_fuel_cost | currency:'USD':'symbol':'1.0-0' }} fuel
                      }
                    </p>
                  }
                  @if (stop.gas_stop_before) {
                    <p class="stop-row gas-flag"><mat-icon>local_gas_station</mat-icon> Fill up before leaving</p>
                  }
                  @switch (stop.place_type ?? 'city') {
                    @case ('hotel') {
                      <p class="stop-row"><mat-icon>hotel</mat-icon>
                        <span>
                          <strong>{{ stopDisplayName(stop) }}</strong>
                          @if (stop.lodging?.phone) {
                            <br/><span style="font-size:12px;color:var(--wp-text-hint)">{{ stop.lodging!.phone }}</span>
                          }
                          @if (stop.lodging?.website) {
                            <br/><a [href]="stop.lodging!.website" target="_blank" style="font-size:12px">Website</a>
                          }
                          @if (stop.lodging?.price_per_night) {
                            <span style="font-size:12px;color:var(--wp-primary);margin-left:6px">{{ stop.lodging!.price_per_night | currency:'USD':'symbol':'1.0-0' }}/night</span>
                          }
                        </span>
                      </p>
                      @if (stopDirectionsUrl(stop); as dirUrl) {
                        <a mat-stroked-button color="primary" class="stop-directions-btn" [href]="dirUrl" target="_blank" rel="noopener">
                          <mat-icon>directions</mat-icon> Get Directions
                        </a>
                      }
                    }
                    @case ('rental') {
                      <p class="stop-row" style="color:var(--wp-text-hint)"><mat-icon>cottage</mat-icon> Vacation rental — this is your lodging</p>
                      @if (stopDirectionsUrl(stop); as dirUrl) {
                        <a mat-stroked-button color="primary" class="stop-directions-btn" [href]="dirUrl" target="_blank" rel="noopener">
                          <mat-icon>directions</mat-icon> Get Directions
                        </a>
                      }
                    }
                    @case ('residence') {
                      <p class="stop-row" style="color:var(--wp-text-hint)"><mat-icon>home</mat-icon> Staying at a residence — this is your lodging</p>
                    }
                    @case ('campsite') {
                      <p class="stop-row" style="color:var(--wp-text-hint)"><mat-icon>cabin</mat-icon> Campsite — this is your lodging</p>
                    }
                    @case ('city') {
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
                      } @else if (!stop.lodging_id) {
                        <p class="stop-row" style="color:var(--wp-text-hint)"><mat-icon>hotel</mat-icon> No lodging set</p>
                      }
                    }
                  }

                  @if (stop.status === 'current' && nextStopDirectionsUrl(stop); as dirUrl) {
                    <a mat-stroked-button color="primary" class="stop-directions-btn" [href]="dirUrl" target="_blank" rel="noopener">
                      <mat-icon>directions</mat-icon> Get Directions to Next Stop
                    </a>
                  }

                  @if (stop.restaurants?.length) {
                    <div class="stop-row" style="align-items:flex-start;flex-wrap:wrap;gap:4px;padding:4px 14px 6px">
                      <mat-icon style="margin-top:2px">restaurant</mat-icon>
                      @for (tr of stop.restaurants!; track tr.id) {
                        @if (tr.restaurant; as r) {
                          <span class="place-chip">
                            {{ r.name }}@if (r.cuisine_type) { · {{ r.cuisine_type }}}
                            @if (editingStopId() === stop.id) {
                              <button type="button" class="chip-remove" (click)="removeRestaurant(stop, tr.id)" title="Remove">✕</button>
                            }
                          </span>
                        }
                      }
                    </div>
                  }

                  @if (stop.special_interests?.length) {
                    <div class="stop-row" style="align-items:flex-start;flex-wrap:wrap;gap:4px;padding:4px 14px 6px">
                      <mat-icon style="margin-top:2px">attractions</mat-icon>
                      @for (tsi of stop.special_interests!; track tsi.id) {
                        @if (tsi.special_interest; as si) {
                          <span class="place-chip">
                            {{ si.name }}@if (si.category) { · {{ si.category }}}
                            @if (editingStopId() === stop.id) {
                              <button type="button" class="chip-remove" (click)="removeSpecialInterest(stop, tsi.id)" title="Remove">✕</button>
                            }
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
                    <div class="places-panel">
                      <!-- Lodging -->
                      <div class="places-section">
                        <p class="places-section-title">Lodging</p>
                        <div class="place-option" [class.selected]="!stop.lodging_id" (click)="changeLodging(stop, null)">
                          <mat-icon>hotel_outlined</mat-icon><span>None — I'll decide later</span>
                        </div>
                        @for (l of cityLodgings(); track l.id) {
                          <div class="place-option" [class.selected]="stop.lodging_id === l.id" (click)="changeLodging(stop, l.id)">
                            <mat-icon>hotel</mat-icon>
                            <div>
                              <div>{{ l.name }}</div>
                              <div class="place-sub">{{ l.lodging_type | titlecase }}
                                @if (l.price_per_night) { · {{ l.price_per_night | currency:'USD':'symbol':'1.0-0' }}/night }
                              </div>
                            </div>
                          </div>
                        }
                        <p class="place-search-label">Search for a new place</p>
                        <app-places-autocomplete [types]="[]" placeholder="Search a hotel, motel, campground…"
                          (placeSelected)="onNewLodgingSelected(stop, $event)" />
                      </div>

                      <!-- Restaurants -->
                      <div class="places-section">
                        <p class="places-section-title">Restaurants</p>
                        @for (r of availableRestaurants(stop); track r.id) {
                          <div class="place-option" (click)="addExistingRestaurant(stop, r.id)">
                            <mat-icon>restaurant</mat-icon>
                            <div>
                              <div>{{ r.name }}</div>
                              @if (r.cuisine_type) { <div class="place-sub">{{ r.cuisine_type }}</div> }
                            </div>
                          </div>
                        }
                        <p class="place-search-label">Search for a new place</p>
                        <app-places-autocomplete [types]="[]" placeholder="Search a restaurant…"
                          (placeSelected)="onNewRestaurantSelected(stop, $event)" />
                      </div>

                      <!-- Special Interests -->
                      <div class="places-section">
                        <p class="places-section-title">Special Interests</p>
                        @for (s of availableSpecialInterests(stop); track s.id) {
                          <div class="place-option" (click)="addExistingSpecialInterest(stop, s.id)">
                            <mat-icon>attractions</mat-icon>
                            <div>
                              <div>{{ s.name }}</div>
                              @if (s.category) { <div class="place-sub">{{ s.category }}</div> }
                            </div>
                          </div>
                        }
                        <p class="place-search-label">Search for a new place</p>
                        <app-places-autocomplete [types]="[]" placeholder="Search an attraction, landmark…"
                          (placeSelected)="onNewSpecialInterestSelected(stop, $event)" />
                      </div>
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
            <div class="tab-scroll-wrap">
            <mat-tab-group animationDuration="150ms" class="bottom-tabs" mat-stretch-tabs="false">
              <mat-tab label="Stops"><app-trip-stops-tab [tripId]="t.id" (stopFocused)="onStopFocused($event)" /></mat-tab>
              <mat-tab label="Map">
                <div class="map-tab-prompt">
                  <mat-icon class="map-tab-icon">map</mat-icon>
                  <p class="map-tab-text">View your full route, numbered stops, lodging and restaurants on an interactive map.</p>
                  <button mat-raised-button class="open-map-btn" (click)="mapOverlayOpen.set(true)">
                    <mat-icon>fullscreen</mat-icon> Open Trip Map
                  </button>
                </div>
              </mat-tab>
              <mat-tab label="Expenses"><app-trip-expenses-tab [tripId]="t.id" [budget]="t.total_budget ?? null" /></mat-tab>
              <mat-tab label="Packing"><app-trip-packing-tab [tripId]="t.id" [tripName]="t.name" /></mat-tab>
              <mat-tab label="Journal"><app-trip-journal-tab [tripId]="t.id" /></mat-tab>
              <mat-tab label="Fuel"><app-trip-fuel-tab [tripId]="t.id" /></mat-tab>
            </mat-tab-group>
            </div><!-- /tab-scroll-wrap -->
          </div><!-- /left-panel -->

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
              @if (originMarker(); as m) {
                <map-advanced-marker [position]="m.position" [content]="m.content" [title]="m.title" [zIndex]="m.zIndex" />
              }
            </google-map>
            <button mat-mini-fab class="map-recenter" (click)="recenterMap()" title="Recenter">
              <mat-icon>my_location</mat-icon>
            </button>
          </div>

        </div>

        <!-- ── Full-screen Map overlay (mobile-friendly map view) ── -->
        @if (mapOverlayOpen()) {
          <div class="map-overlay">
            <div class="map-overlay-header">
              <span class="map-overlay-title">{{ t.name }} — Map</span>
              <button mat-icon-button (click)="mapOverlayOpen.set(false)" title="Close map">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="map-overlay-body">
              <google-map #mapTabGmap height="100%" width="100%"
                          [center]="mapCenter()" [zoom]="mapZoom()" [options]="mapOptions"
                          (mapInitialized)="onMapInitialized()">
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
                @for (m of restaurantMarkers(); track m.title) {
                  <map-advanced-marker [position]="m.position" [content]="m.content" [title]="m.title" [zIndex]="m.zIndex" />
                }
                @if (originMarker(); as m) {
                  <map-advanced-marker [position]="m.position" [content]="m.content" [title]="m.title" [zIndex]="m.zIndex" />
                }
                <map-info-window #mapTabInfo>
                  @if (selectedMapStop(); as s) {
                    <div style="min-width:160px;font-family:Roboto,sans-serif;padding:2px">
                      <strong style="font-size:14px">{{ s.destination?.name ?? ('Stop ' + s.stop_order) }}</strong><br/>
                      <small style="color:#666">{{ s.destination?.city }}{{ s.destination?.city && s.destination?.state_province ? ', ' : '' }}{{ s.destination?.state_province }}</small>
                    </div>
                  }
                </map-info-window>
              </google-map>
            </div>

            <div class="stop-strip">
              @for (s of sortedStops(); track s.id) {
                <div class="strip-card"
                     [class.active]="selectedMapStop()?.id === s.id"
                     [class.status-current]="s.status === 'current'"
                     [class.status-completed]="s.status === 'completed'"
                     (click)="flyToStop(s)">
                  <div class="strip-num">Stop {{ s.stop_order }}</div>
                  <div class="strip-city">
                    {{ s.destination?.city || s.destination?.name || ('Stop ' + s.stop_order) }}
                    @if (s.status === 'completed') { <span class="strip-check">✓</span> }
                  </div>
                  @if (s.arrival_date || s.departure_date) {
                    <div class="strip-dates">
                      {{ s.arrival_date ? (s.arrival_date | date:'MMM d':'UTC') : '' }}
                      {{ s.arrival_date && s.departure_date ? '→' : '' }}
                      {{ s.departure_date ? (s.departure_date | date:'MMM d':'UTC') : '' }}
                    </div>
                  }
                </div>
              }
            </div>

            <button mat-raised-button class="add-stop-btn" (click)="openAddStop()">
              <mat-icon>add_location_alt</mat-icon> Add Stop
            </button>
          </div>
        }
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
  private restaurantSvc = inject(RestaurantService);
  private specialInterestSvc = inject(SpecialInterestService);
  private journalSvc = inject(JournalService);
  private claudeSvc  = inject(ClaudeService);
  private geoSvc     = inject(GeocodingService);
  private mapsSvc    = inject(MapsService);
  private snack      = inject(MatSnackBar);
  private fb         = inject(FormBuilder);
  private bottomSheet = inject(MatBottomSheet);

  mapOverlayOpen = signal(false);
  mapTabGmap = viewChild<GoogleMap>('mapTabGmap');
  mapTabInfo = viewChild<MapInfoWindow>('mapTabInfo');
  selectedMapStop = signal<TripStop | null>(null);
  private pendingFocusStop = signal<TripStop | null>(null);

  loading             = signal(true);
  summaryLoading      = signal(false);
  summaryText         = signal('');
  geocodingInProgress = signal(false);
  editingStopId       = signal<number | null>(null);
  savingStop          = signal(false);
  cityLodgings        = signal<Lodging[]>([]);
  cityRestaurants     = signal<Restaurant[]>([]);
  citySpecialInterests = signal<SpecialInterestPlace[]>([]);
  routeStats          = signal<{ distanceMi: number; durationMin: number } | null>(null);
  directionsResult    = signal<google.maps.DirectionsResult | null>(null);

  private coordCache = new Map<number, { lat: number; lng: number }>();
  originCoords = signal<google.maps.LatLngLiteral | null>(null);
  private tripSig    = signal<Trip | null>(null);
  protected get t(): Trip | null { return this.tripSig(); }

  isJournalRoute = signal(false);
  headerBackRoute = computed(() => {
    const id = this.tripSig()?.id;
    return this.isJournalRoute() && id ? `/trips/${id}` : '/trips';
  });

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
        const a = parseApiDate(s.arrival_date);
        const d = parseApiDate(s.departure_date);
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
        title:    x.stop.display_name ?? x.stop.destination?.name ?? `Stop ${x.stop.stop_order}`,
        content:  stopMarkerEl(x.stop),
        zIndex:   10,
      })),
  );

  originMarker = computed(() => {
    const pos = this.originCoords();
    return pos ? { position: pos, content: homeMarkerEl(), title: 'Home', zIndex: 8 } : null;
  });

  lodgingMarkers = computed(() =>
    this.sortedStops()
      // Hotel-type stops already render a 🏨 marker at their own location via stopMarkers
      .filter(s => (s.place_type ?? 'city') === 'city' && s.lodging?.latitude && s.lodging?.longitude)
      .map(s => ({
        title:    s.lodging!.name,
        position: { lat: Number(s.lodging!.latitude), lng: Number(s.lodging!.longitude) },
        content:  lodgingMarkerEl(),
        zIndex:   5,
      })),
  );

  restaurantMarkers = computed(() =>
    this.sortedStops()
      .flatMap(s => s.restaurants ?? [])
      .map(tr => tr.restaurant)
      .filter((r): r is NonNullable<typeof r> => !!r?.latitude && !!r?.longitude)
      .map(r => ({
        title:    r.name,
        position: { lat: Number(r.latitude), lng: Number(r.longitude) },
        content:  restaurantMarkerEl(),
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
    this.isJournalRoute.set(this.route.snapshot.url.some((seg) => seg.path === 'journal'));
    this.svc.get(id).subscribe({
      next: (t) => { this.tripSig.set(t); this.loading.set(false); this.geocodeAndRoute(t); },
      error: () => { this.loading.set(false); this.router.navigate(['/trips']); },
    });
  }

  private async geocodeAndRoute(t: Trip) {
    // Geocode any stops that have neither a specific place location nor destination coordinates
    const missing = (t.stops ?? []).filter(s => resolveStopCoords(s) === null && s.destination);
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

    if (t.origin_address) {
      this.mapsSvc.geocode(t.origin_address).subscribe(r => this.originCoords.set(r));
    }

    const sorted = this.sortedStops();
    if (!sorted.length) return;

    // Build direction addresses: origin (home) → each stop's specific place/city → (end at origin if round trip)
    const stopAddresses = sorted
      .map(s => stopAddress(s))
      .filter(Boolean) as string[];

    if (stopAddresses.length === 0) return;

    const addresses: string[] = t.origin_address
      ? [t.origin_address, ...stopAddresses]
      : stopAddresses;

    if (addresses.length >= 2) {
      this.mapsSvc.loadDirectionsFromAddresses(addresses).subscribe(result => {
        this.directionsResult.set(result);
        if (result?.routes?.[0]?.legs) {
          const totalDistM = result.routes[0].legs.reduce((s, l) => s + l.distance!.value, 0);
          const totalDurS  = result.routes[0].legs.reduce((s, l) => s + l.duration!.value, 0);
          this.routeStats.set({
            distanceMi: Math.round((totalDistM / 1000) * 0.621371),
            durationMin: Math.round(totalDurS / 60),
          });
        }
      });
    }
  }

  private stopCoords(stop: TripStop): google.maps.LatLngLiteral | null {
    return resolveStopCoords(stop) ?? this.coordCache.get(stop.id) ?? null;
  }

  recenterMap() { /* mapCenter computed is reactive — bound to map center input */ }

  flyToStop(stop: TripStop) {
    const coords = this.stopCoords(stop);
    const map  = this.mapTabGmap()?.googleMap;
    const info = this.mapTabInfo()?.infoWindow;
    if (!coords || !map || !info) return;
    this.selectedMapStop.set(stop);
    map.panTo(coords);
    map.setZoom(Math.max(map.getZoom() ?? 9, 10));
    info.setPosition(coords);
    info.open(map);
  }

  /** Opens the map overlay (if needed) and flies to the given stop, e.g. from the Stops tab. */
  onStopFocused(stop: TripStop) {
    this.mapOverlayOpen.set(true);
    if (this.mapTabGmap()?.googleMap) {
      this.flyToStop(stop);
    } else {
      this.pendingFocusStop.set(stop);
    }
  }

  /** Fired once the overlay's google-map finishes initializing — flies to any pending focus request. */
  onMapInitialized() {
    this.tryFlyToPendingFocus();
  }

  private tryFlyToPendingFocus(attemptsLeft = 20) {
    const pending = this.pendingFocusStop();
    if (!pending) return;
    if (this.mapTabGmap()?.googleMap && this.mapTabInfo()?.infoWindow) {
      this.pendingFocusStop.set(null);
      this.flyToStop(pending);
    } else if (attemptsLeft > 0) {
      setTimeout(() => this.tryFlyToPendingFocus(attemptsLeft - 1), 100);
    } else {
      this.pendingFocusStop.set(null);
    }
  }

  openAddStop() {
    const trip = this.tripSig(); if (!trip) return;
    const stops = this.sortedStops();
    this.bottomSheet.open(AddStopSheetComponent, { data: { tripId: trip.id, nextOrder: stops.length + 1, stops } })
      .afterDismissed().subscribe((added) => { if (added) this.reload(); });
  }

  startEditStop(stop: TripStop) {
    if (this.editingStopId() === stop.id) { this.editingStopId.set(null); return; }
    this.editStopForm.patchValue({
      arrival_date:   stop.arrival_date   ? parseApiDate(stop.arrival_date)   : null,
      departure_date: stop.departure_date ? parseApiDate(stop.departure_date) : null,
      notes: stop.notes ?? '',
    });
    this.editingStopId.set(stop.id);
    const city = stop.destination?.city;
    if (city) {
      this.lodgingSvc.list().subscribe(all =>
        this.cityLodgings.set(all.filter(l => l.city.toLowerCase() === city.toLowerCase())),
      );
      this.restaurantSvc.list().subscribe(all =>
        this.cityRestaurants.set(all.filter(r => r.city.toLowerCase() === city.toLowerCase())),
      );
      this.specialInterestSvc.list().subscribe(all =>
        this.citySpecialInterests.set(all.filter(s => s.city.toLowerCase() === city.toLowerCase())),
      );
    } else {
      this.cityLodgings.set([]);
      this.cityRestaurants.set([]);
      this.citySpecialInterests.set([]);
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

  isLinkedRestaurant(stop: TripStop, restaurantId: number): boolean {
    return (stop.restaurants ?? []).some(tr => tr.restaurant_id === restaurantId);
  }

  isLinkedSpecialInterest(stop: TripStop, specialInterestId: number): boolean {
    return (stop.special_interests ?? []).some(tsi => tsi.special_interest_id === specialInterestId);
  }

  availableRestaurants(stop: TripStop): Restaurant[] {
    return this.cityRestaurants().filter(r => !this.isLinkedRestaurant(stop, r.id));
  }

  availableSpecialInterests(stop: TripStop): SpecialInterestPlace[] {
    return this.citySpecialInterests().filter(s => !this.isLinkedSpecialInterest(stop, s.id));
  }

  addExistingRestaurant(stop: TripStop, restaurantId: number) {
    this.stopSvc.addRestaurant(this.tripSig()!.id, stop.id, restaurantId).subscribe(() => this.reload());
  }

  addExistingSpecialInterest(stop: TripStop, specialInterestId: number) {
    this.stopSvc.addSpecialInterest(this.tripSig()!.id, stop.id, specialInterestId).subscribe(() => this.reload());
  }

  removeRestaurant(stop: TripStop, linkId: number) {
    this.stopSvc.removeRestaurant(this.tripSig()!.id, stop.id, linkId).subscribe(() => this.reload());
  }

  removeSpecialInterest(stop: TripStop, linkId: number) {
    this.stopSvc.removeSpecialInterest(this.tripSig()!.id, stop.id, linkId).subscribe(() => this.reload());
  }

  onNewLodgingSelected(stop: TripStop, e: PlaceSelectedEvent) {
    this.lodgingSvc.create({
      name: e.name, city: e.city, state_province: e.state_province, country: e.country,
      address: e.formatted_address, latitude: e.lat, longitude: e.lng,
      lodging_type: 'hotel', website: e.website, phone: e.phone, pet_friendly: false,
    }).subscribe(newLodging => this.changeLodging(stop, newLodging.id));
  }

  onNewRestaurantSelected(stop: TripStop, e: PlaceSelectedEvent) {
    this.restaurantSvc.create({
      name: e.name, city: e.city, state_province: e.state_province, country: e.country,
      address: e.formatted_address, latitude: e.lat, longitude: e.lng,
      website: e.website, phone: e.phone, pet_friendly: false,
    }).subscribe(newRestaurant => this.addExistingRestaurant(stop, newRestaurant.id));
  }

  onNewSpecialInterestSelected(stop: TripStop, e: PlaceSelectedEvent) {
    this.specialInterestSvc.create({
      name: e.name, city: e.city, state_province: e.state_province, country: e.country,
      address: e.formatted_address, latitude: e.lat, longitude: e.lng,
      website: e.website, phone: e.phone,
    }).subscribe(newSI => this.addExistingSpecialInterest(stop, newSI.id));
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

  driveLbl(mins: number): string {
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }

  statusColor(s: TripStatus): string { return STATUS_COLOR[s] ?? '#666'; }
  lodgingAddress(stop: TripStop): string | null { return stop.lodging?.address ?? null; }

  stopDisplayName(stop: TripStop): string {
    if (stop.display_name) return stop.display_name;
    if (stop.place_type === 'rental') return 'Beach House';
    return `Stop ${stop.stop_order}`;
  }

  stopLocationText(stop: TripStop): string | null {
    const addr = stopAddress(stop);
    if (!addr) return null;
    return (stop.place_type === 'rental' || stop.place_type === 'residence') ? redactStreetNumber(addr) : addr;
  }

  /** Google Maps directions URL to this stop's own location (hotel/rental "Get Directions"). */
  stopDirectionsUrl(stop: TripStop): string | null {
    const coords = this.stopCoords(stop);
    if (coords) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;
    }
    const addr = stopAddress(stop);
    return addr ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving` : null;
  }

  /** Google Maps directions URL from this (current) stop to the next stop in the itinerary. */
  nextStopDirectionsUrl(stop: TripStop): string | null {
    const cur = this.stopCoords(stop);
    if (!cur) return null;
    const list = this.sortedStops();
    const idx = list.findIndex(s => s.id === stop.id);
    const next = list[idx + 1] ? this.stopCoords(list[idx + 1]) : null;
    if (!next) return null;
    return `https://www.google.com/maps/dir/?api=1&origin=${cur.lat},${cur.lng}&destination=${next.lat},${next.lng}&travelmode=driving`;
  }
}
