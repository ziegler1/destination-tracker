import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TripService } from '../../../core/services/trip.service';

@Component({
  selector: 'app-trip-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  styles: [`
    mat-card { max-width:640px; margin:0 auto; padding:24px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .full { grid-column:1/-1; }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
    .actions { display:flex; gap:12px; margin-top:8px; }
    h2 { margin:0 0 20px; font-size:20px; font-weight:600; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else {
      <div class="page-container">
        <mat-card>
          <h2>{{ isEdit() ? 'Edit Trip' : 'Plan a Trip' }}</h2>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-grid">

              <mat-form-field appearance="outline" class="full">
                <mat-label>Trip name *</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Pacific Coast Highway Summer Run" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="planning">Planning</mat-option>
                  <mat-option value="active">Active</mat-option>
                  <mat-option value="completed">Completed</mat-option>
                  <mat-option value="cancelled">Cancelled</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Total budget ($)</mat-label>
                <input matInput type="number" step="0.01" formControlName="total_budget" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Start date</mat-label>
                <input matInput [matDatepicker]="startPicker" formControlName="start_date" />
                <mat-datepicker-toggle matSuffix [for]="startPicker" />
                <mat-datepicker #startPicker />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>End date</mat-label>
                <input matInput [matDatepicker]="endPicker" formControlName="end_date" />
                <mat-datepicker-toggle matSuffix [for]="endPicker" />
                <mat-datepicker #endPicker />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="3"></textarea>
              </mat-form-field>

            </div>

            <div class="actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving…' : (isEdit() ? 'Update Trip' : 'Create Trip') }}
              </button>
              <button mat-stroked-button type="button" [routerLink]="isEdit() ? ['/trips', tripId()] : ['/trips']">
                Cancel
              </button>
            </div>
          </form>
        </mat-card>
      </div>
    }
  `,
})
export class TripFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(TripService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  tripId = signal<number | null>(null);

  form = this.fb.group({
    name:         ['', Validators.required],
    description:  [''],
    status:       ['planning', Validators.required],
    start_date:   [null as Date | null],
    end_date:     [null as Date | null],
    total_budget: [null as number | null],
    notes:        [''],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.tripId.set(+id);
      this.loading.set(true);
      this.svc.get(+id).subscribe({
        next: (t) => {
          this.form.patchValue({
            ...t,
            start_date: t.start_date ? new Date(t.start_date) : null,
            end_date:   t.end_date   ? new Date(t.end_date)   : null,
          });
          this.loading.set(false);
        },
        error: () => this.router.navigate(['/trips']),
      });
    }
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const dto = {
      ...raw,
      start_date: raw.start_date ? (raw.start_date as Date).toISOString().split('T')[0] : null,
      end_date:   raw.end_date   ? (raw.end_date   as Date).toISOString().split('T')[0] : null,
    };

    const req = this.isEdit()
      ? this.svc.update(this.tripId()!, dto)
      : this.svc.create(dto);

    req.subscribe({
      next: (t) => this.router.navigate(['/trips', t.id]),
      error: () => {
        this.snack.open('Save failed', 'Dismiss', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }
}
