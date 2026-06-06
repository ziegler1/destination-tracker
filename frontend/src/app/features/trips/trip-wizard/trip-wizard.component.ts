import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy,
  inject, signal, computed,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { GoogleMap, MapDirectionsRenderer } from '@angular/google-maps';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TripWizardService } from '../../../core/services/trip-wizard.service';
import { SettingsService } from '../../../core/services/settings.service';
import { MapsService } from '../../../core/services/maps.service';
import {
  WizardPlan, WizardStop, WizardGenerateRequest, TripType,
} from '../../../types/schema.types';

const CUISINES   = ['BBQ', 'Italian', 'Seafood', 'American', 'Mexican', 'Asian', 'Southern', 'Steakhouse', 'Other'];
const INTERESTS  = ['Historic Sites', 'State Parks', 'National Parks', 'Live Music', 'Scenic Drives', 'Museums', 'Roadside Attractions', 'Wineries/Breweries'];
const LODGING_TYPES = ['hotel', 'motel', 'airbnb', 'resort', 'campground'];
const PROGRESS_MSGS = [
  'Planning your route…',
  'Finding lodging along the way…',
  'Discovering restaurants…',
  'Checking points of interest…',
  'Estimating your budget…',
  'Almost ready…',
];

const TRIP_TYPES: { value: TripType; icon: string; name: string; desc: string }[] = [
  { value: 'one_way',              icon: '➡️',  name: 'One Way',              desc: 'Drive from origin to destination with overnight stops.' },
  { value: 'round_trip',           icon: '🔄',  name: 'Round Trip',           desc: 'Drive there and plan a return route home.' },
  { value: 'based_at_destination', icon: '🏖️', name: 'Based at Destination', desc: 'Stay at destination in your own place; explore locally.' },
];

const STOP_TIMINGS = [
  { value: 'flexible',        label: 'Flexible — no preference' },
  { value: 'morning_depart',  label: 'Early start, arrive by afternoon' },
  { value: 'drive_through',   label: 'Drive most of the day, brief stops' },
  { value: 'evening_arrival', label: 'Depart mid-morning, arrive evening' },
];

