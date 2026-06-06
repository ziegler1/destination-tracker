import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FuelService } from '../../../core/services/fuel.service';
import { TripService } from '../../../core/services/trip.service';
import { Trip } from '../../../types/schema.types';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../places-autocomplete/places-autocomplete.component';

@Component({
  selector: 'app-quick-add-fuel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, PlacesAutocompleteComponent,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
  ],
  styles: [`
    .sheet   { padding: 0 16px 24px; max-height: 90vh; overflow-y: auto; }
    .handle  { width: 40px; height: 4px; background: var(--wp-border); border-radius: 2px; margin: 10px auto 16px; }
    .title   { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .empty   { color: var(--wp-text-secondary); font-size: 14px; margin-bottom: 16px; }
    .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
    mat-form-field { width: 100%; }
  `],
  template: `
    <div class="sheet">
      <div class="handle"></div>
      <h3 class="title">⛽ Quick Add Fuel Stop</h3>

      <form [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Trip *</mat-label>
          <mat-select formControlName="trip_id">
            @for (t of trips(); track t.id) {
              <mat-option [value]="t.id">{{ t.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (!trips().length) {
          <p class="empty">No active or planning trips found.</p>
        }

        <app-places-autocomplete
          placeholder="City / location (optional)"
          [types]="['(cities)']"
          (placeSelected)="onPlace($event)" />

        <mat-form-field appearance="outline">
          <mat-label>Station name (optional)</mat-label>
          <input matInput formControlName="station_name" />
        </mat-form-field>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Price / gal ($)</mat-label>
            <input matInput type="number" step="0.001" min="0" formControlName="price_per_gallon" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Gallons</mat-label>
            <input matInput type="number" step="0.01" min="0" formControlName="gallons" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Odometer (optional)</mat-label>
          <input matInput type="number" min="0" formControlName="odometer" />
        </mat-form-field>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dismiss()">Cancel</button>
          <button mat-raised-button color="primary" type="button"
                  [disabled]="saving() || form.invalid"
                  (click)="save()">
            {{ saving() ? 'Saving…' : 'Save Fuel Stop' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class QuickAddFuelComponent implements OnInit {
  private ref     = inject(MatBottomSheetRef<QuickAddFuelComponent>);
  private fuelSvc = inject(FuelService);
  private tripSvc = inject(TripService);
  private snack   = inject(MatSnackBar);
  private fb      = inject(FormBuilder);

  saving = signal(false);
  trips  = signal<Trip[]>([]);

  form = this.fb.group({
    trip_id:         [null as number | null, Validators.required],
    station_name:    [''],
    city:            [''],
    state_province:  [''],
    price_per_gallon: [null as number | null],
    gallons:          [null as number | null],
    odometer:         [null as number | null],
  });

  ngOnInit() {
    this.tripSvc.list().subscribe(trips => {
      const relevant = trips
        .filter(t => t.status === 'active' || t.status === 'planning')
        .slice(0, 20);
      this.trips.set(relevant);
      const active = relevant.find(t => t.status === 'active');
      if (active) this.form.patchValue({ trip_id: active.id });
    });
  }

  onPlace(e: PlaceSelectedEvent) {
    this.form.patchValue({ city: e.city, state_province: e.state_province });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.value;
    this.fuelSvc.create(v.trip_id!, {
      station_name:     v.station_name     || null,
      city:             v.city             || null,
      state_province:   v.state_province   || null,
      price_per_gallon: v.price_per_gallon,
      gallons:          v.gallons,
      odometer:         v.odometer,
      logged_at:        new Date().toISOString(),
    }).subscribe({
      next:  () => { this.snack.open('Fuel stop saved ✓', undefined, { duration: 2500 }); this.ref.dismiss(true); },
      error: () => { this.snack.open('Save failed', undefined, { duration: 3000 }); this.saving.set(false); },
    });
  }

  dismiss() { this.ref.dismiss(); }
}
