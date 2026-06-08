import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule],
  styles: [`
    .empty-state {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: 6px; padding: 40px 20px; color: var(--wp-text-secondary);
    }
    .empty-icon  { font-size: 48px; line-height: 1; margin-bottom: 6px; }
    .empty-title { font-size: 16px; font-weight: 500; color: var(--wp-text-primary, inherit); }
    .empty-subtitle { font-size: 14px; color: var(--wp-text-secondary); max-width: 360px; }
    .empty-cta { margin-top: 12px; color: var(--wp-primary); border-color: var(--wp-primary); }
  `],
  template: `
    <div class="empty-state">
      <div class="empty-icon">{{ icon }}</div>
      <p class="empty-title">{{ title }}</p>
      <p class="empty-subtitle">{{ subtitle }}</p>
      @if (ctaLabel && ctaRoute) {
        <button mat-stroked-button class="empty-cta" [routerLink]="ctaRoute">
          {{ ctaLabel }}
        </button>
      } @else if (ctaLabel) {
        <button mat-stroked-button class="empty-cta" (click)="ctaClick.emit()">
          {{ ctaLabel }}
        </button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = '';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() ctaLabel?: string;
  @Input() ctaRoute?: string;
  @Output() ctaClick = new EventEmitter<void>();
}
