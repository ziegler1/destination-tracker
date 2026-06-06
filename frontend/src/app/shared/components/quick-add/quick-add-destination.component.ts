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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DestinationService } from '../../../core/services/destination.service';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../places-autocomplete/places-autocomplete.component';

@Component({
  selector: 'app-quick-add-destination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, PlacesAutocompleteComponent,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatDatepickerModule,
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
      <h3 class="title">📍 Quick Add Destination</h3>

      <app-places-autocomplete
        placeholder="Search city or place…"
        [types]="['(cities)']"
        (placeSelected)="onPlace($event)" />

      <form [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Name *</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Status *</mat-label>
          <mat-select formControlName="status">
            <mat-option value="want_to_visit">Want to Visit</mat-option>
            <mat-option value="visited">Visited</mat-option>
            <mat-option value="planned">Planned</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.value.status === 'visited') {
          <mat-form-field appearance="outline">
            <mat-label>Date Visited</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="visited_at" />
            <mat-datepicker-toggle matSuffix [for]="dp" />
            <mat-datepicker #dp />
          </mat-form-field>

          <div class="label">Rating</div>
          <div class="stars">
            @for (n of [1,2,3,4,5]; track n) {
              <button type="button" class="star" (click)="form.patchValue({ rating: n })">
                {{ (form.value.rating ?? 0) >= n ? '⭐' : '☆' }}
              </button>
            }
          </div>
        }

        <mat-form-field appearance="outline">
          <mat-label>Notes (optional)</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dismiss()">Cancel</button>
          <button mat-raised-button color="primary" type="button"
                  [disabled]="saving() || form.invalid"
                  (click)="save()">
            {{ saving() ? 'Saving…' : 'Save Destination' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class QuickAddDestinationComponent {
  private ref    = inject(MatBottomSheetRef<QuickAddDestinationComponent>);
  private svc    = inject(DestinationService);
  private snack  = inject(MatSnackBar);
  private fb     = inject(FormBuilder);
  private router = inject(Router);

  saving = signal(false);

  form = this.fb.group({
    name:           ['', Validators.required],
    city:           [''],
    state_province: [''],
    country:        ['USA'],
    latitude:       [null as number | null],
    longitude:      [null as number | null],
    status:         ['want_to_visit', Validators.required],
    visited_at:     [null as Date | null],
    rating:         [null as number | null],
    notes:          [''],
  });

  onPlace(e: PlaceSelectedEvent) {
    this.form.patchValue({
      name:           e.name || e.city,
      city:           e.city,
      state_province: e.state_province,
      country:        e.country,
      latitude:       e.lat,
      longitude:      e.lng,
    });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.value;
    const dto: Record<string, unknown> = {
      name:           v.name,
      city:           v.city           || '',
      state_province: v.state_province || '',
      country:        v.country        || 'USA',
      latitude:       v.latitude,
      longitude:      v.longitude,
      status:         v.status,
      notes:          v.notes          || null,
    };
    if (v.status === 'visited') {
      dto['visited_at'] = v.visited_at
        ? (v.visited_at as Date).toISOString().slice(0, 10)
        : null;
      dto['rating'] = v.rating;
    }
    this.svc.create(dto).subscribe({
      next:  (d) => { this.ref.dismiss(); this.router.navigate(['/destinations', d.id]); },
      error: () => { this.snack.open('Save failed', undefined, { duration: 3000 }); this.saving.set(false); },
    });
  }

  dismiss() { this.ref.dismiss(); }
}
