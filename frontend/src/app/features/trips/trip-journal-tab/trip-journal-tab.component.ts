import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, input,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { JournalService } from '../../../core/services/journal.service';
import { TripJournalEntry } from '../../../types/schema.types';
import { parseApiDate } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-trip-journal-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatDatepickerModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  styles: [`
    .entry-card { margin-bottom:14px; padding:16px; cursor:pointer; }
    .entry-header { display:flex; align-items:flex-start; gap:8px; margin-bottom:6px; }
    .entry-date  { font-size:12px; color:var(--wp-text-hint); font-weight:600; }
    .entry-title { font-size:16px; font-weight:600; flex:1; margin:0; }
    .entry-body  { font-size:14px; color:var(--wp-text-secondary); line-height:1.6; margin:0; white-space:pre-wrap; }
    .entry-preview { font-size:14px; color:var(--wp-text-secondary); overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .entry-actions { display:flex; gap:4px; }

    .add-form { padding:16px; border-radius:12px; background:var(--wp-surface-variant); margin-bottom:16px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; }
    .full { grid-column:1/-1; }
    .form-actions { display:flex; gap:8px; margin-top:8px; }
    .empty { text-align:center; color:var(--wp-text-secondary); padding:40px 0; }
  `],
  template: `
    <div style="padding-top:20px">
      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="40" /></div>
      } @else {

        <!-- Add entry -->
        @if (!showAdd()) {
          <button mat-stroked-button (click)="openAdd()" style="margin-bottom:16px">
            <mat-icon>add</mat-icon> Add Journal Entry
          </button>
        } @else {
          <div class="add-form">
            <form [formGroup]="addForm" (ngSubmit)="addEntry()">
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Title (optional)</mat-label>
                  <input matInput formControlName="title" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Date</mat-label>
                  <input matInput [matDatepicker]="addPicker" formControlName="entry_date" />
                  <mat-datepicker-toggle matSuffix [for]="addPicker" />
                  <mat-datepicker #addPicker />
                </mat-form-field>
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Entry *</mat-label>
                  <textarea matInput formControlName="body" rows="5" placeholder="Write about your day…"></textarea>
                </mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="addForm.invalid || saving()">
                  {{ saving() ? 'Saving…' : 'Save Entry' }}
                </button>
                <button mat-stroked-button type="button" (click)="showAdd.set(false)">Cancel</button>
              </div>
            </form>
          </div>
        }

        @if (entries().length === 0) {
          <div class="empty">No journal entries yet — document your adventure!</div>
        }

        @for (entry of entries(); track entry.id) {
          @if (editingId() === entry.id) {
            <div class="add-form">
              <form [formGroup]="editForm" (ngSubmit)="saveEdit(entry.id)">
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Title (optional)</mat-label>
                    <input matInput formControlName="title" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Date</mat-label>
                    <input matInput [matDatepicker]="editPicker" formControlName="entry_date" />
                    <mat-datepicker-toggle matSuffix [for]="editPicker" />
                    <mat-datepicker #editPicker />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full">
                    <mat-label>Entry *</mat-label>
                    <textarea matInput formControlName="body" rows="6"></textarea>
                  </mat-form-field>
                </div>
                <div class="form-actions">
                  <button mat-raised-button color="primary" type="submit" [disabled]="editForm.invalid || saving()">Save</button>
                  <button mat-stroked-button type="button" (click)="editingId.set(null)">Cancel</button>
                </div>
              </form>
            </div>
          } @else {
            <mat-card class="entry-card" (click)="toggleExpand(entry.id)">
              <div class="entry-header">
                <div style="flex:1">
                  <div class="entry-date">{{ entry.entry_date | date:'EEEE, MMMM d, y':'UTC' }}</div>
                  @if (entry.title) { <p class="entry-title">{{ entry.title }}</p> }
                </div>
                <div class="entry-actions" (click)="$event.stopPropagation()">
                  <button mat-icon-button (click)="startEdit(entry)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteEntry(entry.id)"><mat-icon>delete</mat-icon></button>
                </div>
              </div>
              @if (expandedId() === entry.id) {
                <p class="entry-body">{{ entry.body }}</p>
              } @else {
                <p class="entry-preview">{{ entry.body }}</p>
              }
            </mat-card>
          }
        }
      }
    </div>
  `,
})
export class TripJournalTabComponent implements OnInit {
  tripId = input.required<number>();

  private svc = inject(JournalService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  entries = signal<TripJournalEntry[]>([]);
  showAdd = signal(false);
  editingId = signal<number | null>(null);
  expandedId = signal<number | null>(null);

  addForm = this.fb.group({
    title:      [''],
    body:       ['', Validators.required],
    entry_date: [new Date() as Date | null],
  });

  editForm = this.fb.group({
    title:      [''],
    body:       ['', Validators.required],
    entry_date: [null as Date | null],
  });

  ngOnInit() { this.load(); }

  private load() {
    this.svc.list(this.tripId()).subscribe({
      next: (e) => { this.entries.set(e); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private fmtDate(d: Date | null): string {
    return d ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  }

  openAdd() {
    this.addForm.reset({ title: '', body: '', entry_date: new Date() });
    this.showAdd.set(true);
  }

  addEntry() {
    if (this.addForm.invalid) return;
    this.saving.set(true);
    const raw = this.addForm.getRawValue();
    this.svc.create(this.tripId(), {
      ...raw, entry_date: this.fmtDate(raw.entry_date as Date | null),
    }).subscribe({
      next: () => { this.load(); this.showAdd.set(false); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  startEdit(entry: TripJournalEntry) {
    this.editForm.patchValue({
      title: entry.title ?? '',
      body: entry.body,
      entry_date: parseApiDate(entry.entry_date),
    });
    this.editingId.set(entry.id);
  }

  saveEdit(id: number) {
    if (this.editForm.invalid) return;
    this.saving.set(true);
    const raw = this.editForm.getRawValue();
    this.svc.update(this.tripId(), id, {
      ...raw, entry_date: this.fmtDate(raw.entry_date as Date | null),
    }).subscribe({
      next: () => { this.load(); this.editingId.set(null); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  deleteEntry(id: number) {
    if (!confirm('Delete this journal entry?')) return;
    this.svc.delete(this.tripId(), id).subscribe(() => this.load());
  }

  toggleExpand(id: number) {
    this.expandedId.update((cur) => (cur === id ? null : id));
  }
}
