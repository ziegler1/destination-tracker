import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RestaurantService } from '../../../core/services/restaurant.service';

const CUISINES = [
  'American', 'BBQ', 'Bakery / Cafe', 'Breakfast', 'Burgers', 'Chinese',
  'French', 'Greek', 'Indian', 'Italian', 'Japanese', 'Mediterranean',
  'Mexican', 'Pizza', 'Seafood', 'Steakhouse', 'Sushi', 'Thai', 'Vietnamese', 'Other',
];

@Component({
  selector: 'app-restaurant-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  styles: [`
    mat-card { max-width:720px; margin:0 auto; padding:24px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
    .full { grid-column:1/-1; }
    .row { display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:8px; }
    .actions { display:flex; gap:12px; margin-top:8px; }
    .star-row { display:flex; gap:4px; cursor:pointer; }
    .star-btn { font-size:28px; background:none; border:none; cursor:pointer; padding:0; line-height:1; }
    h2 { margin:0 0 20px; font-size:20px; font-weight:600; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else {
      <div class="page-container">
        <mat-card>
          <h2>{{ isEdit() ? 'Edit Restaurant' : 'Add Restaurant' }}</h2>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-grid">

              <mat-form-field appearance="outline">
                <mat-label>Name *</mat-label>
                <input matInput formControlName="name" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Cuisine type</mat-label>
                <mat-select formControlName="cuisine_type">
                  <mat-option value="">— none —</mat-option>
                  @for (c of cuisines; track c) {
                    <mat-option [value]="c">{{ c }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>City *</mat-label>
                <input matInput formControlName="city" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>State / Province *</mat-label>
                <input matInput formControlName="state_province" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Country *</mat-label>
                <mat-select formControlName="country">
                  <mat-option value="USA">USA</mat-option>
                  <mat-option value="Canada">Canada</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Price range</mat-label>
                <mat-select formControlName="price_range">
                  <mat-option value="">— none —</mat-option>
                  <mat-option value="$">$ — Budget</mat-option>
                  <mat-option value="$$">$$ — Moderate</mat-option>
                  <mat-option value="$$$">$$$ — Upscale</mat-option>
                  <mat-option value="$$$$">$$$$ — Fine dining</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Address</mat-label>
                <input matInput formControlName="address" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Latitude</mat-label>
                <input matInput type="number" step="any" formControlName="latitude" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Longitude</mat-label>
                <input matInput type="number" step="any" formControlName="longitude" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Website</mat-label>
                <input matInput formControlName="website" />
              </mat-form-field>

              <!-- Rating -->
              <div class="full">
                <div style="font-size:13px;color:var(--wp-text-secondary);margin-bottom:4px">Rating</div>
                <div class="star-row">
                  @for (i of [1,2,3,4,5]; track i) {
                    <button type="button" class="star-btn" (click)="setRating(i)">
                      {{ i <= (form.value.rating ?? 0) ? '⭐' : '☆' }}
                    </button>
                  }
                </div>
              </div>

              <!-- Would return -->
              <mat-form-field appearance="outline">
                <mat-label>Would return?</mat-label>
                <mat-select formControlName="would_return">
                  <mat-option [value]="null">Not rated</mat-option>
                  <mat-option [value]="true">Yes ✓</mat-option>
                  <mat-option [value]="false">No ✗</mat-option>
                </mat-select>
              </mat-form-field>

              <div class="full row" style="gap:24px">
                <mat-slide-toggle formControlName="pet_friendly">Pet friendly</mat-slide-toggle>
              </div>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Highlights</mat-label>
                <textarea matInput formControlName="highlights" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Image URL (fallback)</mat-label>
                <input matInput formControlName="image_url" />
              </mat-form-field>

            </div>

            <div class="actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving…' : (isEdit() ? 'Update' : 'Add Restaurant') }}
              </button>
              <button mat-stroked-button type="button" [routerLink]="isEdit() ? ['/restaurants', restaurantId()] : ['/restaurants']">
                Cancel
              </button>
            </div>
          </form>
        </mat-card>
      </div>
    }
  `,
})
export class RestaurantFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(RestaurantService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  restaurantId = signal<number | null>(null);

  readonly cuisines = CUISINES;

  form = this.fb.group({
    name:          ['', Validators.required],
    city:          ['', Validators.required],
    state_province: ['', Validators.required],
    country:       ['USA', Validators.required],
    address:       [''],
    latitude:      [null as number | null],
    longitude:     [null as number | null],
    cuisine_type:  [''],
    price_range:   [''],
    rating:        [null as number | null],
    would_return:  [null as boolean | null],
    highlights:    [''],
    notes:         [''],
    website:       [''],
    phone:         [''],
    pet_friendly:  [false],
    image_url:     [''],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.restaurantId.set(+id);
      this.loading.set(true);
      this.svc.get(+id).subscribe({
        next: (r) => {
          this.form.patchValue({ ...r, price_range: r.price_range ?? '' });
          this.loading.set(false);
        },
        error: () => this.router.navigate(['/restaurants']),
      });
    }
  }

  setRating(n: number) { this.form.patchValue({ rating: n }); }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const dto = {
      ...raw,
      price_range: raw.price_range || null,
      cuisine_type: raw.cuisine_type || null,
    };

    const req = this.isEdit()
      ? this.svc.update(this.restaurantId()!, dto)
      : this.svc.create(dto);

    req.subscribe({
      next: (r) => this.router.navigate(['/restaurants', r.id]),
      error: () => {
        this.snack.open('Save failed — check required fields', 'Dismiss', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }
}
