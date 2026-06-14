import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StopService } from '../../../core/services/stop.service';
import { LodgingService } from '../../../core/services/lodging.service';
import { PlacesAutocompleteComponent, PlaceSelectedEvent } from '../places-autocomplete/places-autocomplete.component';
import { KeyboardAwareScrollDirective } from '../../directives/keyboard-aware-scroll.directive';
import { detectPlaceType } from '../../../core/utils/stop-location.util';
import { TripStop, TripStopPlaceType } from '../../../types/schema.types';

export interface AddStopSheetData {
  tripId: number;
  nextOrder: number;
  /** Existing stops (sorted by stop_order) — used to populate the "Insert after" selector. */
  stops: TripStop[];
}

const PLACE_TYPE_OPTIONS: { value: TripStopPlaceType; label: string }[] = [
  { value: 'city',      label: 'City / General Area' },
  { value: 'hotel',     label: 'Hotel / Motel' },
  { value: 'rental',    label: 'Vacation Rental' },
  { value: 'residence', label: 'Residence (friend or family)' },
  { value: 'campsite',  label: 'Campsite / RV Park' },
  { value: 'other',     label: 'Other' },
];

@Component({
  selector: 'app-add-stop-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule, MatProgressSpinnerModule,
    PlacesAutocompleteComponent, KeyboardAwareScrollDirective,
  ],
  styles: [`
    .sheet {
      padding: 16px 20px 32px; min-width: 300px; max-width: 500px;
      max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch;
    }
    .sheet-title { font-size: 17px; font-weight: 700; margin: 0 0 12px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
    .full { grid-column: 1 / -1; }
    .add-btn { width: 100%; margin-top: 8px; background: #00695C !important; color: #fff !important; }
    .done { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px 0; }
    .done .check { font-size: 52px; height: 52px; width: 52px; color: var(--wp-primary); }
    .done p { font-size: 16px; font-weight: 600; margin: 0; }
    .spinner-wrap { display: flex; justify-content: center; padding: 24px 0; }
  `],
  template: `
    <div class="sheet" appKeyboardAwareScroll>
      @if (done()) {
        <div class="done">
          <mat-icon class="check">check_circle</mat-icon>
          <p>Stop added!</p>
          <button mat-stroked-button style="margin-top:4px" (click)="close(true)">Close</button>
        </div>
      } @else if (saving()) {
        <div class="spinner-wrap"><mat-spinner diameter="40" /></div>
      } @else {
        <p class="sheet-title">Add a Stop</p>

        <app-places-autocomplete
          placeholder="Search hotel, address, or city…"
          [types]="[]"
          (placeSelected)="onPlaceSelected($event)"
          (cleared)="onPlaceCleared()" />

        @if (selectedPlace()) {
          <form [formGroup]="form" class="form-grid">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Place name</mat-label>
              <input matInput formControlName="place_name" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full">
              <mat-label>Stop type</mat-label>
              <mat-select formControlName="place_type">
                @for (opt of PLACE_TYPE_OPTIONS; track opt.value) {
                  <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Arrival date</mat-label>
              <input matInput [matDatepicker]="ap1" formControlName="arrival_date" />
              <mat-datepicker-toggle matSuffix [for]="ap1" />
              <mat-datepicker #ap1 />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Departure date</mat-label>
              <input matInput [matDatepicker]="ap2" formControlName="departure_date" />
              <mat-datepicker-toggle matSuffix [for]="ap2" />
              <mat-datepicker #ap2 />
            </mat-form-field>

            @if (data.stops.length) {
              <mat-form-field appearance="outline" class="full">
                <mat-label>Insert after</mat-label>
                <mat-select formControlName="insert_after">
                  <mat-option [value]="null">At the end</mat-option>
                  @for (s of data.stops; track s.id) {
                    <mat-option [value]="s.id">After Stop {{ s.stop_order }} — {{ s.display_name ?? ('Stop ' + s.stop_order) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
          </form>
        }

        <button mat-raised-button class="add-btn" [disabled]="!selectedPlace()" (click)="addStop()">
          <mat-icon>add_location_alt</mat-icon> Add Stop
        </button>
      }
    </div>
  `,
})
export class AddStopSheetComponent {
  readonly sheetRef = inject(MatBottomSheetRef<AddStopSheetComponent, boolean>);
  readonly data     = inject<AddStopSheetData>(MAT_BOTTOM_SHEET_DATA);

