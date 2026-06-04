import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy,
  inject, signal, computed,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TripWizardService } from '../../../core/services/trip-wizard.service';
import {
  WizardPlan, WizardGenerateRequest,
  WizardLodgingSuggestion, WizardRestaurantSuggestion, WizardPoiSuggestion,
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

@Component({
  selector: 'app-trip-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule, DatePipe, CurrencyPipe, TitleCasePipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatButtonModule, MatIconModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatDividerModule, MatCheckboxModule,
    MatExpansionModule, MatSnackBarModule,
  ],
  styles: [`
    .wizard-wrap { max-width:860px; margin:0 auto; padding:24px; }
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
    .chip.sel { background:var(--wp-primary); color:#fff; border-color:var(--wp-primary); }
    .chip.sel-accent { background:var(--wp-accent); color:#000; border-color:var(--wp-accent); }

    /* Step 2 */
    .generating {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      min-height:60vh; gap:24px; text-align:center;
    }
    .gen-icon { font-size:72px; animation:pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
    .gen-msg { font-size:18px; color:var(--wp-text-secondary); min-height:28px; }

    /* Step 3 */
    .summary-bar {
      display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;
      padding:14px 18px; border-radius:10px; background:var(--wp-surface);
      box-shadow:0 2px 8px var(--wp-shadow);
    }
    .sum-item label { font-size:11px; text-transform:uppercase; letter-spacing:.7px; color:var(--wp-text-hint); display:block; }
    .sum-item span  { font-size:16px; font-weight:700; color:var(--wp-primary); }

    .stop-header { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .stop-city   { font-size:17px; font-weight:700; }
    .stop-dates  { font-size:13px; color:var(--wp-text-secondary); }
    .gas-flag    { color:#e65100; font-size:13px; font-weight:600; display:flex; align-items:center; gap:4px; }

    .section-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.8px;
                     color:var(--wp-text-hint); margin:16px 0 10px; }
    .suggestion-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:10px; }

    .suggestion-card {
      border-radius:10px; overflow:hidden; border:2px solid var(--wp-border);
      cursor:pointer; transition:border-color .2s, box-shadow .2s;
      background:var(--wp-surface);
    }
    .suggestion-card.selected { border-color:var(--wp-primary); box-shadow:0 0 0 2px var(--wp-primary); }
    .suggestion-card.approved  { border-color:var(--wp-accent); }
    .suggestion-card.rejected  { opacity:.45; }

    .card-photo { width:100%; height:110px; object-fit:cover; display:block;
                  background:linear-gradient(135deg,var(--wp-primary),var(--wp-primary-light)); }
    .card-body  { padding:10px 12px; }
    .card-name  { font-size:14px; font-weight:600; margin:0 0 2px; }
    .card-meta  { font-size:12px; color:var(--wp-text-secondary); margin:0 0 4px; }
    .card-why   { font-size:11px; color:var(--wp-text-hint); line-height:1.4; margin:4px 0 0; }
    .card-rating { color:#f57f17; font-size:12px; font-weight:600; }
    .google-badge {
      display:inline-block; padding:1px 6px; border-radius:6px;
      background:#4285f4; color:#fff; font-size:10px; font-weight:600; margin-left:4px;
    }
    .card-actions { display:flex; gap:4px; padding:6px 10px; border-top:1px solid var(--wp-divider); }

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
            <div class="basics-grid">

              <mat-form-field appearance="outline" class="full">
                <mat-label>Trip name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Nashville Summer Run" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Origin city *</mat-label>
                <input matInput formControlName="origin" placeholder="Columbus, OH" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Destination city *</mat-label>
                <input matInput formControlName="destination" placeholder="Nashville, TN" />
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

              <mat-form-field appearance="outline" class="full">
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

              <div style="align-self:center">
                <mat-slide-toggle formControlName="pet_friendly">Pet friendly</mat-slide-toggle>
              </div>

            </div>

            <!-- Cuisine chips -->
            <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--wp-text-secondary)">
              Cuisine preferences
            </p>
            <div class="chip-row">
              @for (c of cuisines; track c) {
                <span class="chip" [class.sel-accent]="selectedCuisines().includes(c)" (click)="toggleChip(selectedCuisines, c)">{{ c }}</span>
              }
            </div>

            <!-- Interests chips -->
            <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--wp-text-secondary)">
              Interests
            </p>
            <div class="chip-row">
              @for (i of interests; track i) {
                <span class="chip" [class.sel]="selectedInterests().includes(i)" (click)="toggleChip(selectedInterests, i)">{{ i }}</span>
              }
            </div>

            <button mat-raised-button color="primary" type="submit"
                    [disabled]="form.invalid" style="margin-top:16px;width:100%;height:48px;font-size:16px">
              <mat-icon>auto_awesome</mat-icon>
              Build My Trip
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
          <p style="font-size:13px;color:var(--wp-text-hint)">
            Claude is building your trip plan. This takes about 15–25 seconds…
          </p>
        </div>
      }

      <!-- ── Step 3: Review ─────────────────────────────────────────── -->
      @if (step() === 3 && plan()) {
        <p class="step-title">Review Your Trip</p>
        <p class="step-sub">Approve, reject, or swap suggestions. Only approved items get saved.</p>

        <!-- Summary bar -->
        <div class="summary-bar">
          <div class="sum-item"><label>Stops</label><span>{{ plan()!.stops.length }}</span></div>
          <div class="sum-item"><label>Drive time</label><span>{{ totalDriveHours() }}h</span></div>
          <div class="sum-item"><label>Est. cost</label><span>{{ plan()!.trip.estimated_costs.total | currency:'USD':'symbol':'1.0-0' }}</span></div>
          <div class="sum-item"><label>Budget</label><span>{{ plan()!.trip.budget | currency:'USD':'symbol':'1.0-0' }}</span></div>
        </div>

        @if (plan()!.trip.travel_notes) {
          <p style="color:var(--wp-text-secondary);font-size:14px;line-height:1.6;margin-bottom:20px;
                    padding:12px 16px;border-radius:8px;background:var(--wp-surface);
                    border-left:3px solid var(--wp-accent)">
            {{ plan()!.trip.travel_notes }}
          </p>
        }

        <!-- Stops -->
        <mat-accordion multi>
          @for (stop of plan()!.stops; track stop.stop_order) {
            <mat-expansion-panel [expanded]="stop.stop_order === 1">
              <mat-expansion-panel-header>
                <div class="stop-header">
                  <span class="stop-city">Stop {{ stop.stop_order }}: {{ stop.city }}, {{ stop.state_province }}</span>
                  <span class="stop-dates">{{ stop.arrive_date | date:'MMM d' }} → {{ stop.depart_date | date:'MMM d' }}</span>
                  @if (stop.drive_minutes_from_prev > 0) {
                    <span style="font-size:12px;color:var(--wp-text-hint)">{{ driveLbl(stop.drive_minutes_from_prev) }} drive</span>
                  }
                  @if (stop.gas_stop_before) {
                    <span class="gas-flag"><mat-icon style="font-size:14px;width:14px;height:14px">local_gas_station</mat-icon> Fuel up before</span>
                  }
                </div>
              </mat-expansion-panel-header>

              <!-- Lodging -->
              <p class="section-label">🏨 Lodging — pick one</p>
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
                      <p class="card-name">
                        {{ s.name }}
                        @if (s.google_verified) { <span class="google-badge">G</span> }
                      </p>
                      <p class="card-meta">{{ s.area }} · {{ s.lodging_type | titlecase }}</p>
                      <p class="card-meta">~{{ s.estimated_price_per_night | currency:'USD':'symbol':'1.0-0' }}/night</p>
                      @if (s.google_rating) {
                        <p class="card-rating">★ {{ s.google_rating }}</p>
                      }
                      <p class="card-why">{{ s.why_recommended }}</p>
                    </div>
                  </div>
                }
                <div class="suggestion-card" style="display:flex;align-items:center;justify-content:center;min-height:80px;cursor:pointer"
                     [class.selected]="selectedLodging().get(stop.stop_order) === -1"
                     (click)="selectLodging(stop.stop_order, -1)">
                  <p style="font-size:13px;color:var(--wp-text-secondary);text-align:center;padding:12px">
                    I'll add my own later
                  </p>
                </div>
              </div>

              <!-- Restaurants -->
              <p class="section-label">🍽️ Restaurants — toggle on/off</p>
              <div class="suggestion-grid">
                @for (s of stop.restaurant_suggestions; track $index) {
                  <div class="suggestion-card"
                       [class.approved]="isRestApproved(stop.stop_order, $index)"
                       [class.rejected]="!isRestApproved(stop.stop_order, $index)"
                       (click)="toggleRest(stop.stop_order, $index)">
                    @if (s.photo_url) {
                      <img class="card-photo" [src]="s.photo_url" [alt]="s.name" (error)="onImgError($event)" />
                    } @else {
                      <div class="card-photo" style="display:flex;align-items:center;justify-content:center;font-size:36px">🍽️</div>
                    }
                    <div class="card-body">
                      <p class="card-name">
                        {{ s.name }}
                        @if (s.google_verified) { <span class="google-badge">G</span> }
                      </p>
                      <p class="card-meta">{{ s.cuisine_type }} · {{ s.price_range }}</p>
                      @if (s.google_rating) {
                        <p class="card-rating">★ {{ s.google_rating }}</p>
                      }
                      <p class="card-why">{{ s.why_recommended }}</p>
                    </div>
                  </div>
                }
              </div>

              <!-- POIs -->
              <p class="section-label">📍 Points of Interest — toggle on/off</p>
              <div class="suggestion-grid">
                @for (s of stop.poi_suggestions; track $index) {
                  <div class="suggestion-card"
                       [class.approved]="isPoiApproved(stop.stop_order, $index)"
                       [class.rejected]="!isPoiApproved(stop.stop_order, $index)"
                       (click)="togglePoi(stop.stop_order, $index)">
                    @if (s.photo_url) {
                      <img class="card-photo" [src]="s.photo_url" [alt]="s.name" (error)="onImgError($event)" />
                    } @else {
                      <div class="card-photo" style="display:flex;align-items:center;justify-content:center;font-size:36px">📍</div>
                    }
                    <div class="card-body">
                      <p class="card-name">
                        {{ s.name }}
                        @if (s.google_verified) { <span class="google-badge">G</span> }
                      </p>
                      <p class="card-meta">{{ s.poi_type.replace('_',' ') | titlecase }}</p>
                      <p class="card-why">{{ s.why_recommended }}</p>
                    </div>
                  </div>
                }
              </div>

            </mat-expansion-panel>
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
                      (click)="togglePack(cat.category, item)">
                  {{ item }}
                </span>
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
          <p style="color:var(--wp-text-secondary);margin-bottom:32px">
            Your trip is saved and ready for the road.
          </p>
          <button mat-raised-button color="primary" style="height:48px;font-size:16px"
                  [routerLink]="['/trips', savedTripId()]">
            <mat-icon>map</mat-icon>
            Open Trip Companion →
          </button>
        </div>
      }

    </div>
  `,
})
export class TripWizardComponent implements OnDestroy {
  private wizardSvc = inject(TripWizardService);
  private snack     = inject(MatSnackBar);
  private router    = inject(Router);
  private fb        = inject(FormBuilder);

  // ── Step state ──────────────────────────────────────────────────────
  step       = signal(1);
  plan       = signal<WizardPlan | null>(null);
  savedTripId = signal<number | null>(null);
  confirming = signal(false);
  progressMsg = signal(PROGRESS_MSGS[0]);

  // ── Review selection state ──────────────────────────────────────────
  selectedLodging    = signal(new Map<number, number>());   // stop_order → index (-1 = none)
  approvedRests      = signal(new Map<number, Set<number>>());
  approvedPois       = signal(new Map<number, Set<number>>());
  excludedPackItems  = signal(new Map<string, Set<string>>()); // category → excluded items

  // ── Step 1 form ─────────────────────────────────────────────────────
  selectedCuisines  = signal<string[]>([]);
  selectedInterests = signal<string[]>([]);

  readonly cuisines     = CUISINES;
  readonly interests    = INTERESTS;
  readonly lodgingTypes = LODGING_TYPES;

  form = this.fb.group({
    name:         [''],
    origin:       ['', Validators.required],
    destination:  ['', Validators.required],
    start_date:   [null as Date | null, Validators.required],
    end_date:     [null as Date | null, Validators.required],
    budget:       [null as number | null],
    lodging_type: [''],
    pet_friendly: [false],
  });

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
    Math.round((this.plan()?.stops ?? []).reduce((s, st) => s + st.drive_minutes_from_prev, 0) / 60),
  );

  driveLbl(mins: number): string {
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  // ── Chip helpers ──────────────────────────────────────────────────────
  toggleChip(sig: ReturnType<typeof signal<string[]>>, val: string) {
    sig.update((arr) => arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  // ── Step 1 → Step 2 ──────────────────────────────────────────────────
  generate() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const payload: WizardGenerateRequest = {
      origin:      v.origin!,
      destination: v.destination!,
      start_date:  (v.start_date as Date).toISOString().split('T')[0],
      end_date:    (v.end_date   as Date).toISOString().split('T')[0],
      budget:      v.budget ?? 0,
      preferences: {
        lodging_type:        v.lodging_type || undefined,
        cuisine_preferences: this.selectedCuisines().length ? this.selectedCuisines() : undefined,
        interests:           this.selectedInterests().length ? this.selectedInterests() : undefined,
        pet_friendly:        v.pet_friendly ?? false,
      },
    };

    this.step.set(2);
    this.startProgress();

    this.wizardSvc.generate(payload).subscribe({
      next: (result) => {
        this.stopProgress();
        // Auto-name trip if user left it blank
        if (!v.name && result.trip?.name) {
          result.trip.name = result.trip.name;
        } else if (v.name) {
          result.trip.name = v.name;
        }
        this.plan.set(result);
        this.initReviewState(result);
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

  // ── Init review selection defaults ───────────────────────────────────
  private initReviewState(p: WizardPlan) {
    const lodgingMap = new Map<number, number>();
    const restMap    = new Map<number, Set<number>>();
    const poiMap     = new Map<number, Set<number>>();

    for (const stop of p.stops) {
      lodgingMap.set(stop.stop_order, 0); // default: first lodging selected
      restMap.set(stop.stop_order, new Set(stop.restaurant_suggestions.map((_, i) => i)));
      poiMap.set(stop.stop_order, new Set(stop.poi_suggestions.map((_, i) => i)));
    }

    this.selectedLodging.set(lodgingMap);
    this.approvedRests.set(restMap);
    this.approvedPois.set(poiMap);
    this.excludedPackItems.set(new Map()); // nothing excluded by default
  }

  // ── Review toggles ────────────────────────────────────────────────────
  selectLodging(stopOrder: number, idx: number) {
    this.selectedLodging.update((m) => { const n = new Map(m); n.set(stopOrder, idx); return n; });
  }

  isRestApproved(stopOrder: number, idx: number): boolean {
    return this.approvedRests().get(stopOrder)?.has(idx) ?? false;
  }
  toggleRest(stopOrder: number, idx: number) {
    this.approvedRests.update((m) => {
      const n = new Map(m); const s = new Set(n.get(stopOrder) ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      n.set(stopOrder, s); return n;
    });
  }

  isPoiApproved(stopOrder: number, idx: number): boolean {
    return this.approvedPois().get(stopOrder)?.has(idx) ?? false;
  }
  togglePoi(stopOrder: number, idx: number) {
    this.approvedPois.update((m) => {
      const n = new Map(m); const s = new Set(n.get(stopOrder) ?? []);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      n.set(stopOrder, s); return n;
    });
  }

  isPackExcluded(cat: string, item: string): boolean {
    return this.excludedPackItems().get(cat)?.has(item) ?? false;
  }
  togglePack(cat: string, item: string) {
    this.excludedPackItems.update((m) => {
      const n = new Map(m); const s = new Set(n.get(cat) ?? []);
      s.has(item) ? s.delete(item) : s.add(item);
      n.set(cat, s); return n;
    });
  }

  // ── Step 3 → confirm ────────────────────────────────────────────────
  confirm() {
    const p = this.plan();
    if (!p) return;
    this.confirming.set(true);

    // Build the payload with approved flags applied
    const payload: WizardPlan = {
      ...p,
      stops: p.stops.map((stop) => ({
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
          .map((cat) => ({
            ...cat,
            items: cat.items.filter((item) => !this.isPackExcluded(cat.category, item)),
          }))
          .filter((cat) => cat.items.length > 0),
      },
    };

    this.wizardSvc.confirm(payload).subscribe({
      next: (saved) => {
        this.savedTripId.set(saved.id);
        this.confirming.set(false);
        this.step.set(4);
      },
      error: () => {
        this.snack.open('Save failed — please try again', 'Dismiss', { duration: 4000 });
        this.confirming.set(false);
      },
    });
  }

  onImgError(e: Event) {
    (e.target as HTMLImageElement).style.display = 'none';
  }
}
