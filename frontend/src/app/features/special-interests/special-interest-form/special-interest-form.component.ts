import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SpecialInterestService } from '../../../core/services/special-interest.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PlacesAutocompleteComponent, PlaceSelectedEvent } from '../../../shared/components/places-autocomplete/places-autocomplete.component';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { EntityPhoto } from '../../../core/services/photo.service';

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'winery_brewery',      label: 'Winery / Brewery' },
  { value: 'bourbon_distillery',  label: 'Bourbon Distillery' },
  { value: 'museum',              label: 'Museum' },
  { value: 'historic_site',       label: 'Historic Site' },
  { value: 'state_park',          label: 'State Park' },
  { value: 'national_park',       label: 'National Park' },
  { value: 'live_music',          label: 'Live Music' },
  { value: 'scenic',              label: 'Scenic' },
  { value: 'roadside_attraction', label: 'Roadside Attraction' },
  { value: 'shopping',            label: 'Shopping' },
  { value: 'other',               label: 'Other' },
];

@Component({
  selector: 'app-special-interest-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule, PlacesAutocompleteComponent, PhotoUploaderComponent,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  styles: [`
    mat-card { max-width:720px; margin:0 auto; padding:24px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .full { grid-column:1/-1; }
    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
      mat-card { padding: 16px; padding-bottom: 140px; }
    }
    .section {
      grid-column:1/-1; font-size:12px; font-weight:600; text-transform:uppercase;
      letter-spacing:.7px; color:var(--wp-text-secondary); margin:12px 0 0;
      padding-bottom:6px; border-bottom:1px solid var(--wp-border);
    }
    .actions {
      position:sticky; bottom:0; background:var(--wp-surface);
      padding:12px 0 8px; margin-top:16px;
      border-top:1px solid var(--wp-border); z-index:10;
      display:flex; gap:12px;
    }
    .star-row { display:flex; gap:4px; cursor:pointer; }
    .star-btn { font-size:26px; background:none; border:none; cursor:pointer; padding:0; line-height:1; }
    .rating-label { font-size:13px; color:var(--wp-text-secondary); margin-bottom:4px; }
    .ai-row { display:flex; gap:8px; align-items:flex-start; }
    .ai-row mat-form-field { flex:1; }
    h2 { margin:0 0 20px; font-size:20px; font-weight:600; }
  `],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit Place' : 'Add Place'"
                     [backRoute]="isEdit() ? '/special-interests/' + placeId() : '/special-interests'" />
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else {
      <div class="page-container">
        <mat-card>
          <h2>{{ isEdit() ? 'Edit Place' : 'Add Place' }}</h2>

          <!-- Rule 1: Search-first -->
          <app-places-autocomplete
            placeholder="Search place by name + city…"
            [types]="['establishment']"
            (placeSelected)="onPlace($event)"
            style="display:block;margin-bottom:12px" />

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-grid">

              <!-- Section: Basics -->
              <p class="section">Basics</p>

              <mat-form-field appearance="outline">
                <mat-label>Name *</mat-label>
                <input matInput formControlName="name" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Category *</mat-label>
                <mat-select formControlName="category">
                  @for (c of categoryOptions; track c.value) {
                    <mat-option [value]="c.value">{{ c.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Price Range</mat-label>
                <mat-select formControlName="price_range">
                  <mat-option [value]="null">Not specified</mat-option>
                  <mat-option value="$">$ — Budget</mat-option>
                  <mat-option value="$$">$$ — Moderate</mat-option>
                  <mat-option value="$$$">$$$ — Upscale</mat-option>
                  <mat-option value="$$$$">$$$$ — Fine Dining</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Date Visited</mat-label>
                <input matInput type="date" formControlName="visited_at" />
              </mat-form-field>

              <!-- Section: Location -->
              <p class="section">Location</p>

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

              <!-- Section: Contact -->
              <p class="section">Contact &amp; Links</p>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Website</mat-label>
                <input matInput formControlName="website" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Booking / Reservation URL</mat-label>
                <input matInput formControlName="booking_url" placeholder="https://…" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Menu URL</mat-label>
                <input matInput formControlName="menu_url" placeholder="https://…" />
              </mat-form-field>

              <!-- Section: Your Experience -->
              <p class="section">Your Experience</p>

              <div>
                <p class="rating-label">Rating</p>
                <div class="star-row">
                  @for (i of [1,2,3,4,5]; track i) {
                    <button type="button" class="star-btn" (click)="form.patchValue({rating:i})">
                      {{ i <= (form.value.rating ?? 0) ? '⭐' : '☆' }}
                    </button>
                  }
                </div>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Would return?</mat-label>
                <mat-select formControlName="would_return">
                  <mat-option [value]="null">Not rated</mat-option>
                  <mat-option [value]="true">Yes ✓</mat-option>
                  <mat-option [value]="false">No ✗</mat-option>
                </mat-select>
              </mat-form-field>

              <!-- Section: Notes & Highlights -->
              <p class="section">Notes &amp; Highlights</p>

              <!-- Rule 4: Highlights + AI button -->
              <div class="full ai-row">
                <mat-form-field appearance="outline">
                  <mat-label>Highlights</mat-label>
                  <textarea matInput formControlName="highlights" rows="2"></textarea>
                </mat-form-field>
                <button type="button" mat-stroked-button (click)="generateHighlights()"
                        [disabled]="aiLoading() || !form.value.name"
                        style="margin-top:4px;white-space:nowrap">
                  @if (aiLoading()) { <mat-spinner diameter="16" style="display:inline-block" /> }
                  @else { <mat-icon>auto_awesome</mat-icon> }
                  AI
                </button>
              </div>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Image URL (fallback)</mat-label>
                <input matInput formControlName="image_url" />
              </mat-form-field>

            </div>

            <!-- Rule 3: Photo upload in edit mode -->
            @if (isEdit()) {
              <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;
                         color:var(--wp-text-secondary);margin:20px 0 12px;padding-bottom:6px;
                         border-bottom:1px solid var(--wp-border)">Photos</p>
              <app-photo-uploader
                entityType="special-interests"
                [entityId]="placeId()!"
                [photos]="photos()"
                (changed)="reloadPhotos()" />
            }

            <!-- Rule 5: Sticky actions -->
            <div class="actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving…' : (isEdit() ? 'Update' : 'Add Place') }}
              </button>
              <button mat-stroked-button type="button" [routerLink]="isEdit() ? ['/special-interests', placeId()] : ['/special-interests']">
                Cancel
              </button>
            </div>
          </form>
        </mat-card>
      </div>
    }
  `,
})
export class SpecialInterestFormComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private svc       = inject(SpecialInterestService);
  private geoSvc    = inject(GeocodingService);
  private claudeSvc = inject(ClaudeService);
  private snack     = inject(MatSnackBar);
  private fb        = inject(FormBuilder);

  isEdit     = signal(false);
  geoLoading = signal(false);
  aiLoading  = signal(false);
  loading    = signal(false);
  saving     = signal(false);
  placeId    = signal<number | null>(null);
  photos     = signal<EntityPhoto[]>([]);

  readonly categoryOptions = CATEGORY_OPTIONS;

  form = this.fb.group({
    name:           ['', Validators.required],
    category:       ['museum', Validators.required],
    city:           ['', Validators.required],
    state_province: ['', Validators.required],
    country:        ['USA', Validators.required],
    address:        [''],
    latitude:       [null as number | null],
    longitude:      [null as number | null],
    rating:         [null as number | null],
    would_return:   [null as boolean | null],
    highlights:     [''],
    notes:          [''],
    website:        [''],
    phone:          [''],
    image_url:      [''],
    price_range:    [null as string | null],
    visited_at:     [''],
    booking_url:    [''],
    menu_url:       [''],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.placeId.set(+id);
      this.loading.set(true);
      this.svc.get(+id).subscribe({
        next: (p) => {
          this.form.patchValue(p);
          this.photos.set((p.photos ?? []) as EntityPhoto[]);
          this.loading.set(false);
        },
        error: () => this.router.navigate(['/special-interests']),
      });
    }
  }

  onPlace(e: PlaceSelectedEvent) {
    this.form.patchValue({
      name:           e.name || this.form.value.name,
      city:           e.city,
      state_province: e.state_province,
      country:        e.country,
      address:        e.formatted_address,
      latitude:       e.lat,
      longitude:      e.lng,
      phone:          e.phone   ?? this.form.value.phone,
      website:        e.website ?? this.form.value.website,
    });
  }

  generateHighlights() {
    const v = this.form.getRawValue();
    if (!v.name) return;
    this.aiLoading.set(true);
    this.claudeSvc.generateHighlights({
      type: 'special_interest',
      name: v.name,
      city: v.city ?? '',
      state: v.state_province ?? '',
      details: v.category ?? undefined,
    }).subscribe({
      next: (res) => {
        this.form.patchValue({ highlights: res.result });
        this.aiLoading.set(false);
      },
      error: () => {
        this.snack.open('AI generation failed', 'Dismiss', { duration: 3000 });
        this.aiLoading.set(false);
      },
    });
  }

  reloadPhotos() {
    const id = this.placeId();
    if (!id) return;
    this.svc.get(id).subscribe((p) => this.photos.set((p.photos ?? []) as EntityPhoto[]));
  }

  lookupCoords() {
    const v = this.form.getRawValue();
    if (!v.city) return;
    this.geoLoading.set(true);
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
    const raw = this.form.getRawValue();
    const dto = {
      ...raw,
      visited_at:  raw.visited_at  || null,
      booking_url: raw.booking_url || null,
      menu_url:    raw.menu_url    || null,
    };
    const req = this.isEdit()
      ? this.svc.update(this.placeId()!, dto)
      : this.svc.create(dto);
    req.subscribe({
      next: (p) => this.router.navigate(['/special-interests', p.id]),
      error: () => {
        this.snack.open('Save failed', 'Dismiss', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }
}
