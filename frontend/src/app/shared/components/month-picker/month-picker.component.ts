import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

const MONTHS = [
  { full: 'January',   abbr: 'Jan' },
  { full: 'February',  abbr: 'Feb' },
  { full: 'March',     abbr: 'Mar' },
  { full: 'April',     abbr: 'Apr' },
  { full: 'May',       abbr: 'May' },
  { full: 'June',      abbr: 'Jun' },
  { full: 'July',      abbr: 'Jul' },
  { full: 'August',    abbr: 'Aug' },
  { full: 'September', abbr: 'Sep' },
  { full: 'October',   abbr: 'Oct' },
  { full: 'November',  abbr: 'Nov' },
  { full: 'December',  abbr: 'Dec' },
];

@Component({
  selector: 'app-month-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .pill {
      padding: 8px 4px;
      border-radius: 20px;
      border: 1.5px solid var(--wp-border);
      background: var(--wp-surface);
      color: var(--wp-text-secondary);
      font-size: 13px;
      font-weight: 500;
      text-align: center;
      cursor: pointer;
      transition: background .15s, color .15s, border-color .15s;
      user-select: none;
    }
    .pill.active {
      background: var(--wp-primary);
      color: #fff;
      border-color: var(--wp-primary);
    }
    .pill:hover:not(.active) {
      border-color: var(--wp-primary);
      color: var(--wp-primary);
    }
  `],
  template: `
    <div class="grid">
      @for (m of months; track m.full) {
        <button type="button" class="pill"
                [class.active]="isSelected(m.full)"
                (click)="toggle(m.full)">
          {{ m.abbr }}
        </button>
      }
    </div>
  `,
})
export class MonthPickerComponent {
  readonly value = input<string[]>([]);
  readonly valueChange = output<string[]>();

  readonly months = MONTHS;

  isSelected(month: string): boolean {
    return this.value().includes(month);
  }

  toggle(month: string): void {
    const current = this.value();
    const next = current.includes(month)
      ? current.filter((m) => m !== month)
      : [...current, month];
    this.valueChange.emit(next);
  }
}
