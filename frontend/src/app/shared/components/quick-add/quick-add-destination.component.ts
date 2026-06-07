import {
  Component, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, switchMap } from 'rxjs';
import { DestinationService } from '../../../core/services/destination.service';
import { PhotoService } from '../../../core/services/photo.service';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../places-autocomplete/places-autocomplete.component';
import { DuplicateDestinationDialogComponent } from '../duplicate-destination-dialog/duplicate-destination-dialog.component';
import { KeyboardAwareScrollDirective } from '../../directives/keyboard-aware-scroll.directive';

@Component({
  selector: 'app-quick-add-destination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, PlacesAutocompleteComponent,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatDatepickerModule, MatIconModule,
    KeyboardAwareScrollDirective,
  ],
  styles: [`
    .sheet   { padding: 0 16px 32px; max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .handle  { width: 40px; height: 4px; background: var(--wp-border); border-radius: 2px; margin: 10px auto 16px; position: sticky; top: 0; }
    .title   { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
    .label   { font-size: 13px; color: var(--wp-text-secondary); margin-bottom: 4px; }
    .stars   { display: flex; gap: 4px; margin: 4px 0 16px; }
    .star    { font-size: 28px; background: none; border: none; cursor: pointer; padding: 0; line-height: 1; }
    .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
    mat-form-field { width: 100%; }
    .section-divider { margin: 12px 0; border: none; border-top: 1px solid var(--wp-border); }
    .photo-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 16px;
    }
    .photo-preview {
      width: 56px; height: 56px; border-radius: 8px;
      object-fit: cover; flex-shrink: 0;
    }
    .photo-placeholder {
      width: 56px; height: 56px; border-radius: 8px;
      background: var(--wp-surface-variant); border: 1px dashed var(--wp-border);
      display: flex; align-items: center; justify-content: center;
      color: var(--wp-text-secondary); font-size: 22px; flex-shrink: 0;
    }
    .optional-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .8px; color: var(--wp-text-secondary);
      margin: 12px 0 8px;
    }
  `],
  template: `
    <div class="sheet" appKeyboardAwareScroll>
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

        <!-- Photo upload -->
        <hr class="section-divider" />
        <div class="optional-label">📷 Add Photo (optional)</div>
        <div class="photo-row">
          @if (photoPreview()) {
            <img class="photo-preview" [src]="photoPreview()!" alt="Preview" />
          } @else {
            <div class="photo-placeholder">📷</div>
          }
          <div>
            <button type="button" mat-stroked-button (click)="fileInput.click()">
              <mat-icon>upload</mat-icon>
              {{ photoFile() ? 'Change Photo' : 'Choose Photo' }}
            </button>
            @if (photoFile()) {
              <div style="font-size:12px;color:var(--wp-text-secondary);margin-top:4px">
                {{ photoFile()!.name }}
              </div>
            }
          </div>
        </div>
        <input #fileInput type="file" accept="image/*" style="display:none"
               (change)="onFileChange($event)" />

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
  private ref       = inject(MatBottomSheetRef<QuickAddDestinationComponent>);
  private svc       = inject(DestinationService);
  private photoSvc  = inject(PhotoService);
  private snack     = inject(MatSnackBar);
  private fb        = inject(FormBuilder);
  private router    = inject(Router);
  private dialog    = inject(MatDialog);

  saving       = signal(false);
  photoFile    = signal<File | null>(null);
  photoPreview = signal<string | null>(null);

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

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.photoFile.set(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.photoPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      this.photoPreview.set(null);
    }
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
    this.submit(dto, false);
  }

  private submit(dto: Record<string, unknown>, force: boolean) {
    this.svc.create(dto, force).pipe(
      switchMap(dest => {
        if (!this.photoFile()) return of(dest);
        return this.photoSvc.upload(this.photoFile()!, 'destinations', dest.id, true)
          .pipe(switchMap(() => of(dest)));
      }),
    ).subscribe({
      next:  (d) => { this.ref.dismiss(); this.router.navigate(['/destinations', d.id]); },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409 && err.error?.duplicate) {
          this.handleDuplicate(dto, err.error.existing);
          return;
        }
        this.snack.open('Save failed', undefined, { duration: 3000 });
        this.saving.set(false);
      },
    });
  }

  private handleDuplicate(dto: Record<string, unknown>, existing: { id: number; name: string; city: string; state_province: string }) {
    this.dialog.open(DuplicateDestinationDialogComponent, { data: { existing }, width: '420px' })
      .afterClosed().subscribe((result) => {
        if (result === 'view') {
          this.ref.dismiss();
          this.router.navigate(['/destinations', existing.id]);
        } else if (result === 'save-anyway') {
          this.submit(dto, true);
        } else {
          this.saving.set(false);
        }
      });
  }

  dismiss() { this.ref.dismiss(); }
}
