import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LodgingService } from '../../../core/services/lodging.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

const AMENITY_SUGGESTIONS = [
  'AC', 'Breakfast', 'EV Charging', 'Fireplace', 'Fitness Center', 'Hot Tub',
  'Kitchen', 'Laundry', 'Parking', 'Pet Friendly', 'Pool', 'Restaurant',
  'Spa', 'WiFi',
];

@Component({
  selector: 'app-lodging-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSlideToggleModule, MatChipsModule,
    MatProgressSpinnerModule, MatSnackBarModule, PageHeaderComponent,
  ],
  styles: [`
    mat-card { max-width:720px; margin:0 auto; padding:24px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
    .full { grid-column:1/-1; }
    .actions { display:flex; gap:12px; margin-top:8px; }
    .star-row { display:flex; gap:4px; cursor:pointer; }
    .star-btn { font-size:26px; background:none; border:none; cursor:pointer; padding:0; line-height:1; }
    .rating-label { font-size:13px; color:var(--wp-text-secondary); margin-bottom:4px; }
    h2 { margin:0 0 20px; font-size:20px; font-weight:600; }
    .amenity-suggestions { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
    .sug-chip {
      padding:2px 10px; border-radius:12px; border:1px solid var(--wp-border);
      font-size:12px; cursor:pointer; background:var(--wp-surface-variant);
      color:var(--wp-text-secondary);
    }
    .sug-chip:hover { background:var(--wp-primary); color:#fff; }
  `],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit Lodging' : 'Add Lodging'"
                     [backRoute]="isEdit() ? '/lodging/' + lodgingId() : '/lodging'" />
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else {
      <div class="page-container">
        <mat-card>
          <h2>{{ isEdit() ? 'Edit Lodging' : 'Add Lodging' }}</h2>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-grid">

              <mat-form-field appearance="outline">
                <mat-label>Name *</mat-label>
                <input matInput formControlName="name" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Type *</mat-label>
                <mat-select formControlName="lodging_type">
                  <mat-option value="hotel">Hotel</mat-option>
                  <mat-option value="motel">Motel</mat-option>
                  <mat-option value="airbnb">Airbnb</mat-option>
                  <mat-option value="resort">Resort</mat-option>
                  <mat-option value="campground">Campground</mat-option>
                  <mat-option value="other">Other</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>City *</mat-label>
                <input matInput formControlName="city" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>State / Province *</mat-label>
                <input matInput formControlName="state_province" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Country *</mat-label>
                <mat-select formControlName="country">
                  <mat-option value="USA">USA</mat-option>
                  <mat-option value="Canada">Canada</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Price / night ($)</mat-label>
                <input matInput type="number" step="0.01" formControlName="price_per_night" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Address</mat-label>
                <input matInput formControlName="address" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Latitude</mat-label>
                <input matInput type="number" step="any" formControlName="latitude" />
                <button matSuffix mat-icon-button type="button"
                        [disabled]="geoLoading() || !form.value.city"
                        (click)="lookupCoords()" title="Look up coordinates">
                  @if (geoLoading()) { <mat-spinner diameter="16" /> }
                  @else { <mat-icon>my_location</mat-icon> }
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Longitude</mat-label>
                <input matInput type="number" step="any" formControlName="longitude" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Website</mat-label>
                <input matInput formControlName="website" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Booking URL</mat-label>
                <input matInput formControlName="booking_url" placeholder="https://…" />
                <mat-hint>Reservation link (Hotels.com, Airbnb, etc.)</mat-hint>
              </mat-form-field>

              <!-- Room Quality -->
              <div>
                <p class="rating-label">Room quality</p>
                <div class="star-row">
                  @for (i of [1,2,3,4,5]; track i) {
                    <button type="button" class="star-btn" (click)="form.patchValue({room_quality:i})">
                      {{ i <= (form.value.room_quality ?? 0) ? '⭐' : '☆' }}
                    </button>
                  }
                </div>
              </div>

              <!-- Cleanliness -->
              <div>
                <p class="rating-label">Cleanliness</p>
                <div class="star-row">
                  @for (i of [1,2,3,4,5]; track i) {
                    <button type="button" class="star-btn" (click)="form.patchValue({cleanliness:i})">
                      {{ i <= (form.value.cleanliness ?? 0) ? '⭐' : '☆' }}
                    </button>
                  }
                </div>
              </div>

              <!-- Would return -->
              <mat-form-field appearance="outline">
                <mat-label>Would return?</mat-label>
                <mat-select formControlName="would_return">
                  <mat-option [value]="null">Not rated</mat-option>
                  <mat-option [value]="true">Yes ✓</mat-option>
                  <mat-option [value]="false">No ✗</mat-option>
                </mat-select>
              </mat-form-field>

              <div style="align-self:center">
                <mat-slide-toggle formControlName="pet_friendly">Pet friendly</mat-slide-toggle>
              </div>

              <!-- Amenities chip input -->
              <div class="full">
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Amenities</mat-label>
                  <mat-chip-grid #chipGrid>
                    @for (a of amenities(); track a) {
                      <mat-chip (removed)="removeAmenity(a)">
                        {{ a }}
                        <button matChipRemove><mat-icon>cancel</mat-icon></button>
                      </mat-chip>
                    }
                  </mat-chip-grid>
                  <input
                    placeholder="Type and press Enter…"
                    [matChipInputFor]="chipGrid"
                    [matChipInputSeparatorKeyCodes]="separatorKeys"
                    (matChipInputTokenEnd)="addAmenity($event)" />
                </mat-form-field>
                <div class="amenity-suggestions">
                  @for (s of amenitySuggestions; track s) {
                    @if (!amenities().includes(s)) {
                      <span class="sug-chip" (click)="addAmenityStr(s)">+ {{ s }}</span>
                    }
                  }
                </div>
              </div>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Highlights</mat-label>
                <textarea matInput formControlName="highlights" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Image URL (fallback)</mat-label>
                <input matInput formControlName="image_url" />
              </mat-form-field>

            </div>

            <div class="actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving…' : (isEdit() ? 'Update' : 'Add Lodging') }}
              </button>
              <button mat-stroked-button type="button" [routerLink]="isEdit() ? ['/lodging', lodgingId()] : ['/lodging']">
                Cancel
              </button>
            </div>
          </form>
        </mat-card>
      </div>
    }
  `,
})
export class LodgingFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(LodgingService);
  private geoSvc = inject(GeocodingService);
  private snack  = inject(MatSnackBar);
  private fb     = inject(FormBuilder);

  isEdit     = signal(false);
  geoLoading = signal(false);
  loading = signal(false);
  saving = signal(false);
  lodgingId = signal<number | null>(null);
  amenities = signal<string[]>([]);

  readonly separatorKeys = [ENTER, COMMA];
  readonly amenitySuggestions = AMENITY_SUGGESTIONS;

  form = this.fb.group({
    name:           ['', Validators.required],
    city:           ['', Validators.required],
    state_province: ['', Validators.required],
    country:        ['USA', Validators.required],
    lodging_type:   ['hotel', Validators.required],
    address:        [''],
    latitude:       [null as number | null],
    longitude:      [null as number | null],
    price_per_night:[null as number | null],
    room_quality:   [null as number | null],
    cleanliness:    [null as number | null],
    would_return:   [null as boolean | null],
    highlights:     [''],
    notes:          [''],
    website:        [''],
    phone:          [''],
    pet_friendly:   [false],
    image_url:      [''],
    booking_url:    [''],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.lodgingId.set(+id);
      this.loading.set(true);
      this.svc.get(+id).subscribe({
        next: (l) => {
          this.form.patchValue(l);
          this.amenities.set(l.amenities ?? []);
          this.loading.set(false);
        },
        error: () => this.router.navigate(['/lodging']),
      });
    }
  }

  addAmenity(e: MatChipInputEvent) {
    const v = (e.value ?? '').trim();
    if (v && !this.amenities().includes(v)) this.amenities.update((a) => [...a, v]);
    e.chipInput.clear();
  }
  addAmenityStr(s: string) {
    if (!this.amenities().includes(s)) this.amenities.update((a) => [...a, s]);
  }
  removeAmenity(s: string) { this.amenities.update((a) => a.filter((x) => x !== s)); }

  lookupCoords() {
    const v = this.form.getRawValue();
    if (!v.city) return;
    this.geoLoading.set(true);
    // Pass street address for precise coordinates when filled in
    this.geoSvc
      .lookup(v.city ?? '', v.state_province ?? '', v.country ?? 'USA', v.address ?? undefined)
      .subscribe((r) => {
        this.geoLoading.set(false);
        if (r) {
          this.form.patchValue({ latitude: r.lat, longitude: r.lon });
          this.snack.open('Coordinates updated', 'OK', { duration: 2000 });
        } else {
          this.snack.open('Location not found — enter coordinates manually', 'Dismiss', { duration: 3000 });
        }
      });
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const dto = { ...this.form.getRawValue(), amenities: this.amenities() };
    const req = this.isEdit()
      ? this.svc.update(this.lodgingId()!, dto)
      : this.svc.create(dto);
    req.subscribe({
      next: (l) => this.router.navigate(['/lodging', l.id]),
      error: () => {
        this.snack.open('Save failed', 'Dismiss', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }
}
