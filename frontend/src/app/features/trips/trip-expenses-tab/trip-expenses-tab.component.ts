import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed, input,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { ExpenseService } from '../../../core/services/expense.service';
import { parseApiDate } from '../../../core/utils/date.utils';
import { TripExpense, ExpenseCategory } from '../../../types/schema.types';

const CAT_COLOR: Record<ExpenseCategory, string> = {
  lodging:    '#1565c0',
  food:       '#e65100',
  fuel:       '#2e7d32',
  activities: '#6a1b9a',
  shopping:   '#f57f17',
  other:      '#757575',
};
const CATEGORIES: ExpenseCategory[] = ['lodging','food','fuel','activities','shopping','other'];

@Component({
  selector: 'app-trip-expenses-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, CurrencyPipe, DatePipe, TitleCasePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule,
    MatProgressSpinnerModule, MatDividerModule, MatSnackBarModule,
    BaseChartDirective,
  ],
  styles: [`
    .summary-row { display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px; }
    .summary-card { padding:14px 18px; border-radius:12px; background:var(--wp-surface); min-width:140px; }
    .summary-label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--wp-text-hint); }
    .summary-val   { font-size:22px; font-weight:700; color:var(--wp-primary); margin-top:2px; }
    .summary-sub   { font-size:12px; color:var(--wp-text-secondary); }

    .chart-wrap { max-width:280px; margin:0 auto 24px; }

    .add-form { padding:16px; border-radius:12px; background:var(--wp-surface-variant); margin-bottom:20px; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; }
    .full { grid-column:1/-1; }
    .form-actions { display:flex; gap:8px; margin-top:8px; }

    .cat-chips { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .chip {
      padding:3px 12px; border-radius:14px; border:1.5px solid var(--wp-border);
      background:var(--wp-surface); cursor:pointer; font-size:13px; color:var(--wp-text-secondary);
    }
    .chip.active { color:#fff; border-color:transparent; }

    .expense-row {
      display:flex; align-items:center; padding:10px 0; gap:10px;
      border-bottom:1px solid var(--wp-divider);
    }
    .cat-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .exp-desc { flex:1; font-size:14px; }
    .exp-cat  { font-size:12px; color:var(--wp-text-hint); }
    .exp-date { font-size:12px; color:var(--wp-text-hint); }
    .exp-amt  { font-size:15px; font-weight:600; color:var(--wp-text-primary); white-space:nowrap; }
    .exp-actions { display:flex; gap:2px; }

    .edit-form { padding:10px 12px; background:var(--wp-surface-variant); border-radius:8px; margin:6px 0; }
    .empty { text-align:center; color:var(--wp-text-secondary); padding:40px 0; }
  `],
  template: `
    <div style="padding-top:20px">
      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="40" /></div>
      } @else {

        <!-- Summary cards -->
        <div class="summary-row">
          <div class="summary-card">
            <div class="summary-label">Total spent</div>
            <div class="summary-val">{{ total() | currency:'USD':'symbol':'1.0-0' }}</div>
            @if (budget()) {
              <div class="summary-sub">of {{ budget()! | currency:'USD':'symbol':'1.0-0' }} budget</div>
            }
          </div>
          @for (cat of spentByCategory(); track cat.category) {
            <div class="summary-card">
              <div class="summary-label">{{ cat.category | titlecase }}</div>
              <div class="summary-val" [style.color]="catColor(cat.category)">
                {{ cat.amount | currency:'USD':'symbol':'1.0-0' }}
              </div>
            </div>
          }
        </div>

        <!-- Donut chart -->
        @if (chartData().datasets[0].data.length > 0) {
          <div class="chart-wrap">
            <canvas baseChart type="doughnut" [data]="chartData()" [options]="chartOptions"></canvas>
          </div>
          <mat-divider style="margin-bottom:20px" />
        }

        <!-- Add expense -->
        @if (!showAdd()) {
          <button mat-stroked-button (click)="showAdd.set(true)" style="margin-bottom:16px">
            <mat-icon>add</mat-icon> Add Expense
          </button>
        } @else {
          <div class="add-form">
            <form [formGroup]="addForm" (ngSubmit)="addExpense()">
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Category *</mat-label>
                  <mat-select formControlName="category">
                    @for (c of categories; track c) {
                      <mat-option [value]="c">{{ c | titlecase }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Amount *</mat-label>
                  <input matInput type="number" step="0.01" formControlName="amount" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Description *</mat-label>
                  <input matInput formControlName="description" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Date</mat-label>
                  <input matInput [matDatepicker]="addPicker" formControlName="expense_date" />
                  <mat-datepicker-toggle matSuffix [for]="addPicker" />
                  <mat-datepicker #addPicker />
                </mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="addForm.invalid || saving()">
                  {{ saving() ? 'Saving…' : 'Add' }}
                </button>
                <button mat-stroked-button type="button" (click)="showAdd.set(false)">Cancel</button>
              </div>
            </form>
          </div>
        }

        <!-- Category filter chips -->
        <div class="cat-chips">
          <span class="chip" [class.active]="catFilter() === ''"
                [style.background]="catFilter() === '' ? 'var(--wp-primary)' : ''"
                (click)="catFilter.set('')">All</span>
          @for (c of categories; track c) {
            @if (amountFor(c) > 0) {
              <span class="chip" [class.active]="catFilter() === c"
                    [style.background]="catFilter() === c ? catColor(c) : ''"
                    (click)="catFilter.set(catFilter() === c ? '' : c)">
                {{ c | titlecase }}
              </span>
            }
          }
        </div>

        <!-- Expense list -->
        @if (filtered().length === 0) {
          <div class="empty">No expenses yet</div>
        } @else {
          @for (e of filtered(); track e.id) {
            @if (editingId() === e.id) {
              <div class="edit-form">
                <form [formGroup]="editForm" (ngSubmit)="saveEdit(e.id)">
                  <div class="form-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Category</mat-label>
                      <mat-select formControlName="category">
                        @for (c of categories; track c) {
                          <mat-option [value]="c">{{ c | titlecase }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Amount</mat-label>
                      <input matInput type="number" step="0.01" formControlName="amount" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full">
                      <mat-label>Description</mat-label>
                      <input matInput formControlName="description" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Date</mat-label>
                      <input matInput [matDatepicker]="editPicker" formControlName="expense_date" />
                      <mat-datepicker-toggle matSuffix [for]="editPicker" />
                      <mat-datepicker #editPicker />
                    </mat-form-field>
                  </div>
                  <div class="form-actions">
                    <button mat-raised-button color="primary" type="submit" [disabled]="editForm.invalid || saving()">Save</button>
                    <button mat-stroked-button type="button" (click)="editingId.set(null)">Cancel</button>
                  </div>
                </form>
              </div>
            } @else {
              <div class="expense-row">
                <div class="cat-dot" [style.background]="catColor(e.category)"></div>
                <div style="flex:1">
                  <div class="exp-desc">{{ e.description }}</div>
                  <div style="display:flex;gap:8px">
                    <span class="exp-cat">{{ e.category | titlecase }}</span>
                    @if (e.expense_date) {
                      <span class="exp-date">· {{ e.expense_date | date:'MMM d':'UTC' }}</span>
                    }
                  </div>
                </div>
                <span class="exp-amt">{{ e.amount | currency:'USD':'symbol':'1.2-2' }}</span>
                <div class="exp-actions">
                  <button mat-icon-button (click)="startEdit(e)"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteExpense(e.id)"><mat-icon>delete</mat-icon></button>
                </div>
              </div>
            }
          }
        }
      }
    </div>
  `,
})
export class TripExpensesTabComponent implements OnInit {
  tripId = input.required<number>();
  budget = input<number | null>(null);

