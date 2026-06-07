import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of, switchMap } from 'rxjs';
import { LodgingService } from '../../../core/services/lodging.service';
import { TripService } from '../../../core/services/trip.service';
import { StopService } from '../../../core/services/stop.service';
import { PhotoService } from '../../../core/services/photo.service';
import { Trip, TripStop } from '../../../types/schema.types';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../places-autocomplete/places-autocomplete.component';
import { KeyboardAwareScrollDirective } from '../../directives/keyboard-aware-scroll.directive';

@Component({
  selector: 'app-quick-add-lodging',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, FormsModule, PlacesAutocompleteComponent,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSlideToggleModule, MatIconModule,
    KeyboardAwareScrollDirective,
  ],
  styles: [`
    .sheet   { padding: 0 16px 32px; max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .handle  { width: 40px; height: 4px; background: var(--wp-border); border-radius: 2px; margin: 10px auto 16px; position: sticky; top: 0; }
    .title   { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
    .label   { font-size: 13px; color: var(--wp-text-secondary); margin-bottom: 4px; }
    .stars   { display: flex; gap: 4px; margin: 4px 0 16px; }
    .star    { font-size: 26px; background: none; border: none; cursor: pointer; padding: 0; line-height: 1; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .toggles { display: flex; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }
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

        <!-- Attach to Trip -->
        @if (trips().length > 0) {
          <hr class="section-divider" />
          <div class="optional-label">🔗 Attach to Trip (optional)</div>

          <mat-form-field appearance="outline">
            <mat-label>Trip</mat-label>
            <mat-select [(ngModel)]="selectedTripId" [ngModelOptions]="{standalone:true}"
                        (ngModelChange)="onTripChange($event)">
              <mat-option [value]="null">— none —</mat-option>
              @for (t of trips(); track t.id) {
                <mat-option [value]="t.id">{{ t.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (selectedTripId && stops().length > 0) {
            <mat-form-field appearance="outline">
              <mat-label>Stop</mat-label>
              <mat-select [(ngModel)]="selectedStopId" [ngModelOptions]="{standalone:true}">
                <mat-option [value]="null">— none —</mat-option>
                @for (s of stops(); track s.id) {
                  <mat-option [value]="s.id">
                    {{ s.destination?.city || s.destination?.name || 'Stop ' + s.stop_order }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        }

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
export class QuickAddLodgingComponent implements OnInit {
  private ref       = inject(MatBottomSheetRef<QuickAddLodgingComponent>);
  private svc       = inject(LodgingService);
  private tripSvc   = inject(TripService);
  private stopSvc   = inject(StopService);
  private photoSvc  = inject(PhotoService);
  private snack     = inject(MatSnackBar);
  private fb        = inject(FormBuilder);
  private router    = inject(Router);

  saving        = signal(false);
  trips         = signal<Trip[]>([]);
  stops         = signal<TripStop[]>([]);
  photoFile     = signal<File | null>(null);
  photoPreview  = signal<string | null>(null);
  selectedTripId: number | null = null;
  selectedStopId: number | null = null;

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

  ngOnInit() {
    this.tripSvc.list().subscribe(ts => {
      const relevant = ts.filter(t => t.status === 'active' || t.status === 'completed').slice(0, 8);
      this.trips.set(relevant);
    });
  }

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

  onTripChange(tripId: number | null) {
    this.selectedStopId = null;
    this.stops.set([]);
    if (tripId) {
      this.stopSvc.list(tripId).subscribe(s => this.stops.set(s));
    }
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
    }).pipe(
      switchMap(lodging => {
        const photo$ = this.photoFile()
          ? this.photoSvc.upload(this.photoFile()!, 'lodging', lodging.id, true)
          : of(null);
        const link$ = (this.selectedTripId && this.selectedStopId)
          ? this.stopSvc.setLodging(this.selectedTripId, this.selectedStopId, lodging.id)
          : of(null);
        return forkJoin([photo$, link$]).pipe(switchMap(() => of(lodging)));
      }),
    ).subscribe({
      next:  (l) => { this.ref.dismiss(); this.router.navigate(['/lodging', l.id]); },
      error: () => { this.snack.open('Save failed', undefined, { duration: 3000 }); this.saving.set(false); },
    });
  }

  dismiss() { this.ref.dismiss(); }
}
