import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../../shared/components/places-autocomplete/places-autocomplete.component';
import { SettingsService } from '../../core/services/settings.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

const CUISINE_OPTIONS = [
  'American', 'BBQ', 'Bakery / Cafe', 'Breakfast', 'Burgers', 'Chinese',
  'French', 'Italian', 'Japanese', 'Mexican', 'Pizza', 'Seafood',
  'Steakhouse', 'Sushi', 'Thai', 'Vietnamese',
];

const INTEREST_OPTIONS = [
  'Bourbon Distilleries', 'Craft Breweries', 'Wineries',
  'Food Crawls', 'Farmers Markets', 'Historic Hotels',
  'State Parks', 'Scenic Drives', 'Roadside Attractions',
  'National Parks', 'Antique Shops', 'Live Music',
];

function markerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z"
          fill="#00695C" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`;
  return el.firstElementChild as HTMLElement;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, GoogleMap, MapAdvancedMarker,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSliderModule,
    MatChipsModule, MatDividerModule, MatCardModule, MatProgressSpinnerModule,
    PlacesAutocompleteComponent, PageHeaderComponent,
  ],
  styles: [`
    .page { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
    .page-title { font-size: 24px; font-weight: 800; margin: 0 0 24px; color: var(--wp-text-primary); }
    .section {
      background: var(--wp-surface); border-radius: 14px;
      border: 1px solid var(--wp-border);
      margin-bottom: 20px; overflow: hidden;
    }
    .section-header {
      padding: 16px 20px; border-bottom: 1px solid var(--wp-border);
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .9px; color: var(--wp-text-secondary);
    }
    .section-body { padding: 20px; }
    .field-label {
      font-size: 13px; font-weight: 600; color: var(--wp-text-primary);
      margin-bottom: 4px;
    }
    .field-hint { font-size: 12px; color: var(--wp-text-secondary); margin-bottom: 12px; }
    .slider-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    }
    .slider-wrap { flex: 1; }
    .slider-value {
      min-width: 48px; text-align: center;
      font-size: 15px; font-weight: 700; color: var(--wp-primary);
    }
    mat-form-field { width: 100%; margin-bottom: 4px; }
    .chips-wrap { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .chip {
      padding: 6px 14px; border-radius: 20px;
      border: 1px solid var(--wp-border);
      background: var(--wp-surface-variant);
      font-size: 13px; cursor: pointer;
      color: var(--wp-text-primary); transition: all .15s;
    }
    .chip.selected {
      background: var(--wp-primary);
      border-color: var(--wp-primary);
      color: #fff;
    }
    .map-preview {
      border-radius: 10px; overflow: hidden;
      border: 1px solid var(--wp-border); margin-top: 12px;
    }
    .home-addr {
      font-size: 14px; color: var(--wp-text-primary);
      background: var(--wp-surface-variant);
      border-radius: 8px; padding: 10px 12px;
      margin-bottom: 12px;
    }
    .home-addr small { display: block; font-size: 11px; color: var(--wp-text-secondary); margin-bottom: 2px; }
    .save-row { display: flex; justify-content: flex-end; margin-top: 12px; }
    .maint-btn { width: 100%; margin-bottom: 8px; }
    .maint-hint { font-size: 12px; color: var(--wp-text-secondary); margin-top: 4px; }
    .maint-running {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: var(--wp-text-secondary); margin-top: 8px;
    }
  `],
  template: `
    <app-page-header title="Settings" backRoute="/" />
    <div class="page">
      <h1 class="page-title">⚙️ Settings</h1>

      <!-- ── HOME BASE ────────────────────────────────────────────── -->
      <div class="section">
        <div class="section-header">🏠 Home Base</div>
        <div class="section-body">
          <div class="field-label">Your Home Address</div>
          <div class="field-hint">Used as the default trip origin in the Trip Wizard.</div>

          <div class="home-addr">
            <small>Current home:</small>
            {{ svc.settings().home_address }}
          </div>

          <app-places-autocomplete
            placeholder="Search new home address…"
            [types]="['address']"
            (placeSelected)="onHomePlace($event)" />

          @if (homeMarkerPos()) {
            <div class="map-preview">
              <google-map height="180px" width="100%"
                          [center]="homeMarkerPos()!"
                          [zoom]="13"
                          [options]="mapOpts">
                <map-advanced-marker [position]="homeMarkerPos()!" [content]="homePinEl" />
              </google-map>
            </div>
          }
        </div>
      </div>

      <!-- ── TRIP DEFAULTS ────────────────────────────────────────── -->
      <div class="section">
        <div class="section-header">🚗 Trip Defaults</div>
        <div class="section-body">

          <div class="field-label">Default drive time per day</div>
          <div class="slider-row">
            <div class="slider-wrap">
              <mat-slider min="2" max="10" step="1" style="width:100%">
                <input matSliderThumb [(ngModel)]="driveHours" />
              </mat-slider>
            </div>
            <div class="slider-value">{{ driveHours }}h</div>
          </div>

          <div class="field-label">Miles between stops</div>
          <div class="slider-row">
            <div class="slider-wrap">
              <mat-slider min="100" max="300" step="25" style="width:100%">
                <input matSliderThumb [(ngModel)]="stopMiles" />
              </mat-slider>
            </div>
            <div class="slider-value">{{ stopMiles }}mi</div>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Preferred lodging type</mat-label>
            <mat-select [(ngModel)]="preferredLodging">
              <mat-option value="hotel">Hotel</mat-option>
              <mat-option value="motel">Motel</mat-option>
              <mat-option value="airbnb">Airbnb / VRBO</mat-option>
              <mat-option value="resort">Resort</mat-option>
              <mat-option value="campground">Campground</mat-option>
              <mat-option value="any">No preference</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="field-label" style="margin-top:8px">Favorite cuisines</div>
          <div class="chips-wrap">
            @for (c of cuisineOptions; track c) {
              <button type="button" class="chip"
                      [class.selected]="selectedCuisines.has(c)"
                      (click)="toggleCuisine(c)">{{ c }}</button>
            }
          </div>

          <div class="field-label">Travel interests</div>
          <div class="chips-wrap">
            @for (i of interestOptions; track i) {
              <button type="button" class="chip"
                      [class.selected]="selectedInterests.has(i)"
                      (click)="toggleInterest(i)">{{ i }}</button>
            }
          </div>

          <div class="save-row">
            <button mat-raised-button color="primary" [disabled]="saving()" (click)="saveDefaults()">
              {{ saving() ? 'Saving…' : 'Save Defaults' }}
            </button>
          </div>
        </div>
      </div>
      <!-- ── DATA & MAINTENANCE ──────────────────────────────────── -->
      <div class="section">
        <div class="section-header">🗄️ Data &amp; Maintenance</div>
        <div class="section-body">

          <div class="field-label">Fetch Missing Photos</div>
          <div class="field-hint">
            Searches Google Places for photos on destinations, restaurants, lodging,
            and special interest records that don't have an image yet.
          </div>

          <button mat-stroked-button color="primary" class="maint-btn"
                  [disabled]="backfillRunning()"
                  (click)="runBackfill()">
            <mat-icon>image_search</mat-icon>
            Fetch Missing Photos
          </button>

          @if (backfillRunning()) {
            <div class="maint-running">
              <mat-spinner diameter="18" />
              Fetching photos from Google Places… This may take a minute.
            </div>
          }

        </div>
      </div>

    </div>
  `,
})
export class SettingsComponent implements OnInit {
  svc    = inject(SettingsService);
  private snack = inject(MatSnackBar);

  readonly cuisineOptions  = CUISINE_OPTIONS;
  readonly interestOptions = INTEREST_OPTIONS;
  readonly mapOpts: google.maps.MapOptions = {
    mapId: 'DEMO_MAP_ID', mapTypeControl: false,
    streetViewControl: false, fullscreenControl: false,
  };
  readonly homePinEl = markerEl();

  homeMarkerPos   = signal<google.maps.LatLngLiteral | null>(null);
  saving          = signal(false);
  backfillRunning = signal(false);

  driveHours       = 6;
  stopMiles        = 200;
  preferredLodging = 'hotel';
  selectedCuisines  = new Set<string>();
  selectedInterests = new Set<string>();

  ngOnInit() {
    this.svc.load().subscribe(() => {
      const s = this.svc.settings();
      this.driveHours       = parseInt(s.drive_hours_per_day) || 6;
      this.stopMiles        = parseInt(s.stop_interval_miles) || 200;
      this.preferredLodging = s.preferred_lodging_type || 'hotel';
      this.selectedCuisines  = new Set(this.svc.favoriteCuisines());
      this.selectedInterests = new Set(this.svc.travelInterests());
      const lat = parseFloat(s.home_lat);
      const lng = parseFloat(s.home_lng);
      if (lat && lng) this.homeMarkerPos.set({ lat, lng });
    });
  }

  onHomePlace(e: PlaceSelectedEvent) {
    this.homeMarkerPos.set({ lat: e.lat, lng: e.lng });
    this.svc.update({
      home_address:  e.formatted_address,
      home_lat:      String(e.lat),
      home_lng:      String(e.lng),
      home_place_id: e.place_id,
    }).subscribe(() => {
      this.snack.open('Home base updated ✓', undefined, { duration: 2500 });
    });
  }

  toggleCuisine(c: string) {
    if (this.selectedCuisines.has(c)) this.selectedCuisines.delete(c);
    else this.selectedCuisines.add(c);
  }

  toggleInterest(i: string) {
    if (this.selectedInterests.has(i)) this.selectedInterests.delete(i);
    else this.selectedInterests.add(i);
  }

  runBackfill() {
    this.backfillRunning.set(true);
    this.svc.backfillPhotos().subscribe({
      next: (r) => {
        this.backfillRunning.set(false);
        this.snack.open(
          `Done — ${r.total_updated} photo${r.total_updated === 1 ? '' : 's'} added across all records`,
          undefined, { duration: 4000 },
        );
      },
      error: () => {
        this.backfillRunning.set(false);
        this.snack.open('Backfill failed — check Railway logs', undefined, {
          duration: 4000,
          panelClass: ['snack-error'],
        });
      },
    });
  }

  saveDefaults() {
    this.saving.set(true);
    this.svc.update({
      drive_hours_per_day:    String(this.driveHours),
      stop_interval_miles:    String(this.stopMiles),
      preferred_lodging_type: this.preferredLodging,
      favorite_cuisines:      JSON.stringify([...this.selectedCuisines]),
      travel_interests:       JSON.stringify([...this.selectedInterests]),
    }).subscribe({
      next:  () => { this.snack.open('Defaults saved ✓', undefined, { duration: 2500 }); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', undefined, { duration: 3000 }); this.saving.set(false); },
    });
  }
}
