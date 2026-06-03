import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed, input,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FuelService } from '../../../core/services/fuel.service';
import { FuelStop } from '../../../types/schema.types';

@Component({
  selector: 'app-trip-fuel-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, CurrencyPipe, DatePipe, DecimalPipe,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatDatepickerModule, MatProgressSpinnerModule,
    MatDividerModule, MatSnackBarModule,
  ],
  styles: [`
    .summary-row { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
    .stat-card { padding:12px 16px; border-radius:10px; background:var(--wp-surface); min-width:120px; }
    .stat-label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--wp-text-hint); }
    .stat-val   { font-size:20px; font-weight:700; color:var(--wp-primary); margin-top:2px; }

    .fuel-row {
      display:flex; align-items:center; gap:10px; padding:10px 0;
      border-bottom:1px solid var(--wp-divider);
    }
    .fuel-icon { font-size:20px; }
    .fuel-info { flex:1; }
    .fuel-station { font-size:14px; font-weight:500; }
    .fuel-meta { font-size:12px; color:var(--wp-text-hint); }
    .fuel-cost { font-size:15px; font-weight:600; color:var(--wp-primary); white-space:nowrap; }
    .fuel-actions { display:flex; gap:2px; }

    .add-form { padding:16px; border-radius:12px; background:var(--wp-surface-variant); margin-bottom:16px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; }
    .full { grid-column:1/-1; }
    .form-actions { display:flex; gap:8px; margin-top:8px; }
    .edit-form { padding:10px 12px; background:var(--wp-surface-variant); border-radius:8px; margin:4px 0; }
    .empty { text-align:center; color:var(--wp-text-secondary); padding:40px 0; }
  `],
  template: `
    <div style="padding-top:20px">
      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="40" /></div>
      } @else {

        <!-- Summary stats -->
        @if (stops().length > 0) {
          <div class="summary-row">
            <div class="stat-card">
              <div class="stat-label">Total cost</div>
              <div class="stat-val">{{ totalCost() | currency:'USD':'symbol':'1.2-2' }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total gallons</div>
              <div class="stat-val">{{ totalGallons() | number:'1.1-1' }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg price/gal</div>
              <div class="stat-val">{{ avgPrice() | currency:'USD':'symbol':'1.3-3' }}</div>
            </div>
            @if (costPerMile() !== null) {
              <div class="stat-card">
                <div class="stat-label">Cost / mile</div>
                <div class="stat-val">{{ costPerMile()! | currency:'USD':'symbol':'1.2-2' }}</div>
              </div>
            }
          </div>
          <mat-divider style="margin-bottom:20px" />
        }

        <!-- Add fuel stop -->
        @if (!showAdd()) {
          <button mat-stroked-button (click)="openAdd()" style="margin-bottom:16px">
            <mat-icon>add</mat-icon> Log Fuel Stop
          </button>
        } @else {
          <div class="add-form">
            <form [formGroup]="addForm" (ngSubmit)="addStop()">
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Station name</mat-label>
                  <input matInput formControlName="station_name" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>City</mat-label>
                  <input matInput formControlName="city" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>State / Province</mat-label>
                  <input matInput formControlName="state_province" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Price / gallon ($)</mat-label>
                  <input matInput type="number" step="0.001" formControlName="price_per_gallon" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Gallons</mat-label>
                  <input matInput type="number" step="0.001" formControlName="gallons" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Odometer (miles)</mat-label>
                  <input matInput type="number" formControlName="odometer" />
                </mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="saving()">
                  {{ saving() ? 'Saving…' : 'Log Stop' }}
                </button>
                <button mat-stroked-button type="button" (click)="showAdd.set(false)">Cancel</button>
              </div>
            </form>
          </div>
        }

        <!-- Fuel stops list -->
        @if (stops().length === 0) {
          <div class="empty">No fuel stops logged yet.</div>
        }

        @for (stop of stops(); track stop.id) {
          @if (editingId() === stop.id) {
            <div class="edit-form">
              <form [formGroup]="editForm" (ngSubmit)="saveEdit(stop.id)">
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Station name</mat-label>
                    <input matInput formControlName="station_name" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>City</mat-label>
                    <input matInput formControlName="city" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Price / gallon</mat-label>
                    <input matInput type="number" step="0.001" formControlName="price_per_gallon" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Gallons</mat-label>
                    <input matInput type="number" step="0.001" formControlName="gallons" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Odometer</mat-label>
                    <input matInput type="number" formControlName="odometer" />
                  </mat-form-field>
                </div>
                <div class="form-actions">
                  <button mat-raised-button color="primary" type="submit" [disabled]="saving()">Save</button>
                  <button mat-stroked-button type="button" (click)="editingId.set(null)">Cancel</button>
                </div>
              </form>
            </div>
          } @else {
            <div class="fuel-row">
              <span class="fuel-icon">⛽</span>
              <div class="fuel-info">
                <div class="fuel-station">{{ stop.station_name ?? 'Fuel stop' }}</div>
                <div class="fuel-meta">
                  @if (stop.city) { {{ stop.city }}@if (stop.state_province) {, {{ stop.state_province }}} · }
                  @if (stop.gallons) { {{ stop.gallons | number:'1.1-2' }} gal · }
                  @if (stop.price_per_gallon) { {{ stop.price_per_gallon | currency:'USD':'symbol':'1.3-3' }}/gal · }
                  @if (stop.odometer) { {{ stop.odometer | number }} mi }
                </div>
              </div>
              @if (stop.gallons && stop.price_per_gallon) {
                <span class="fuel-cost">{{ stop.gallons * stop.price_per_gallon | currency:'USD':'symbol':'1.2-2' }}</span>
              }
              <div class="fuel-actions">
                <button mat-icon-button (click)="startEdit(stop)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="deleteStop(stop.id)"><mat-icon>delete</mat-icon></button>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class TripFuelTabComponent implements OnInit {
  tripId = input.required<number>();

  private svc = inject(FuelService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  stops = signal<FuelStop[]>([]);
  showAdd = signal(false);
  editingId = signal<number | null>(null);

  totalCost = computed(() =>
    this.stops().reduce((s, f) => s + (Number(f.gallons ?? 0) * Number(f.price_per_gallon ?? 0)), 0),
  );

  totalGallons = computed(() =>
    this.stops().reduce((s, f) => s + Number(f.gallons ?? 0), 0),
  );

  avgPrice = computed(() => {
    const s = this.stops().filter((f) => f.price_per_gallon);
    return s.length ? s.reduce((acc, f) => acc + Number(f.price_per_gallon), 0) / s.length : 0;
  });

  costPerMile = computed((): number | null => {
    const readings = this.stops().map((f) => f.odometer).filter(Boolean) as number[];
    if (readings.length < 2) return null;
    const miles = Math.max(...readings) - Math.min(...readings);
    return miles > 0 ? this.totalCost() / miles : null;
  });

  addForm = this.fb.group({
    station_name:    [''],
    city:            [''],
    state_province:  [''],
    price_per_gallon:[null as number | null],
    gallons:         [null as number | null],
    odometer:        [null as number | null],
  });

  editForm = this.fb.group({
    station_name:    [''],
    city:            [''],
    state_province:  [''],
    price_per_gallon:[null as number | null],
    gallons:         [null as number | null],
    odometer:        [null as number | null],
  });

  ngOnInit() { this.load(); }

  private load() {
    this.svc.list(this.tripId()).subscribe({
      next: (s) => { this.stops.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openAdd() { this.addForm.reset(); this.showAdd.set(true); }

  addStop() {
    this.saving.set(true);
    this.svc.create(this.tripId(), this.addForm.getRawValue()).subscribe({
      next: () => { this.load(); this.showAdd.set(false); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  startEdit(stop: FuelStop) {
    this.editForm.patchValue({
      station_name: stop.station_name ?? '',
      city: stop.city ?? '',
      state_province: stop.state_province ?? '',
      price_per_gallon: stop.price_per_gallon ?? null,
      gallons: stop.gallons ?? null,
      odometer: stop.odometer ?? null,
    });
    this.editingId.set(stop.id);
  }

  saveEdit(id: number) {
    this.saving.set(true);
    this.svc.update(this.tripId(), id, this.editForm.getRawValue()).subscribe({
      next: () => { this.load(); this.editingId.set(null); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  deleteStop(id: number) {
    if (!confirm('Delete this fuel stop?')) return;
    this.svc.delete(this.tripId(), id).subscribe(() => this.load());
  }
}