@Component({
  selector: 'app-trip-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule, FormsModule,
    DatePipe, CurrencyPipe, TitleCasePipe,
    GoogleMap, MapDirectionsRenderer,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatButtonModule, MatIconModule, MatSlideToggleModule,
    MatSliderModule, MatProgressSpinnerModule, MatDividerModule, MatCheckboxModule,
    MatExpansionModule, MatSnackBarModule, MatTooltipModule,
  ],
  styles: [`
    .wizard-wrap { max-width:900px; margin:0 auto; padding:24px; }
    .step-title  { font-size:22px; font-weight:700; margin:0 0 6px; }
    .step-sub    { color:var(--wp-text-secondary); margin:0 0 24px; }

    /* Step 1 */
    .basics-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
    .full { grid-column:1/-1; }
    .chip-row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
    .chip {
      padding:5px 14px; border-radius:16px; border:1.5px solid var(--wp-border);
      background:var(--wp-surface); cursor:pointer; font-size:13px; transition:all .2s;
    }
    .chip.sel       { background:var(--wp-primary); color:#fff; border-color:var(--wp-primary); }
    .chip.sel-accent{ background:var(--wp-accent); color:#000; border-color:var(--wp-accent); }

    /* Trip type cards */
    .trip-type-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
    .ttc {
      padding:16px 12px; border-radius:10px; border:2px solid var(--wp-border);
      cursor:pointer; transition:all .2s; text-align:center; background:var(--wp-surface);
    }
    .ttc:hover { border-color:var(--wp-primary-light); }
    .ttc.sel   { border-color:var(--wp-primary); background:color-mix(in srgb,var(--wp-primary) 8%,var(--wp-surface)); }
    .ttc-icon  { font-size:26px; display:block; margin-bottom:6px; }
    .ttc-name  { font-size:14px; font-weight:700; margin:0 0 4px; }
    .ttc-desc  { font-size:11px; color:var(--wp-text-secondary); line-height:1.4; margin:0; }

    /* Drive hours slider */
    .slider-row { display:flex; align-items:center; gap:12px; }
    .slider-val { font-size:20px; font-weight:700; color:var(--wp-primary); min-width:36px; text-align:right; }

    /* Step 2 */
    .generating {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      min-height:60vh; gap:24px; text-align:center;
    }
    .gen-icon { font-size:72px; animation:pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
    .gen-msg  { font-size:18px; color:var(--wp-text-secondary); min-height:28px; }

    /* Step 3 */
    .route-map {
      height:340px; border-radius:12px; overflow:hidden;
      border:1px solid var(--wp-border); margin-bottom:20px;
      background:var(--wp-surface-variant); position:relative;
    }
    .map-loading {
      position:absolute; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      background:var(--wp-surface-variant); z-index:1;
      font-size:13px; color:var(--wp-text-secondary);
    }
    .summary-bar {
      display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;
      padding:14px 18px; border-radius:10px; background:var(--wp-surface);
      box-shadow:0 2px 8px var(--wp-shadow);
    }
    .sum-item label { font-size:11px; text-transform:uppercase; letter-spacing:.7px; color:var(--wp-text-hint); display:block; }
    .sum-item span  { font-size:16px; font-weight:700; color:var(--wp-primary); }

    .stop-panel-header { display:flex; align-items:center; width:100%; gap:8px; }
    .stop-header-info  { display:flex; align-items:center; gap:10px; flex-wrap:wrap; flex:1; min-width:0; }
    .stop-city  { font-size:17px; font-weight:700; white-space:nowrap; }
    .stop-dates { font-size:13px; color:var(--wp-text-secondary); }
    .gas-flag   { color:#e65100; font-size:13px; font-weight:600; display:flex; align-items:center; gap:4px; }
    .stop-type-badge { padding:2px 10px; border-radius:12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; }
    .badge-base   { background:#fff8e1; color:#f57f17; border:1px solid #ffe082; }
    .badge-return { background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7; }

    .base-stay-banner {
      padding:14px 18px; border-radius:8px; margin-bottom:16px;
      background:color-mix(in srgb,var(--wp-accent) 10%,var(--wp-surface));
      border-left:4px solid var(--wp-accent);
      font-size:13px; color:var(--wp-text-secondary); line-height:1.5;
    }

    /* Add stop row */
    .add-stop-row { display:flex; align-items:center; justify-content:center; padding:6px 0; }
    .add-stop-btn {
      font-size:12px; color:var(--wp-text-hint); cursor:pointer;
      border:1.5px dashed var(--wp-border); border-radius:20px;
      padding:4px 16px; background:none; transition:all .2s;
      display:flex; align-items:center; gap:4px;
    }
    .add-stop-btn:hover { border-color:var(--wp-primary); color:var(--wp-primary); background:color-mix(in srgb,var(--wp-primary) 5%,transparent); }
    .add-stop-form { display:flex; align-items:center; gap:8px; padding:8px 0; flex-wrap:wrap; }
    .add-stop-form mat-form-field { width:160px; }

    .section-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.8px;
                     color:var(--wp-text-hint); margin:16px 0 10px; }
    .suggestion-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:10px; }
    .suggestion-card {
      border-radius:10px; overflow:hidden; border:2px solid var(--wp-border);
      cursor:pointer; transition:border-color .2s, box-shadow .2s, background .2s;
      background:var(--wp-surface);
    }
    .suggestion-card.selected { border-color:var(--wp-primary); box-shadow:0 0 0 2px var(--wp-primary); background:color-mix(in srgb,var(--wp-primary) 6%,var(--wp-surface)); }
    .suggestion-card.approved  { border-color:#2e7d32; box-shadow:0 0 0 2px #2e7d32; background:color-mix(in srgb,#2e7d32 6%,var(--wp-surface)); }

    .card-photo { width:100%; height:110px; object-fit:cover; display:block;
                  background:linear-gradient(135deg,var(--wp-primary),var(--wp-primary-light)); }
    .card-body  { padding:10px 12px; }
    .card-name  { font-size:14px; font-weight:600; margin:0 0 2px; }
    .card-meta  { font-size:12px; color:var(--wp-text-secondary); margin:0 0 4px; }
    .card-why   { font-size:11px; color:var(--wp-text-hint); line-height:1.4; margin:4px 0 0; }
    .card-rating{ color:#f57f17; font-size:12px; font-weight:600; }
    .google-badge { display:inline-block; padding:1px 6px; border-radius:6px;
                    background:#4285f4; color:#fff; font-size:10px; font-weight:600; margin-left:4px; }

    .pack-section { margin-bottom:16px; }
    .pack-cat-title { font-size:14px; font-weight:600; margin:0 0 6px; }
    .pack-items { display:flex; flex-wrap:wrap; gap:6px; }
    .pack-item-chip {
      padding:3px 10px; border-radius:10px; border:1.5px solid var(--wp-border);
      background:var(--wp-surface); font-size:12px; cursor:pointer; transition:all .2s;
    }
    .pack-item-chip.included { background:var(--wp-surface-variant); text-decoration:line-through; opacity:.5; }

    .budget-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:10px; margin:12px 0; }
    .budget-item { padding:10px 12px; border-radius:8px; background:var(--wp-surface-variant); }
    .budget-item label { font-size:11px; text-transform:uppercase; letter-spacing:.7px; color:var(--wp-text-hint); display:block; }
    .budget-item span  { font-size:16px; font-weight:700; color:var(--wp-primary); }
    .budget-vs { font-size:14px; font-weight:600; margin-top:8px; }
    .under { color:#2e7d32; }
    .over  { color:#c62828; }

    .wizard-actions { display:flex; gap:12px; justify-content:space-between; margin-top:24px; }

    /* Step 4 */
    .confirmed { text-align:center; padding:60px 20px; }
    .confirmed-icon { font-size:72px; display:block; margin-bottom:16px; }
  `],
  template: `
    <div class="wizard-wrap">

      <!-- ── Step 1: Trip Basics ────────────────────────────────────── -->
      @if (step() === 1) {
        <p class="step-title">✈️ Plan a Trip</p>
        <p class="step-sub">Tell us where you're going and Claude will build a complete road trip plan.</p>

        <mat-card style="padding:24px">
          <form [formGroup]="form" (ngSubmit)="generate()">

            <p style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--wp-text-secondary)">Trip type</p>
            <div class="trip-type-grid">
              @for (tt of tripTypes; track tt.value) {
                <div class="ttc" [class.sel]="form.value.trip_type === tt.value"
                     (click)="form.patchValue({ trip_type: tt.value })">
                  <span class="ttc-icon">{{ tt.icon }}</span>
                  <p class="ttc-name">{{ tt.name }}</p>
                  <p class="ttc-desc">{{ tt.desc }}</p>
                </div>
              }
            </div>

            <div class="basics-grid">

              <mat-form-field appearance="outline" class="full">
                <mat-label>Trip name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Nashville Summer Run" />
              </mat-form-field>

              <div>
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Starting from *</mat-label>
                  <input matInput formControlName="origin" placeholder="Address or city" />
                </mat-form-field>
                @if (!form.value.origin) {
                  <button type="button" mat-stroked-button style="margin-top:-8px;margin-bottom:8px;font-size:12px"
                          (click)="useHome()">
                    <mat-icon style="font-size:16px;width:16px;height:16px">home</mat-icon>
                    Use My Home
                  </button>
                }
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Destination *</mat-label>
                <input matInput formControlName="destination" placeholder="Nashville, TN or full address" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Start date *</mat-label>
                <input matInput [matDatepicker]="dp1" formControlName="start_date" />
                <mat-datepicker-toggle matSuffix [for]="dp1" />
                <mat-datepicker #dp1 />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>End date *</mat-label>
                <input matInput [matDatepicker]="dp2" formControlName="end_date" />
                <mat-datepicker-toggle matSuffix [for]="dp2" />
                <mat-datepicker #dp2 />
              </mat-form-field>

              @if (form.value.trip_type === 'based_at_destination') {
                <mat-form-field appearance="outline">
                  <mat-label>Nights at base</mat-label>
                  <input matInput type="number" formControlName="base_nights" min="1" max="30" />
                </mat-form-field>
                <div style="align-self:center;padding-bottom:8px">
                  <mat-slide-toggle formControlName="include_return">Include return leg home</mat-slide-toggle>
                </div>
              }

              <mat-form-field appearance="outline">
                <mat-label>Total budget ($)</mat-label>
                <input matInput type="number" formControlName="budget" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Lodging preference</mat-label>
                <mat-select formControlName="lodging_type">
                  <mat-option value="">Any</mat-option>
                  @for (t of lodgingTypes; track t) {
                    <mat-option [value]="t">{{ t | titlecase }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <div class="full" style="margin:8px 0 4px">
                <p style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--wp-text-secondary)">
                  Max drive hours per day
                </p>
                <div class="slider-row">
                  <span style="font-size:12px;color:var(--wp-text-hint)">2h</span>
                  <mat-slider style="flex:1" [min]="2" [max]="10" [step]="1" discrete>
                    <input matSliderThumb formControlName="drive_hours_per_day" />
                  </mat-slider>
                  <span style="font-size:12px;color:var(--wp-text-hint)">10h</span>
                  <span class="slider-val">{{ form.value.drive_hours_per_day }}h</span>
                </div>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Stop timing preference</mat-label>
                <mat-select formControlName="stop_timing">
                  @for (st of stopTimings; track st.value) {
                    <mat-option [value]="st.value">{{ st.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <div style="align-self:center;padding-bottom:8px">
                <mat-slide-toggle formControlName="pet_friendly">Pet friendly</mat-slide-toggle>
              </div>

              <div class="full" style="margin:4px 0">
                <p style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--wp-text-secondary)">
                  Minimum Google rating for suggestions
                </p>
                <div class="slider-row">
                  <span style="font-size:12px;color:var(--wp-text-hint)">Any</span>
                  <mat-slider style="flex:1" [min]="0" [max]="5" [step]="0.5" discrete>
                    <input matSliderThumb formControlName="min_rating" />
                  </mat-slider>
                  <span style="font-size:12px;color:var(--wp-text-hint)">5.0</span>
                  <span class="slider-val" style="font-size:16px">
                    {{ form.value.min_rating === 0 ? 'Any' : form.value.min_rating + '★' }}
                  </span>
                </div>
              </div>

            </div>

            <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--wp-text-secondary)">Cuisine preferences</p>
            <div class="chip-row">
              @for (c of cuisines; track c) {
                <span class="chip" [class.sel-accent]="selectedCuisines().includes(c)" (click)="toggleChip(selectedCuisines, c)">{{ c }}</span>
              }
            </div>

            <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--wp-text-secondary)">Interests</p>
            <div class="chip-row">
              @for (i of interests; track i) {
                <span class="chip" [class.sel]="selectedInterests().includes(i)" (click)="toggleChip(selectedInterests, i)">{{ i }}</span>
              }
            </div>

            <button mat-raised-button color="primary" type="submit"
                    [disabled]="form.invalid" style="margin-top:16px;width:100%;height:48px;font-size:16px">
              <mat-icon>auto_awesome</mat-icon> Build My Trip
            </button>
          </form>
        </mat-card>
      }

      <!-- ── Step 2: Generating ─────────────────────────────────────── -->
      @if (step() === 2) {
        <div class="generating">
          <span class="gen-icon">✈️</span>
          <mat-spinner diameter="48" />
          <p class="gen-msg">{{ progressMsg() }}</p>
          <p style="font-size:13px;color:var(--wp-text-hint)">Claude is building your trip plan. This takes about 15–25 seconds…</p>
        </div>
      }

      <!-- ── Step 3: Review ─────────────────────────────────────────── -->
      @if (step() === 3 && plan()) {
        <p class="step-title">Review Your Trip</p>
        <p class="step-sub">Delete unwanted stops, add new cities, then pick lodging and restaurants to save.</p>

        <!-- Route map -->
        <div class="route-map">
          @if (!directionsResult()) {
            <div class="map-loading">
              <mat-spinner diameter="36" />
              <span>Loading route map…</span>
            </div>
          }
          <google-map width="100%" height="340px" [options]="mapOpts">
            @if (directionsResult()) {
              <map-directions-renderer [directions]="directionsResult()!" [options]="rendererOpts" />
            }
          </google-map>
        </div>

        <!-- Summary bar -->
        <div class="summary-bar">
          <div class="sum-item"><label>Origin</label><span style="font-size:13px;font-weight:600">{{ form.value.origin }}</span></div>
          <div class="sum-item"><label>Stops</label><span>{{ plan()!.stops.length }}</span></div>
          <div class="sum-item"><label>Drive time</label><span>{{ totalDriveHours() }}h</span></div>
          <div class="sum-item"><label>Est. cost</label><span>{{ plan()!.trip.estimated_costs.total | currency:'USD':'symbol':'1.0-0' }}</span></div>
          <div class="sum-item"><label>Budget</label><span>{{ plan()!.trip.budget | currency:'USD':'symbol':'1.0-0' }}</span></div>
        </div>

        @if (plan()!.trip.travel_notes) {
          <p style="color:var(--wp-text-secondary);font-size:14px;line-height:1.6;margin-bottom:20px;
                    padding:12px 16px;border-radius:8px;background:var(--wp-surface);border-left:3px solid var(--wp-accent)">
            {{ plan()!.trip.travel_notes }}
          </p>
        }

        <!-- Stops -->
        <mat-accordion multi>
          @for (stop of plan()!.stops; track stop.stop_order) {
            <mat-expansion-panel [expanded]="stop.stop_order === 1">
              <mat-expansion-panel-header>
                <div class="stop-panel-header">
                  <div class="stop-header-info">
                    @if (stop.stop_type === 'base') {
                      <span class="stop-type-badge badge-base">🏖️ Base Stay</span>
                    } @else if (stop.stop_type === 'return_transit') {
                      <span class="stop-type-badge badge-return">↩️ Return</span>
                    }
                    <span class="stop-city">Stop {{ stop.stop_order }}: {{ stop.city }}, {{ stop.state_province }}</span>
                    @if (stop.arrive_date) {
                      <span class="stop-dates">{{ stop.arrive_date | date:'MMM d' }} → {{ stop.depart_date | date:'MMM d' }}</span>
                    }
                    @if (stop.drive_minutes_from_prev > 0) {
                      <span style="font-size:12px;color:var(--wp-text-hint)">{{ driveLbl(stop.drive_minutes_from_prev) }} drive</span>
                    }
                    @if (stop.gas_stop_before) {
                      <span class="gas-flag"><mat-icon style="font-size:14px;width:14px;height:14px">local_gas_station</mat-icon> Fuel up</span>
                    }
                  </div>
                  <button mat-icon-button color="warn" style="flex-shrink:0"
                          matTooltip="Remove this stop"
                          (click)="removeStop(stop.stop_order, $event)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </mat-expansion-panel-header>

              @if (stop.stop_type === 'base') {
                <div class="base-stay-banner">
                  🏖️ <strong>Base Stay</strong> — You'll be staying in your own accommodation here. No lodging booking needed.
                </div>
              } @else {
                <p class="section-label">🏨 Lodging — pick one to add (optional)</p>
                <div class="suggestion-grid">
                  @for (s of stop.lodging_suggestions; track $index) {
                    <div class="suggestion-card"
                         [class.selected]="selectedLodging().get(stop.stop_order) === $index"
                         (click)="selectLodging(stop.stop_order, $index)">
                      @if (s.photo_url) {
                        <img class="card-photo" [src]="s.photo_url" [alt]="s.name" (error)="onImgError($event)" />
                      } @else {
                        <div class="card-photo" style="display:flex;align-items:center;justify-content:center;font-size:36px">🏨</div>
                      }
                      <div class="card-body">
                        <p class="card-name">{{ s.name }} @if (s.google_verified) { <span class="google-badge">G</span> }</p>
                        <p class="card-meta">{{ s.area }} · {{ s.lodging_type | titlecase }}</p>
                        <p class="card-meta">~{{ s.estimated_price_per_night | currency:'USD':'symbol':'1.0-0' }}/night</p>
                        @if (s.google_rating) { <p class="card-rating">★ {{ s.google_rating }}</p> }
                        <p class="card-why">{{ s.why_recommended }}</p>
                      </div>
                    </div>
                  }
                  <div class="suggestion-card" style="display:flex;align-items:center;justify-content:center;min-height:80px"
                       [class.selected]="selectedLodging().get(stop.stop_order) === -1"
                       (click)="selectLodging(stop.stop_order, -1)">
                    <p style="font-size:13px;color:var(--wp-text-secondary);text-align:center;padding:12px">I'll add my own later</p>
                  </div>
                </div>
              }

              <p class="section-label">🍽️ Restaurants — click to add</p>
              <div class="suggestion-grid">
                @for (s of stop.restaurant_suggestions; track $index) {
                  <div class="suggestion-card"
                       [class.approved]="isRestApproved(stop.stop_order, $index)"
                       (click)="toggleRest(stop.stop_order, $index)">
                    @if (s.photo_url) {
                      <img class="card-photo" [src]="s.photo_url" [alt]="s.name" (error)="onImgError($event)" />
                    } @else {
                      <div class="card-photo" style="display:flex;align-items:center;justify-content:center;font-size:36px">🍽️</div>
                    }
                    <div class="card-body">
                      <p class="card-name">{{ s.name }} @if (s.google_verified) { <span class="google-badge">G</span> }</p>
                      <p class="card-meta">{{ s.cuisine_type }} · {{ s.price_range }}</p>
                      @if (s.google_rating) { <p class="card-rating">★ {{ s.google_rating }}</p> }
                      <p class="card-why">{{ s.why_recommended }}</p>
                    </div>
                  </div>
                }
              </div>

              <p class="section-label">📍 Points of Interest — click to add</p>
              <div class="suggestion-grid">
                @for (s of stop.poi_suggestions; track $index) {
                  <div class="suggestion-card"
                       [class.approved]="isPoiApproved(stop.stop_order, $index)"
                       (click)="togglePoi(stop.stop_order, $index)">
                    @if (s.photo_url) {
                      <img class="card-photo" [src]="s.photo_url" [alt]="s.name" (error)="onImgError($event)" />
                    } @else {
                      <div class="card-photo" style="display:flex;align-items:center;justify-content:center;font-size:36px">📍</div>
                    }
                    <div class="card-body">
                      <p class="card-name">{{ s.name }} @if (s.google_verified) { <span class="google-badge">G</span> }</p>
                      <p class="card-meta">{{ s.poi_type.replace('_',' ') | titlecase }}</p>
                      <p class="card-why">{{ s.why_recommended }}</p>
                    </div>
                  </div>
                }
              </div>

            </mat-expansion-panel>

            <!-- Add stop between panels -->
            <div class="add-stop-row">
              @if (insertingAfter() === stop.stop_order) {
                <div class="add-stop-form">
                  <mat-form-field appearance="outline" style="width:180px">
                    <mat-label>City</mat-label>
                    <input matInput [(ngModel)]="insertCity" [ngModelOptions]="{standalone:true}"
                           placeholder="Louisville" (keydown.enter)="confirmInsert(stop.stop_order)" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" style="width:80px">
                    <mat-label>State</mat-label>
                    <input matInput [(ngModel)]="insertState" [ngModelOptions]="{standalone:true}"
                           placeholder="KY" maxlength="2" (keydown.enter)="confirmInsert(stop.stop_order)" />
                  </mat-form-field>
                  <button mat-raised-button color="primary" (click)="confirmInsert(stop.stop_order)"
                          [disabled]="!insertCity || !insertState">Insert</button>
                  <button mat-stroked-button (click)="insertingAfter.set(null)">Cancel</button>
                </div>
              } @else {
                <button class="add-stop-btn" (click)="insertingAfter.set(stop.stop_order)">
                  <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                  add stop here
                </button>
              }
            </div>
          }
        </mat-accordion>

        <!-- Packing list -->
        <mat-divider style="margin:24px 0" />
        <p class="step-title" style="font-size:18px">🎒 Packing List</p>
        <p class="step-sub" style="font-size:13px">Click items to exclude them.</p>
        @for (cat of plan()!.trip.packing_suggestions; track cat.category) {
          <div class="pack-section">
            <p class="pack-cat-title">{{ cat.category }}</p>
            <div class="pack-items">
              @for (item of cat.items; track item) {
                <span class="pack-item-chip"
                      [class.included]="isPackExcluded(cat.category, item)"
                      (click)="togglePack(cat.category, item)">{{ item }}</span>
              }
            </div>
          </div>
        }

        <!-- Budget estimate -->
        <mat-divider style="margin:24px 0" />
        <p class="step-title" style="font-size:18px">💰 Budget Estimate</p>
        <div class="budget-grid">
          <div class="budget-item"><label>Lodging</label><span>{{ plan()!.trip.estimated_costs.lodging | currency:'USD':'symbol':'1.0-0' }}</span></div>
          <div class="budget-item"><label>Food</label><span>{{ plan()!.trip.estimated_costs.food | currency:'USD':'symbol':'1.0-0' }}</span></div>
          <div class="budget-item"><label>Fuel</label><span>{{ plan()!.trip.estimated_costs.fuel | currency:'USD':'symbol':'1.0-0' }}</span></div>
          <div class="budget-item"><label>Activities</label><span>{{ plan()!.trip.estimated_costs.activities | currency:'USD':'symbol':'1.0-0' }}</span></div>
          <div class="budget-item"><label>Total</label><span>{{ plan()!.trip.estimated_costs.total | currency:'USD':'symbol':'1.0-0' }}</span></div>
        </div>
        @if (plan()!.trip.budget) {
          <p class="budget-vs" [class.under]="plan()!.trip.estimated_costs.total <= plan()!.trip.budget"
             [class.over]="plan()!.trip.estimated_costs.total > plan()!.trip.budget">
            {{ plan()!.trip.estimated_costs.total <= plan()!.trip.budget
              ? '✓ Within budget by ' + (plan()!.trip.budget - plan()!.trip.estimated_costs.total | currency:'USD':'symbol':'1.0-0')
              : '⚠ Over budget by ' + (plan()!.trip.estimated_costs.total - plan()!.trip.budget | currency:'USD':'symbol':'1.0-0') }}
          </p>
        }

        <div class="wizard-actions">
          <button mat-stroked-button (click)="step.set(1)">← Back</button>
          <button mat-raised-button color="primary" [disabled]="confirming()" (click)="confirm()">
            @if (confirming()) { <mat-spinner diameter="20" style="display:inline-block;margin-right:6px" /> Saving… }
            @else { Looks Good — Save My Trip → }
          </button>
        </div>
      }

      <!-- ── Step 4: Confirmed ──────────────────────────────────────── -->
      @if (step() === 4) {
        <div class="confirmed">
          <span class="confirmed-icon">🎉</span>
          <h2 style="font-size:28px;font-weight:700;margin-bottom:8px">Trip Created!</h2>
          <p style="color:var(--wp-text-secondary);margin-bottom:32px">Your trip is saved and ready for the road.</p>
          <button mat-raised-button color="primary" style="height:48px;font-size:16px"
                  [routerLink]="['/trips', savedTripId()]">
            <mat-icon>map</mat-icon> Open Trip Companion →
          </button>
        </div>
      }

    </div>
  `,
})
export class TripWizardComponent implements OnInit, OnDestroy {
  private wizardSvc   = inject(TripWizardService);
  private snack       = inject(MatSnackBar);
  private router      = inject(Router);
  private fb          = inject(FormBuilder);
  private settingsSvc = inject(SettingsService);
  private mapsSvc     = inject(MapsService);