  private svc = inject(ExpenseService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  expenses = signal<TripExpense[]>([]);
  showAdd = signal(false);
  editingId = signal<number | null>(null);
  catFilter = signal('');

  readonly categories = CATEGORIES;

  readonly chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
  };

  filtered = computed(() => {
    const f = this.catFilter();
    const list = [...this.expenses()].sort((a, b) =>
      (b.expense_date ?? b.created_at).localeCompare(a.expense_date ?? a.created_at),
    );
    return f ? list.filter((e) => e.category === f) : list;
  });

  total = computed(() => this.expenses().reduce((s, e) => s + Number(e.amount), 0));

  spentByCategory = computed(() =>
    CATEGORIES
      .map((cat) => ({ category: cat, amount: this.amountFor(cat) }))
      .filter((c) => c.amount > 0),
  );

  chartData = computed<ChartData<'doughnut'>>(() => {
    const cats = this.spentByCategory();
    return {
      labels: cats.map((c) => c.category.charAt(0).toUpperCase() + c.category.slice(1)),
      datasets: [{
        data: cats.map((c) => c.amount),
        backgroundColor: cats.map((c) => CAT_COLOR[c.category as ExpenseCategory]),
      }],
    };
  });

  addForm = this.fb.group({
    category:     ['food' as ExpenseCategory, Validators.required],
    description:  ['', Validators.required],
    amount:       [null as number | null, Validators.required],
    expense_date: [null as Date | null],
  });

  editForm = this.fb.group({
    category:     ['food' as ExpenseCategory, Validators.required],
    description:  ['', Validators.required],
    amount:       [null as number | null, Validators.required],
    expense_date: [null as Date | null],
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.svc.list(this.tripId()).subscribe({
      next: (e) => { this.expenses.set(e); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private fmtDate(d: Date | null): string | null {
    return d ? d.toISOString().split('T')[0] : null;
  }

  amountFor(cat: string): number {
    return this.expenses().filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
  }

  catColor(cat: string): string { return CAT_COLOR[cat as ExpenseCategory] ?? '#999'; }

  addExpense() {
    if (this.addForm.invalid) return;
    this.saving.set(true);
    const raw = this.addForm.getRawValue();
    this.svc.create(this.tripId(), { ...raw, expense_date: this.fmtDate(raw.expense_date) }).subscribe({
      next: () => { this.load(); this.showAdd.set(false); this.addForm.reset({ category: 'food' }); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  startEdit(e: TripExpense) {
    this.editForm.patchValue({
      category: e.category, description: e.description,
      amount: e.amount, expense_date: e.expense_date ? parseApiDate(e.expense_date) : null,
    });
    this.editingId.set(e.id);
  }

  saveEdit(id: number) {
    if (this.editForm.invalid) return;
    this.saving.set(true);
    const raw = this.editForm.getRawValue();
    this.svc.update(this.tripId(), id, { ...raw, expense_date: this.fmtDate(raw.expense_date) }).subscribe({
      next: () => { this.load(); this.editingId.set(null); this.saving.set(false); },
      error: () => { this.snack.open('Save failed', 'Dismiss', { duration: 3000 }); this.saving.set(false); },
    });
  }

  deleteExpense(id: number) {
    if (!confirm('Delete this expense?')) return;
    this.svc.delete(this.tripId(), id).subscribe(() => this.load());
  }
}
