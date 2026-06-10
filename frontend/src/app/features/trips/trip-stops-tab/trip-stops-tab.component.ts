import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed, input, output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StopService } from '../../../core/services/stop.service';
import { DestinationService } from '../../../core/services/destination.service';
import { LodgingService } from '../../../core/services/lodging.service';
import { TripStop, TripStopStatus, Destination, Lodging } from '../../../types/schema.types';

const STATUS_COLOR: Record<TripStopStatus, string> = {
  upcoming: '#1565c0', current: '#2e7d32', completed: '#6a1b9a',
};

@Component({
  selector: 'app-trip-stops-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  styles: [`
    .timeline { position:relative; padding-left:32px; }
    .timeline::before {
      content:''; position:absolute; left:10px; top:0; bottom:0;
      width:2px; background:var(--wp-border);
    }
    .stop-item { position:relative; margin-bottom:16px; }
    .stop-dot {
      position:absolute; left:-26px; top:14px;
      width:14px; height:14px; border-radius:50%;
      background:var(--wp-primary); border:2px solid var(--wp-surface);
      box-shadow:0 0 0 2px var(--wp-primary);
    }
    .stop-card { padding:12px 14px; }
    .stop-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .stop-num { font-size:11px; color:var(--wp-text-hint); font-weight:600; text-transform:uppercase; letter-spacing:.8px; }
    .stop-name { font-size:15px; font-weight:600; flex:1; margin:2px 0; }
    .stop-loc  { font-size:13px; color:var(--wp-text-secondary); margin:0 0 4px; }
    .stop-dates { font-size:13px; color:var(--wp-text-secondary); margin:0 0 6px; }
    .stop-meta  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .stop-status {
      padding:2px 10px; border-radius:10px; font-size:12px; font-weight:500;
      background:var(--wp-surface-variant); cursor:pointer;
    }
    .stop-actions { display:flex; gap:4px; margin-left:auto; }
    .stop-lodging { font-size:13px; color:var(--wp-text-secondary); display:flex; align-items:center; gap:4px; }
    .directions-btn { margin-top:10px; width:100%; }

    .add-btn { margin-top:12px; }
    .add-form { margin-top:16px; padding:16px; border-radius:12px; background:var(--wp-surface-variant); }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; }
    .full { grid-column:1/-1; }
    .form-actions { display:flex; gap:8px; margin-top:8px; }
    .empty { text-align:center; color:var(--wp-text-secondary); padding:32px 0; }
  `],
  template: `
    <div style="padding-top:20px">
      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="40" /></div>
      } @else {

        @if (sorted().length === 0 && !showAdd()) {
          <div class="empty">
            <p>No stops yet — add your first destination below.</p>
          </div>
        } @else {
          <div class="timeline">
            @for (stop of sorted(); track stop.id) {
              <div class="stop-item">
                <div class="stop-dot"></div>

                @if (editingId() === stop.id) {
                  <!-- Inline edit form -->
                  <mat-card class="add-form">
                    <form [formGroup]="editForm" (ngSubmit)="saveEdit(stop)">
                      <div class="form-grid">
                        <mat-form-field appearance="outline">
                          <mat-label>Destination</mat-label>
                          <mat-select formControlName="destination_id">
                            <mat-option [value]="null">— none —</mat-option>
                            @for (d of allDests(); track d.id) {
                              <mat-option [value]="d.id">{{ d.name }} — {{ d.city }}, {{ d.state_province }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Lodging</mat-label>
                          <mat-select formControlName="lodging_id">
                            <mat-option [value]="null">— none —</mat-option>
                            @for (l of allLodgings(); track l.id) {
                              <mat-option [value]="l.id">{{ l.name }} — {{ l.city }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Arrival date</mat-label>
                          <input matInput [matDatepicker]="ep1" formControlName="arrival_date" />
                          <mat-datepicker-toggle matSuffix [for]="ep1" />
                          <mat-datepicker #ep1 />
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Departure date</mat-label>
                          <input matInput [matDatepicker]="ep2" formControlName="departure_date" />
                          <mat-datepicker-toggle matSuffix [for]="ep2" />
                          <mat-datepicker #ep2 />
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="full">
                          <mat-label>Notes</mat-label>
                          <textarea matInput formControlName="notes" rows="2"></textarea>
                        </mat-form-field>
                      </div>
                      <div class="form-actions">
                        <button mat-raised-button color="primary" type="submit" [disabled]="saving()">
                          {{ saving() ? 'Saving…' : 'Update Stop' }}
                        </button>
                        <button mat-stroked-button type="button" (click)="editingId.set(null)">Cancel</button>
                      </div>
                    </form>
                  </mat-card>
                } @else {
                  <mat-card class="stop-card">
                    <div class="stop-header">
                      <span class="stop-num">Stop {{ stop.stop_order }}</span>
                      <div class="stop-actions">
                        <button mat-icon-button (click)="stopFocused.emit(stop)" title="View on map">
                          <mat-icon>map</mat-icon>
                        </button>
                        <button mat-icon-button (click)="move(stop, 'up')" [disabled]="stop.stop_order === 1" title="Move up">
                          <mat-icon>arrow_upward</mat-icon>
                        </button>
                        <button mat-icon-button (click)="move(stop, 'down')" [disabled]="stop.stop_order === sorted().length" title="Move down">
                          <mat-icon>arrow_downward</mat-icon>
                        </button>
                        <button mat-icon-button (click)="startEdit(stop)" title="Edit">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteStop(stop)" title="Delete">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </div>
                    <p class="stop-name">
                      {{ stop.destination?.name ?? 'Unassigned stop' }}
                    </p>
                    @if (stop.destination) {
                      <p class="stop-loc">{{ stop.destination.city }}, {{ stop.destination.state_province }}</p>
                    }
                    @if (stop.arrival_date || stop.departure_date) {
                      <p class="stop-dates">
                        @if (stop.arrival_date) { Arrive {{ stop.arrival_date | date:'MMM d' }} }
                        @if (stop.arrival_date && stop.departure_date) { → }
                        @if (stop.departure_date) { Depart {{ stop.departure_date | date:'MMM d' }} }
                      </p>
                    }
                    <div class="stop-meta">
                      <span class="stop-status" [style.color]="statusColor(stop.status)"
                            (click)="cycleStatus(stop)">
                        {{ stop.status }}
                      </span>
                      @if (stop.lodging) {
                        <span class="stop-lodging">
                          <mat-icon style="font-size:14px;width:14px;height:14px">hotel</mat-icon>
                          {{ stop.lodging.name }}
                        </span>
                      }
                    </div>
                    @if (stop.notes) {
                      <p style="font-size:13px;color:var(--wp-text-secondary);margin:6px 0 0">{{ stop.notes }}</p>
                    }
                    @if (stop.status === 'current' && nextStopDirectionsUrl(stop); as dirUrl) {
                      <a mat-stroked-button color="primary" class="directions-btn" [href]="dirUrl" target="_blank" rel="noopener">
                        <mat-icon>directions</mat-icon> Get Directions to Next Stop
                      </a>
                    }
                  </mat-card>
                }
              </div>
            }
          </div>
        }

        <!-- Add stop form -->
        @if (showAdd()) {
          <div class="add-form">
            <form [formGroup]="addForm" (ngSubmit)="addStop()">
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Destination</mat-label>
                  <mat-select formControlName="destination_id">
                    <mat-option [value]="null">— none —</mat-option>
                    @for (d of allDests(); track d.id) {
                      <mat-option [value]="d.id">{{ d.name }} — {{ d.city }}, {{ d.state_province }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Lodging</mat-label>
                  <mat-select formControlName="lodging_id">
                    <mat-option [value]="null">— none —</mat-option>
                    @for (l of allLodgings(); track l.id) {
                      <mat-option [value]="l.id">{{ l.name }} — {{ l.city }}</mat-option>
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
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Notes</mat-label>
                  <textarea matInput formControlName="notes" rows="2"></textarea>
                </mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="saving()">
                  {{ saving() ? 'Saving…' : 'Add Stop' }}
                </button>
                <button mat-stroked-button type="button" (click)="showAdd.set(false)">Cancel</button>
              </div>
            </form>
          </div>
        }

        @if (!showAdd()) {
          <button mat-stroked-button class="add-btn" (click)="openAdd()">
            <mat-icon>add</mat-icon> Add Stop
          </button>
        }
      }
    </div>
  `,
})
export class TripStopsTabComponent implements OnInit {
  tripId = input.required<number>();
  stopFocused = output<TripStop>();

  private stopSvc = inject(StopService);
  private destSvc = inject(DestinationService);
  private lodgingSvc = inject(LodgingService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  stops = signal<TripStop[]>([]);
  allDests = signal<Destination[]>([]);
  allLodgings = signal<Lodging[]>([]);
  showAdd = signal(false);
  editingId = signal<number | null>(null);

  sorted = computed(() => [...this.stops()].sort((a, b) => a.stop_order - b.stop_order));

  addForm = this.fb.group({
    destination_id: [null as number | null],
    lodging_id:     [null as number | null],
    arrival_date:   [null as Date | null],
    departure_date: [null as Date | null],
    notes:          [''],
  });

  editForm = this.fb.group({
    destination_id: [null as number | null],
    lodging_id:     [null as number | null],
    arrival_date:   [null as Date | null],
    departure_date: [null as Date | null],
    notes:          [''],
  });

  ngOnInit() {
    forkJoin([
      this.stopSvc.list(this.tripId()),
      this.destSvc.list(),
      this.lodgingSvc.list(),
    ]).subscribe({
      next: ([stops, dests, lodgings]) => {
        this.stops.set(stops);
        this.allDests.set(dests);
        this.allLodgings.set(lodgings);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reload() {
    this.stopSvc.list(this.tripId()).subscribe((stops) => this.stops.set(stops));
  }

  private fmtDate(d: Date | null): string | null {
    return d ? d.toISOString().split('T')[0] : null;
  }

  openAdd() {
    this.addForm.reset({ destination_id: null, lodging_id: null });
    this.showAdd.set(true);
  }

  addStop() {
    this.saving.set(true);
    const raw = this.addForm.getRawValue();
    this.stopSvc.create(this.tripId(), {
      ...raw,
      arrival_date: this.fmtDate(raw.arrival_date as Date | null),
      departure_date: this.fmtDate(raw.departure_date as Date | null),
      stop_order: this.sorted().length + 1,
      status: 'upcoming',
    }).subscribe({
      next: () => { this.reload(); this.showAdd.set(false); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  startEdit(stop: TripStop) {
    this.editForm.patchValue({
      destination_id: stop.destination_id ?? null,
      lodging_id: stop.lodging_id ?? null,
      arrival_date: stop.arrival_date ? new Date(stop.arrival_date) : null,
      departure_date: stop.departure_date ? new Date(stop.departure_date) : null,
      notes: stop.notes ?? '',
    });
    this.editingId.set(stop.id);
  }

  saveEdit(stop: TripStop) {
    this.saving.set(true);
    const raw = this.editForm.getRawValue();
    this.stopSvc.update(this.tripId(), stop.id, {
      ...raw,
      arrival_date: this.fmtDate(raw.arrival_date as Date | null),
      departure_date: this.fmtDate(raw.departure_date as Date | null),
      stop_order: stop.stop_order,
      status: stop.status,
    }).subscribe({
      next: () => { this.reload(); this.editingId.set(null); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  deleteStop(stop: TripStop) {
    if (!confirm(`Delete stop "${stop.destination?.name ?? 'this stop'}"?`)) return;
    this.stopSvc.delete(this.tripId(), stop.id).subscribe(() => this.reload());
  }

  move(stop: TripStop, dir: 'up' | 'down') {
    const list = this.sorted();
    const idx = list.findIndex((s) => s.id === stop.id);
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const other = list[targetIdx];
    forkJoin([
      this.stopSvc.update(this.tripId(), stop.id,  { ...stop,  stop_order: other.stop_order, destination_id: stop.destination_id ?? null, lodging_id: stop.lodging_id ?? null }),
      this.stopSvc.update(this.tripId(), other.id, { ...other, stop_order: stop.stop_order,  destination_id: other.destination_id ?? null, lodging_id: other.lodging_id ?? null }),
    ]).subscribe(() => this.reload());
  }

  cycleStatus(stop: TripStop) {
    const next: Record<TripStopStatus, TripStopStatus> = {
      upcoming: 'current', current: 'completed', completed: 'upcoming',
    };
    this.stopSvc.updateStatus(this.tripId(), stop.id, next[stop.status]).subscribe(() => this.reload());
  }

  statusColor(s: TripStopStatus): string { return STATUS_COLOR[s] ?? '#666'; }

  nextStopDirectionsUrl(stop: TripStop): string | null {
    const cur = stop.destination;
    if (!cur?.latitude || !cur?.longitude) return null;
    const list = this.sorted();
    const idx = list.findIndex((s) => s.id === stop.id);
    const next = list[idx + 1]?.destination;
    if (!next?.latitude || !next?.longitude) return null;
    return `https://www.google.com/maps/dir/?api=1&origin=${cur.latitude},${cur.longitude}&destination=${next.latitude},${next.longitude}&travelmode=driving`;
  }

  protected get Validators() { return Validators; }
}
