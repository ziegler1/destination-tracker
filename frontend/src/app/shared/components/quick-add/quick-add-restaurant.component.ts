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
import { RestaurantService } from '../../../core/services/restaurant.service';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../places-autocomplete/places-autocomplete.component';

const CUISINES = [
  'American', 'BBQ', 'Bakery / Cafe', 'Breakfast', 'Burgers', 'Chinese',
  'French', 'Greek', 'Indian', 'Italian', 'Japanese', 'Mediterranean',
  'Mexican', 'Pizza', 'Seafood', 'Steakhouse', 'Sushi', 'Thai', 'Vietnamese', 'Other',
];

@Component({
  selector: 'app-quick-add-restaurant',
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
    .star    { font-size: 28px; background: none; border: none; cursor: pointer; padding: 0; line-height: 1; }
    .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
    mat-form-field { width: 100%; }
  `],
  template: `
    <div class="sheet">
      <div class="handle"></div>
      <h3 class="title">🍽️ Quick Add Restaurant</h3>

      <app-places-autocomplete
        placeholder="Search restaurant by name + city…"
        [types]="['establishment']"
        (placeSelected)="onPlace($event)" />

      <form [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Name *</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cuisine</mat-label>
          <mat-select formControlName="cuisine_type">
            <mat-option value="">— none —</mat-option>
            @for (c of cuisines; track c) {
              <mat-option [value]="c">{{ c }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Price Range</mat-label>
          <mat-select formControlName="price_range">
            <mat-option value="">— none —</mat-option>
            <mat-option value="$">$ Inexpensive</mat-option>
            <mat-option value="$$">$$ Moderate</mat-option>
            <mat-option value="$$$">$$$ Expensive</mat-option>
            <mat-option value="$$$$">$$$$ Very Expensive</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="label">Rating</div>
        <div class="stars">
          @for (n of [1,2,3,4,5]; track n) {
            <button type="button" class="star" (click)="form.patchValue({ rating: n })">
              {{ (form.value.rating ?? 0) >= n ? '⭐' : '☆' }}
            </button>
          }
        </div>

        <div style="margin-bottom:16px">
          <mat-slide-toggle formControlName="would_return">Would Return</mat-slide-toggle>
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
            {{ saving() ? 'Saving…' : 'Save Restaurant' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class QuickAddRestaurantComponent {
  private ref    = inject(MatBottomSheetRef<QuickAddRestaurantComponent>);
  private svc    = inject(RestaurantService);
  private snack  = inject(MatSnackBar);
  private fb     = inject(FormBuilder);
  private router = inject(Router);

  saving   = signal(false);
  cuisines = CUISINES;

  form = this.fb.group({
    name:            ['', Validators.required],
    city:            [''],
    state_province:  [''],
    country:         ['USA'],
    address:         [''],
    latitude:        [null as number | null],
    longitude:       [null as number | null],
    google_place_id: [''],
    phone:           [''],
    website:         [''],
    cuisine_type:    [''],
    price_range:     [''],
    rating:          [null as number | null],
    would_return:    [true],
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
      phone:           e.phone   ?? null,
      website:         e.website ?? null,
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
      phone:           v.phone           || null,
      website:         v.website         || null,
      cuisine_type:    v.cuisine_type    || null,
      price_range:     v.price_range     || null,
      rating:          v.rating,
      would_return:    v.would_return,
      highlights:      v.highlights      || null,
      pet_friendly:    false,
    }).subscribe({
      next:  (r) => { this.ref.dismiss(); this.router.navigate(['/restaurants', r.id]); },
      error: () => { this.snack.open('Save failed', undefined, { duration: 3000 }); this.saving.set(false); },
    });
  }

  dismiss() { this.ref.dismiss(); }
}
