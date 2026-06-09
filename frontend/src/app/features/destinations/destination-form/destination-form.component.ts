import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { Destination } from '../../../types/schema.types';
import { HttpErrorResponse } from '@angular/common/http';
import { DestinationService } from '../../../core/services/destination.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { PlacesAutocompleteComponent, PlaceSelectedEvent } from '../../../shared/components/places-autocomplete/places-autocomplete.component';
import { DuplicateDestinationDialogComponent } from '../../../shared/components/duplicate-destination-dialog/duplicate-destination-dialog.component';
import { HomeAddressDialogComponent } from '../../../shared/components/home-address-dialog/home-address-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

@Component({
  selector: 'app-destination-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule, PlacesAutocompleteComponent, PhotoUploaderComponent,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatAutocompleteModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatDatepickerModule, MatSnackBarModule,
    PageHeaderComponent,
  ],
  styles: [`
    .back-row { margin-bottom: 16px; }
    @media (max-width: 768px) { .back-row { display: none; } }
    .form-card { max-width: 720px; margin: 0 auto; }
    .form-title { font-size:22px; font-weight:700; margin-bottom:20px; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    @media(max-width:600px){
      .row { grid-template-columns:1fr; }
      mat-card-content { padding-bottom: 140px; }
    }
    mat-form-field { width:100%; margin-bottom:4px; }
    .section { margin:16px 0 8px; font-size:13px; font-weight:600;
                text-transform:uppercase; letter-spacing:.7px; color:var(--wp-text-secondary); }
    .star-row { display:flex; gap:4px; margin:8px 0 16px; }
    .star-btn  { cursor:pointer; font-size:28px; color:var(--wp-border); transition:color .15s; }
    .star-btn.active { color:#FFB300; }
    .actions {
      display:flex; gap:12px; justify-content:flex-end; margin-top:8px;
      position:sticky; bottom:0; background:var(--wp-surface);
      padding:12px 0 8px; border-top:1px solid var(--wp-border); z-index:10;
    }
    .err { font-size:12px; color:#c62828; margin-bottom:4px; }
  `],
  template: `
    <app-page-header [title]="isEdit() ? 'Edit Destination' : 'Add Destination'" backRoute="/destinations" />
    <div class="page-container">
      <button mat-stroked-button class="back-row" routerLink="/destinations" style="margin-bottom:16px">
        <mat-icon>arrow_back</mat-icon> Destinations
      </button>

      <mat-card class="form-card">
        <mat-card-content>
          <h2 class="form-title">{{ isEdit() ? 'Edit' : 'Add' }} Destination</h2>

          <!-- Places Autocomplete — fills name/city/state/country/lat/lng automatically -->
          <app-places-autocomplete
            placeholder="Search for a destination city or place…"
            hint="Select a result to auto-fill all location fields"
            [types]="['(cities)', 'natural_feature', 'establishment']"
            (placeSelected)="onPlaceSelected($event)"
            style="display:block;margin-bottom:8px" />

          <form [formGroup]="form" (ngSubmit)="save()">

            <!-- Basic info -->
            <mat-form-field appearance="outline">
              <mat-label>Destination name *</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>

            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>City *</mat-label>
                <input matInput formControlName="city" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>State / Province *</mat-label>
                <input matInput formControlName="state_province" />
              </mat-form-field>
            </div>

            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Country *</mat-label>
                <mat-select formControlName="country">
                  <mat-option value="USA">USA</mat-option>
                  <mat-option value="Canada">Canada</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Region</mat-label>
                <input matInput formControlName="region" placeholder="e.g. Pacific Northwest" />
              </mat-form-field>
            </div>

            <!-- Status & rating -->
            <p class="section">Status &amp; Rating</p>
            <div class="row">
              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="want_to_visit">Want to Visit</mat-option>
                  <mat-option value="planned">Planned</mat-option>
                  <mat-option value="visited">Visited</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Date Visited</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="visited_at" />
                <mat-datepicker-toggle matSuffix [for]="picker" />
                <mat-datepicker #picker />
              </mat-form-field>
            </div>

            <div>
              <label style="font-size:13px;color:var(--wp-text-secondary)">Rating</label>
              <div class="star-row">
                @for (i of [1,2,3,4,5]; track i) {
                  <span class="star-btn" [class.active]="(form.value.rating ?? 0) >= i"
                        (click)="setRating(i)">★</span>
                }
              </div>
            </div>

            <!-- Location -->
            <p class="section">Location</p>
            <div class="row" style="align-items:flex-start">
              <mat-form-field appearance="outline">
                <mat-label>Latitude</mat-label>
                <input matInput type="number" step="0.0001" formControlName="latitude" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Longitude</mat-label>
                <input matInput type="number" step="0.0001" formControlName="longitude" />
              </mat-form-field>
            </div>
            <button mat-stroked-button type="button"
                    [disabled]="geoLoading() || !form.value.city"
                    (click)="lookupCoords()"
                    style="margin-bottom:12px">
              @if (geoLoading()) {
                <mat-spinner diameter="18" style="display:inline-block;margin-right:6px" />
                Looking up…
              } @else {
                <mat-icon>my_location</mat-icon>
                Look up coordinates from City / State
              }
            </button>

            <!-- Best months -->
            <p class="section">Best Months to Visit</p>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Best months</mat-label>
              <mat-chip-grid #chipGrid>
                @for (m of selectedMonths(); track m) {
                  <mat-chip (removed)="removeMonth(m)">
                    {{ m }}
                    <button matChipRemove><mat-icon>cancel</mat-icon></button>
                  </mat-chip>
                }
              </mat-chip-grid>
              <input placeholder="Add month…"
                     [matChipInputFor]="chipGrid"
                     [matChipInputSeparatorKeyCodes]="separatorKeys"
                     [matAutocomplete]="monthAuto"
                     (matChipInputTokenEnd)="addMonth($event)"
                     #monthInput />
              <mat-autocomplete #monthAuto (optionSelected)="selectMonth($event); monthInput.value = ''">
                @for (m of filteredMonths(); track m) {
                  <mat-option [value]="m">{{ m }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>

            <!-- Notes & image -->
            <p class="section">Content</p>
            <mat-form-field appearance="outline">
              <mat-label>Description</mat-label>
              <textarea matInput formControlName="description" rows="3"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Notes</mat-label>
              <textarea matInput formControlName="notes" rows="2"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Travel Tips</mat-label>
              <textarea matInput formControlName="travel_tips" rows="3"
                        placeholder="Best time to visit, parking tips, insider advice…"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Image URL</mat-label>
              <input matInput formControlName="image_url" placeholder="https://…" />
            </mat-form-field>

            @if (error()) {
              <p class="err">{{ error() }}</p>
            }

            <div class="actions">
              <button mat-stroked-button type="button" routerLink="/destinations">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="saving()">
                @if (saving()) { <mat-spinner diameter="18" style="margin:auto" /> }
                @else { {{ isEdit() ? 'Save changes' : 'Add destination' }} }
              </button>
            </div>
          </form>

          <!-- Rule 3: Photo upload in edit mode -->
          @if (isEdit()) {
            <p class="section" style="margin-top:24px">Photos</p>
            <app-photo-uploader
              entityType="destinations"
              [entityId]="destId!"
              [photos]="photos()"
              (changed)="reloadPhotos()" />
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class DestinationFormComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private svc     = inject(DestinationService);
  private geoSvc  = inject(GeocodingService);
  private snack   = inject(MatSnackBar);
  private fb      = inject(FormBuilder);
  private dialog  = inject(MatDialog);

  isEdit     = signal(false);
  saving     = signal(false);
  geoLoading = signal(false);
  error      = signal('');
  selectedMonths = signal<string[]>([]);
  photos = signal<Destination['photos']>([]);

  readonly separatorKeys = [ENTER, COMMA];
  readonly allMonths = MONTHS;

  filteredMonths = signal<string[]>(MONTHS);

  form = this.fb.group({
    name:           ['', Validators.required],
    city:           ['', Validators.required],
    state_province: ['', Validators.required],
    country:        ['USA', Validators.required],
    region:         [''],
    status:         ['want_to_visit'],
    visited_at:     [null as Date | null],
    rating:         [null as number | null],
    latitude:       [null as number | null],
    longitude:      [null as number | null],
    description:    [''],
    notes:          [''],
    image_url:      [''],
    travel_tips:    [''],
  });

  private destId?: number;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      this.destId = +id;
      this.svc.get(+id).subscribe((d) => {
        this.form.patchValue({
          ...d,
          visited_at: d.visited_at ? new Date(d.visited_at) : null,
        });
        this.selectedMonths.set(d.best_months ?? []);
        this.photos.set(d.photos ?? []);
        this.updateFilteredMonths();
      });
    } else {
      // Pre-fill from query params (e.g. coming from /destinations/suggest)
      const qp = this.route.snapshot.queryParamMap;
      if (qp.get('name')) {
        this.form.patchValue({
          name:           qp.get('name') ?? '',
          state_province: qp.get('state_province') ?? '',
          country:        (qp.get('country') as 'USA' | 'Canada') ?? 'USA',
          description:    qp.get('description') ?? '',
        });
        const months = qp.get('best_months')?.split(',').filter(Boolean) ?? [];
        this.selectedMonths.set(months);
        this.updateFilteredMonths();
      }
    }
  }

  setRating(n: number): void { this.form.patchValue({ rating: n }); }

  reloadPhotos(): void {
    if (!this.destId) return;
    this.svc.get(this.destId).subscribe((d) => this.photos.set(d.photos ?? []));
  }

  /** Called when the Places Autocomplete emits a selection — auto-fills all location fields. */
  onPlaceSelected(place: PlaceSelectedEvent): void {
    this.form.patchValue({
      name:           place.name || place.city,
      city:           place.city,
      state_province: place.state_province,
      country:        place.country,
      latitude:       place.lat,
      longitude:      place.lng,
    });
    this.snack.open(`Location set: ${place.city}, ${place.state_province}`, 'OK', { duration: 2500 });
  }

  lookupCoords(): void {
    const { city, state_province, country, description } = this.form.getRawValue();
    // Use address/description field for street-level precision if populated
    const addressHint = (this.form.getRawValue() as Record<string, unknown>)['address'] as string | undefined;
    if (!city) return;
    this.geoLoading.set(true);
    this.geoSvc
      .lookup(city ?? '', state_province ?? '', country ?? 'USA', addressHint ?? undefined)
      .subscribe((r) => {
        this.geoLoading.set(false);
        if (r) {
          this.form.patchValue({ latitude: r.lat, longitude: r.lon });
          this.snack.open(`Found: ${r.displayName.split(',').slice(0, 2).join(',')}`, 'OK', { duration: 3000 });
        } else {
          this.snack.open('Location not found — enter coordinates manually', 'Dismiss', { duration: 4000 });
        }
      });
  }

  addMonth(event: MatChipInputEvent): void {
    const val = (event.value ?? '').trim();
    if (val && !this.selectedMonths().includes(val)) {
      this.selectedMonths.update((m) => [...m, val]);
      this.updateFilteredMonths();
    }
    event.chipInput?.clear();
  }

  selectMonth(event: MatAutocompleteSelectedEvent): void {
    const val = event.option.value as string;
    if (!this.selectedMonths().includes(val)) {
      this.selectedMonths.update((m) => [...m, val]);
      this.updateFilteredMonths();
    }
  }

  removeMonth(month: string): void {
    this.selectedMonths.update((m) => m.filter((x) => x !== month));
    this.updateFilteredMonths();
  }

  private updateFilteredMonths(): void {
    this.filteredMonths.set(this.allMonths.filter((m) => !this.selectedMonths().includes(m)));
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const raw = this.form.value;
    // Convert nulls to undefined so Partial<Destination> is satisfied
    const dto: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) dto[k] = v ?? undefined;
    dto['best_months'] = this.selectedMonths();
    dto['visited_at'] = raw.visited_at
      ? (raw.visited_at as Date).toISOString().slice(0, 10)
      : undefined;

    if (this.isEdit()) {
      this.svc.update(this.destId!, dto).subscribe({
        next: (d) => this.router.navigate(['/destinations', d.id]),
        error: (e) => {
          this.error.set(e.error?.error ?? 'An error occurred');
          this.saving.set(false);
        },
      });
      return;
    }

    this.submit(dto, false);
  }

  private submit(dto: Record<string, unknown>, force: boolean): void {
    this.svc.create(dto, force).subscribe({
      next: (d) => this.router.navigate(['/destinations', d.id]),
      error: (e: HttpErrorResponse) => {
        if (e.status === 409 && e.error?.duplicate) {
          this.handleDuplicate(dto, e.error.existing);
          return;
        }
        if (e.status === 409 && e.error?.home_address) {
          this.handleHomeAddress(dto);
          return;
        }
        this.error.set(e.error?.error ?? 'An error occurred');
        this.saving.set(false);
      },
    });
  }

  private handleDuplicate(dto: Record<string, unknown>, existing: { id: number; name: string; city: string; state_province: string }): void {
    this.dialog.open(DuplicateDestinationDialogComponent, { data: { existing }, width: '420px' })
      .afterClosed().subscribe((result) => {
        if (result === 'view') {
          this.router.navigate(['/destinations', existing.id]);
        } else if (result === 'save-anyway') {
          this.submit(dto, true);
        } else {
          this.saving.set(false);
        }
      });
  }

  private handleHomeAddress(dto: Record<string, unknown>): void {
    this.dialog.open(HomeAddressDialogComponent, { width: '420px' })
      .afterClosed().subscribe((result) => {
        if (result === 'add-anyway') {
          this.submit(dto, true);
        } else {
          this.saving.set(false);
        }
      });
  }
}