  // ── Step state ──────────────────────────────────────────────────────
  step        = signal(1);
  plan        = signal<WizardPlan | null>(null);
  savedTripId = signal<number | null>(null);
  confirming  = signal(false);
  progressMsg = signal(PROGRESS_MSGS[0]);

  // ── Map ──────────────────────────────────────────────────────────────
  directionsResult = signal<google.maps.DirectionsResult | null>(null);

  readonly mapOpts: google.maps.MapOptions = {
    mapId:              'DEMO_MAP_ID',
    streetViewControl:  false,
    fullscreenControl:  false,
    mapTypeControl:     false,
    zoomControl:        true,
  };
  readonly rendererOpts: google.maps.DirectionsRendererOptions = {
    polylineOptions: { strokeColor: '#00695C', strokeWeight: 5, strokeOpacity: 0.85 },
  };

  // ── Stop editing ─────────────────────────────────────────────────────
  insertingAfter = signal<number | null>(null);
  insertCity  = '';
  insertState = '';

  // ── Review selection state ──────────────────────────────────────────
  selectedLodging   = signal(new Map<number, number>());
  approvedRests     = signal(new Map<number, Set<number>>());
  approvedPois      = signal(new Map<number, Set<number>>());
  excludedPackItems = signal(new Map<string, Set<string>>());

