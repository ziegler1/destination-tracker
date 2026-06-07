import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit,
} from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, switchMap } from 'rxjs';
import { SpecialInterestService } from '../../../core/services/special-interest.service';
import { PhotoService } from '../../../core/services/photo.service';
import { KeyboardAwareScrollDirective } from '../../directives/keyboard-aware-scroll.directive';

const CATEGORIES = [
  { value: 'winery_brewery',      label: '🍷 Winery / Brewery' },
  { value: 'museum',              label: '🏛️ Museum' },
  { value: 'historic_site',       label: '🏛️ Historic Site' },
  { value: 'state_park',          label: '🌲 State Park' },
  { value: 'national_park',       label: '⛰️ National Park' },
  { value: 'live_music',          label: '🎵 Live Music' },
  { value: 'scenic',              label: '🌅 Scenic' },
  { value: 'roadside_attraction', label: '🗿 Roadside Attraction' },
  { value: 'shopping',            label: '🛍️ Shopping' },
  { value: 'other',               label: '📌 Other' },
];

@Component({
  selector: 'app-quick-add-special-interest',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, FormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSlideToggleModule, MatIconModule,
    KeyboardAwareScrollDirective,
  ],
  styles: [`
    .sheet   { padding: 0 16px 32px; max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .handle  { width: 40px; height: 4px; background: var(--wp-border); border-radius: 2px; margin: 10px auto 16px; position: sticky; top: 0; }
    .title   { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .label   { font-size: 13px; color: var(--wp-text-secondary); margin-bottom: 4px; }
    .stars   { display: flex; gap: 4px; margin: 4px 0 16px; }
    .star    { font-size: 28px; background: none; border: none; cursor: pointer; padding: 0; line-height: 1; }
    .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
    mat-form-field { width: 100%; }
    .photo-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 16px;
    }
    .photo-preview {
      width: 56px; height: 56px; border-radius: 8px; object-fit: cover;
      border: 1px solid var(--wp-border);
    }
  `],
  template: `
    <div class="sheet" appKeyboardAwareScroll>
      <div class="handle"></div>
      <p class="title">🌟 Add Special Interest Place</p>

      <form [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Name *</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Bell's Brewery" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            @for (c of categories; track c.value) {
              <mat-option [value]="c.value">{{ c.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>City *</mat-label>
            <input matInput formControlName="city" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>State *</mat-label>
            <input matInput formControlName="state_province" placeholder="OH" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Highlights</mat-label>
          <textarea matInput formControlName="highlights" rows="2"
                    placeholder="What made it memorable?"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>

        <p class="label">Rating</p>
        <div class="stars">
          @for (n of [1,2,3,4,5]; track n) {
            <button type="button" class="star" (click)="form.patchValue({ rating: n })">
              {{ (form.value.rating ?? 0) >= n ? '★' : '☆' }}
            </button>
          }
        </div>

        <mat-slide-toggle formControlName="would_return" style="margin-bottom:16px">
          Would return
        </mat-slide-toggle>

        <!-- Photo upload -->
        <div class="photo-row">
          @if (photoPreview()) {
            <img class="photo-preview" [src]="photoPreview()!" alt="preview" />
          }
          <button type="button" mat-stroked-button (click)="fileInput.click()">
            <mat-icon>photo_camera</mat-icon>
            {{ photoFile() ? 'Change photo' : 'Add photo' }}
          </button>
          <input #fileInput type="file" accept="image/*" hidden (change)="onFileChange($event)" />
        </div>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="ref.dismiss()">Cancel</button>
          <button mat-raised-button color="primary" type="button"
                  [disabled]="form.invalid || saving()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class QuickAddSpecialInterestComponent {
  ref      = inject(MatBottomSheetRef<QuickAddSpecialInterestComponent>);
  private svc      = inject(SpecialInterestService);
  private photoSvc = inject(PhotoService);
  private snack    = inject(MatSnackBar);
  private fb       = inject(FormBuilder);

  readonly categories = CATEGORIES;

  saving      = signal(false);
  photoFile   = signal<File | null>(null);
  photoPreview = signal<string | null>(null);

  form = this.fb.group({
    name:          ['', Validators.required],
    category:      ['other'],
    city:          ['', Validators.required],
    state_province:['', Validators.required],
    highlights:    [''],
    notes:         [''],
    rating:        [null as number | null],
    would_return:  [false],
  });

  onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.photoFile.set(file);
    const reader = new FileReader();
    reader.onload = ev => this.photoPreview.set(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();

    this.svc.create({
      name:          v.name!,
      category:      v.category as any,
      city:          v.city!,
      state_province:v.state_province!,
      country:       'USA',
      highlights:    v.highlights || undefined,
      notes:         v.notes || undefined,
      rating:        v.rating ?? undefined,
      would_return:  v.would_return ?? false,
    }).pipe(
      switchMap(place => {
        if (!this.photoFile()) return of(place);
        return this.photoSvc.upload(this.photoFile()!, 'special-interests', place.id, true)
          .pipe(switchMap(() => of(place)));
      }),
    ).subscribe({
      next: place => {
        this.saving.set(false);
        this.ref.dismiss(place);
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Save failed', 'Dismiss', { duration: 3000 });
      },
    });
  }
}