  private stopSvc    = inject(StopService);
  private lodgingSvc = inject(LodgingService);
  private snack      = inject(MatSnackBar);
  private fb         = inject(FormBuilder);

  readonly PLACE_TYPE_OPTIONS = PLACE_TYPE_OPTIONS;

  saving        = signal(false);
  done          = signal(false);
  selectedPlace = signal<PlaceSelectedEvent | null>(null);

  form = this.fb.group({
    place_name:     [''],
    place_type:     ['city' as TripStopPlaceType],
    arrival_date:   [null as Date | null],
    departure_date: [null as Date | null],
    insert_after:   [null as number | null],
  });

  onPlaceSelected(p: PlaceSelectedEvent) {
    this.selectedPlace.set(p);
    this.form.patchValue({
      place_name: p.name,
      place_type: detectPlaceType(p.types),
    });
  }

  onPlaceCleared() {
    this.selectedPlace.set(null);
    this.form.patchValue({ place_name: '', place_type: 'city' });
  }

  addStop() {
    const place = this.selectedPlace();
    if (!place || this.saving()) return;
    this.saving.set(true);
    const placeType = this.form.getRawValue().place_type as TripStopPlaceType;

    if (placeType === 'hotel') {
      this.lodgingSvc.create({
        name: this.form.getRawValue().place_name || place.name,
        city: place.city, state_province: place.state_province, country: place.country,
        address: place.formatted_address, latitude: place.lat, longitude: place.lng,
        lodging_type: 'hotel', website: place.website, phone: place.phone, pet_friendly: false,
      }).subscribe({
        next:  (lodging) => this.createStop(place, placeType, lodging.id),
        error: () => this.createStop(place, placeType, null),
      });
    } else {
      this.createStop(place, placeType, null);
    }
  }

  private createStop(place: PlaceSelectedEvent, placeType: TripStopPlaceType, lodgingId: number | null) {
    const v = this.form.getRawValue();
    const fmt = (d: Date | null) => d ? d.toISOString().split('T')[0] : null;
    this.stopSvc.create(this.data.tripId, {
      stop_order:      this.data.nextOrder,
      status:          'upcoming',
      arrival_date:    fmt(v.arrival_date as Date | null),
      departure_date:  fmt(v.departure_date as Date | null),
      lodging_id:      lodgingId,
      place_name:      v.place_name || place.name,
      place_address:   place.formatted_address,
      place_type:      placeType,
      place_lat:       place.lat,
      place_lng:       place.lng,
      place_google_id: place.place_id,
    }).subscribe({
      next:  (stop) => this.finalizeOrder(stop.id),
      error: () => {
        this.snack.open('Failed to add stop', 'Dismiss', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }

  /** Persists the new stop's position based on the "Insert after" selection. */
  private finalizeOrder(newStopId: number) {
    const insertAfter = this.form.getRawValue().insert_after;
    const order = this.data.stops.map(s => s.id);
    if (insertAfter == null) {
      order.push(newStopId);
    } else {
      order.splice(order.indexOf(insertAfter) + 1, 0, newStopId);
    }
    this.stopSvc.reorder(this.data.tripId, order).subscribe({
      next:  () => { this.saving.set(false); this.done.set(true); },
      error: () => { this.saving.set(false); this.done.set(true); },
    });
  }

  close(added: boolean) { this.sheetRef.dismiss(added); }
}
