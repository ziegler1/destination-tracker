import {
  Component, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LodgingService } from '../../../core/services/lodging.service';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../places-autocomplete/places-autocomplete.component';

@Component({
  selector: 'app-quick-add-lodging',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, PlacesAutocompleteComponent,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSlideToggleModule,
  ],
  styles: [`
    .sheet   { padding: 0 16px 24px; max-height: 90vh; overflow-y: auto; }
    .handle  { width: 40px; height: 4px; background: var(--wp-border); border-radius: 2px; margin: 10px auto 16px; }
    .title   { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
    .label   { font-size: 13px; color: var(--wp-text-secondary); margin-bottom: 4px; }
    .stars   { display: flex; gap: 4px; margin: 4px 0 16px; }
    .star    { font-size: 26px; background: none; border: none; cursor: pointer; padding: 0; line-height: 1; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .toggles { display: flex; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }
    .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
    mat-form-field { width: 100%; }
  `],
  template: `
    <div class="sheet">
      <div class="handle"></div>
      <h3 class="title">🏨 Quick Add Lodging</h3>

      <app-places-autocomplete
        placeholder="Search hotel, motel, Airbnb…"
        [types]="['lodging']"
        (placeSelected)="onPlace($event)" />

      <form [formGroup]="form">
        <div class="two-col">
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
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Price per night ($)</mat-label>
          <input matInput type="number" min="0" formControlName="price_per_night" />
        </mat-form-field>

        <div class="label">Room Quality</div>
        <div class="stars">
          @for (n of [1,2,3,4,5]; track n) {
            <button type="button" class="star" (click)="form.patchValue({ room_quality: n })">
              {{ (form.value.room_quality ?? 0) >= n ? '⭐' : '☆' }}
            </button>
          }
        </div>

        <div class="label">Cleanliness</div>
        <div class="stars">
          @for (n of [1,2,3,4,5]; track n) {
            <button type="button" class="star" (click)="form.patchValue({ cleanliness: n })">
              {{ (form.value.cleanliness ?? 0) >= n ? '⭐' : '☆' }}
            </button>
          }
        </div>

        <div class="toggles">
          <mat-slide-toggle formControlName="would_return">Would Return</mat-slide-toggle>
          <mat-slide-toggle formControlName="pet_friendly">Pet Friendly</mat-slide-toggle>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Highlights (optional)</mat-label>
          <textarea matInput formControlName="highlights" rows="2"></textarea>
        </mat-form-field>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dismiss()">Cancel</button>
          <button mat-raised-button color="primary" type="button"
                  [disabled]="saving() || form.invalid"
                  (click)="save()">
            {{ saving() ? 'Saving…' : 'Save Lodging' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class QuickAddLodgingComponent {
  private ref    = inject(MatBottomSheetRef<QuickAddLodgingComponent>);
  private svc    = inject(LodgingService);
  private snack  = inject(MatSnackBar);
  private fb     = inject(FormBuilder);
  private router = inject(Router);

  saving = signal(false);

  form = this.fb.group({
    name:            ['', Validators.required],
    city:            [''],
    state_province:  [''],
    country:         ['USA'],
    address:         [''],
    latitude:        [null as number | null],
    longitude:       [null as number | null],
    google_place_id: [''],
    lodging_type:    ['hotel', Validators.required],
    price_per_night: [null as number | null],
    room_quality:    [null as number | null],
    cleanliness:     [null as number | null],
    would_return:    [true],
    pet_friendly:    [false],
    highlights:      [''],
  });

  onPlace(e: PlaceSelectedEvent) {
    this.form.patchValue({
      name:            e.name,
      city:            e.city,
      state_province:  e.state_province,
      country:         e.country,
      address:         e.formatted_address,
      latitude:        e.lat,
      longitude:       e.lng,
      google_place_id: e.place_id,
    });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.value;
    this.svc.create({
      name:            v.name,
      city:            v.city            || '',
      state_province:  v.state_province  || '',
      country:         v.country         || 'USA',
      address:         v.address         || null,
      latitude:        v.latitude,
      longitude:       v.longitude,
      google_place_id: v.google_place_id || null,
      lodging_type:    v.lodging_type,
      price_per_night: v.price_per_night,
      room_quality:    v.room_quality,
      cleanliness:     v.cleanliness,
      would_return:    v.would_return,
      pet_friendly:    v.pet_friendly,
      highlights:      v.highlights      || null,
    }).subscribe({
      next:  (l) => { this.ref.dismiss(); this.router.navigate(['/lodging', l.id]); },
      error: () => { this.snack.open('Save failed', undefined, { duration: 3000 }); this.saving.set(false); },
    });
  }

  dismiss() { this.ref.dismiss(); }
}
