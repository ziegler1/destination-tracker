import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DestinationService } from '../../../core/services/destination.service';
import { StopService } from '../../../core/services/stop.service';
import { PlacesAutocompleteComponent, PlaceSelectedEvent } from '../places-autocomplete/places-autocomplete.component';
import { KeyboardAwareScrollDirective } from '../../directives/keyboard-aware-scroll.directive';

export interface AddStopSheetData {
  tripId: number;
  nextOrder: number;
}

@Component({
  selector: 'app-add-stop-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatDatepickerModule, MatProgressSpinnerModule,
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
          placeholder="Add a city or destination…"
          [types]="['(cities)']"
          (placeSelected)="onPlaceSelected($event)"
          (cleared)="onPlaceCleared()" />

        <form [formGroup]="form" class="form-grid">
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
        </form>

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

  private destSvc = inject(DestinationService);
  private stopSvc = inject(StopService);
  private snack   = inject(MatSnackBar);
  private fb      = inject(FormBuilder);

  saving        = signal(false);
  done          = signal(false);
  selectedPlace = signal<PlaceSelectedEvent | null>(null);

  form = this.fb.group({
    arrival_date:   [null as Date | null],
    departure_date: [null as Date | null],
  });

  onPlaceSelected(p: PlaceSelectedEvent) { this.selectedPlace.set(p); }
  onPlaceCleared() { this.selectedPlace.set(null); }

  addStop() {
    const place = this.selectedPlace();
    if (!place || this.saving()) return;
    this.saving.set(true);
    this.createDestinationAndStop({
      name: place.name,
      city: place.city,
      state_province: place.state_province,
      country: place.country,
      latitude: place.lat,
      longitude: place.lng,
      status: 'planned',
    });
  }

  private createDestinationAndStop(dto: Record<string, unknown>) {
    this.destSvc.create(dto).subscribe({
      next:  (dest) => this.createStop(dest.id),
      error: (err: HttpErrorResponse) => {
        if (err.status === 409 && err.error?.duplicate && err.error?.existing?.id) {
          this.createStop(err.error.existing.id);
          return;
        }
        this.snack.open('Failed to save destination', 'Dismiss', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }

  private createStop(destinationId: number) {
    const v = this.form.getRawValue();
    const fmt = (d: Date | null) => d ? d.toISOString().split('T')[0] : null;
    this.stopSvc.create(this.data.tripId, {
      destination_id: destinationId,
      stop_order:     this.data.nextOrder,
      status:         'upcoming',
      arrival_date:   fmt(v.arrival_date as Date | null),
      departure_date: fmt(v.departure_date as Date | null),
    }).subscribe({
      next:  () => { this.saving.set(false); this.done.set(true); },
      error: () => {
        this.snack.open('Failed to add stop', 'Dismiss', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }

  close(added: boolean) { this.sheetRef.dismiss(added); }
}