  // ── Step 1 form ─────────────────────────────────────────────────────
  selectedCuisines  = signal<string[]>([]);
  selectedInterests = signal<string[]>([]);

  readonly cuisines     = CUISINES;
  readonly interests    = INTERESTS;
  readonly lodgingTypes = LODGING_TYPES;
  readonly tripTypes    = TRIP_TYPES;
  readonly stopTimings  = STOP_TIMINGS;

  form = this.fb.group({
    name:                [''],
    origin:              ['', Validators.required],
    destination:         ['', Validators.required],
    start_date:          [null as Date | null, Validators.required],
    end_date:            [null as Date | null, Validators.required],
    budget:              [null as number | null],
    lodging_type:        [''],
    pet_friendly:        [false],
    trip_type:           ['one_way' as TripType],
    drive_hours_per_day: [6],
    stop_timing:         ['flexible'],
    base_nights:         [4],
    include_return:      [true],
    min_rating:          [0],
  });

  ngOnInit() {
    this.settingsSvc.load().subscribe(s => {
      const patch: Record<string, unknown> = {};
      if (s.home_address)      patch['origin']             = s.home_address;
      if (s.drive_hours_per_day) patch['drive_hours_per_day'] = Number(s.drive_hours_per_day);
      this.form.patchValue(patch);
    });
  }

  useHome() {
    const s = this.settingsSvc.settings();
    this.form.patchValue({ origin: s.home_address || '8404 Union Drive, Galloway, Ohio 43119' });
  }

  // ── Progress ticker ─────────────────────────────────────────────────
  private progressInterval?: ReturnType<typeof setInterval>;

  private startProgress() {
    let idx = 0;
    this.progressMsg.set(PROGRESS_MSGS[0]);
    this.progressInterval = setInterval(() => {
      idx = (idx + 1) % PROGRESS_MSGS.length;
      this.progressMsg.set(PROGRESS_MSGS[idx]);
    }, 2500);
  }

  private stopProgress() {
    if (this.progressInterval) { clearInterval(this.progressInterval); }
  }

  ngOnDestroy() { this.stopProgress(); }

  // ── Computed ─────────────────────────────────────────────────────────
  totalDriveHours = computed(() =>
    Math.round((this.plan()?.stops ?? []).reduce((s, st) => s + (st.drive_minutes_from_prev ?? 0), 0) / 60),
  );

  driveLbl(mins: number): string {
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  toggleChip(sig: ReturnType<typeof signal<string[]>>, val: string) {
    sig.update(arr => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  // ── Generate ─────────────────────────────────────────────────────────
  generate() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const payload: WizardGenerateRequest = {
      origin:              v.origin!,
      destination:         v.destination!,
      start_date:          (v.start_date as Date).toISOString().split('T')[0],
      end_date:            (v.end_date   as Date).toISOString().split('T')[0],
      budget:              v.budget ?? 0,
      trip_type:           (v.trip_type as TripType) || 'one_way',
      drive_hours_per_day: v.drive_hours_per_day ?? 6,
      stop_timing:         v.stop_timing || 'flexible',
      base_nights:         v.base_nights ?? 4,
      include_return:      v.include_return ?? true,
      preferences: {
        lodging_type:        v.lodging_type || undefined,
        cuisine_preferences: this.selectedCuisines().length ? this.selectedCuisines() : undefined,
        interests:           this.selectedInterests().length ? this.selectedInterests() : undefined,
        pet_friendly:        v.pet_friendly ?? false,
        min_rating:          v.min_rating ?? 0,
      },
    };

    this.step.set(2);
    this.startProgress();
    this.directionsResult.set(null);

    this.wizardSvc.generate(payload).subscribe({
      next: (result) => {
        this.stopProgress();
        if (v.name) result.trip.name = v.name;
        this.plan.set(result);
        this.initReviewState(result);
        this.computeRoute(result);
        this.step.set(3);
      },
      error: (err) => {
        this.stopProgress();
        this.step.set(1);
        this.snack.open('Generation failed — please try again', 'Dismiss', { duration: 4000 });
        console.error(err);
      },
    });
  }

  // ── Route map ────────────────────────────────────────────────────────
  private computeRoute(plan: WizardPlan) {
    const sorted     = [...plan.stops].sort((a, b) => a.stop_order - b.stop_order);
    const origin     = this.form.value.origin || '';
    const tripType   = this.form.value.trip_type;

    // Build address list: origin → each stop city → (origin if round trip)
    const stopAddresses = sorted.map(s => `${s.city}, ${s.state_province}`);
    const addresses: string[] = [origin, ...stopAddresses];
    if (tripType === 'round_trip' || (tripType === 'based_at_destination' && this.form.value.include_return)) {
      addresses.push(origin);
    }

    this.mapsSvc.loadDirectionsFromAddresses(addresses).subscribe(result => {
      this.directionsResult.set(result);
    });
  }

  // ── Remove a stop ────────────────────────────────────────────────────
  removeStop(stopOrder: number, event: Event) {
    event.stopPropagation();
    const current = this.plan();
    if (!current || current.stops.length <= 1) return;

    const filtered = current.stops
      .filter(s => s.stop_order !== stopOrder)
      .map((s, i) => ({ ...s, stop_order: i + 1 }));

    const updated = { ...current, stops: filtered };
    this.plan.set(updated);
    this.resetReviewState(filtered);
    this.computeRoute(updated);
    this.insertingAfter.set(null);
  }

  // ── Insert a stub stop ───────────────────────────────────────────────
  confirmInsert(afterOrder: number) {
    const city  = this.insertCity.trim();
    const state = this.insertState.trim().toUpperCase();
    if (!city || !state) return;

    const current = this.plan();
    if (!current) return;

    const stub: WizardStop = {
      stop_order:              afterOrder + 1,
      stop_type:               'transit',
      city,
      state_province:          state,
      country:                 'USA',
      arrive_date:             '',
      depart_date:             '',
      drive_minutes_from_prev: 0,
      gas_stop_before:         false,
      estimated_fuel_cost:     0,
      lodging_suggestions:     [],
      restaurant_suggestions:  [],
      poi_suggestions:         [],
    };

    const before = current.stops.filter(s => s.stop_order <= afterOrder);
    const after  = current.stops.filter(s => s.stop_order  > afterOrder);
    const merged = [...before, stub, ...after].map((s, i) => ({ ...s, stop_order: i + 1 }));

    const updated = { ...current, stops: merged };
    this.plan.set(updated);
    this.resetReviewState(merged);
    this.computeRoute(updated);

    this.insertCity  = '';
    this.insertState = '';
    this.insertingAfter.set(null);
  }

  // ── Review state ─────────────────────────────────────────────────────
  private initReviewState(p: WizardPlan) {
    this.resetReviewState(p.stops);
    this.excludedPackItems.set(new Map());
  }

  private resetReviewState(stops: WizardStop[]) {
    const lodgingMap = new Map<number, number>();
    const restMap    = new Map<number, Set<number>>();
    const poiMap     = new Map<number, Set<number>>();
    for (const stop of stops) {
      if (stop.stop_type !== 'base') lodgingMap.set(stop.stop_order, -1);
      restMap.set(stop.stop_order, new Set());
      poiMap.set(stop.stop_order, new Set());
    }
    this.selectedLodging.set(lodgingMap);
    this.approvedRests.set(restMap);
    this.approvedPois.set(poiMap);
  }

  selectLodging(stopOrder: number, idx: number) {
    this.selectedLodging.update(m => { const n = new Map(m); n.set(stopOrder, idx); return n; });
  }

  isRestApproved(stopOrder: number, idx: number) {
    return this.approvedRests().get(stopOrder)?.has(idx) ?? false;
  }
  toggleRest(stopOrder: number, idx: number) {
    this.approvedRests.update(m => {
      const n = new Map(m); const s = new Set(n.get(stopOrder) ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      n.set(stopOrder, s); return n;
    });
  }

  isPoiApproved(stopOrder: number, idx: number) {
    return this.approvedPois().get(stopOrder)?.has(idx) ?? false;
  }
  togglePoi(stopOrder: number, idx: number) {
    this.approvedPois.update(m => {
      const n = new Map(m); const s = new Set(n.get(stopOrder) ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      n.set(stopOrder, s); return n;
    });
  }

  isPackExcluded(cat: string, item: string) {
    return this.excludedPackItems().get(cat)?.has(item) ?? false;
  }
  togglePack(cat: string, item: string) {
    this.excludedPackItems.update(m => {
      const n = new Map(m); const s = new Set(n.get(cat) ?? []);
      s.has(item) ? s.delete(item) : s.add(item);
      n.set(cat, s); return n;
    });
  }

  // ── Confirm & save ───────────────────────────────────────────────────
  confirm() {
    const p = this.plan();
    if (!p) return;
    this.confirming.set(true);

    const payload: WizardPlan = {
      ...p,
      stops: p.stops.map(stop => ({
        ...stop,
        lodging_suggestions: stop.lodging_suggestions.map((s, i) => ({
          ...s, approved: this.selectedLodging().get(stop.stop_order) === i,
        })),
        restaurant_suggestions: stop.restaurant_suggestions.map((s, i) => ({
          ...s, approved: this.isRestApproved(stop.stop_order, i),
        })),
        poi_suggestions: stop.poi_suggestions.map((s, i) => ({
          ...s, approved: this.isPoiApproved(stop.stop_order, i),
        })),
      })),
      trip: {
        ...p.trip,
        packing_suggestions: p.trip.packing_suggestions
          .map(cat => ({ ...cat, items: cat.items.filter(item => !this.isPackExcluded(cat.category, item)) }))
          .filter(cat => cat.items.length > 0),
      },
    };

    this.wizardSvc.confirm(payload).subscribe({
      next: (saved) => { this.savedTripId.set(saved.id); this.confirming.set(false); this.step.set(4); },
      error: () => { this.snack.open('Save failed — please try again', 'Dismiss', { duration: 4000 }); this.confirming.set(false); },
    });
  }

  onImgError(e: Event) { (e.target as HTMLImageElement).style.display = 'none'; }
}
