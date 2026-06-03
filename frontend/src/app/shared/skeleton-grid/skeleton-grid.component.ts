import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
  selector: 'app-skeleton-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .skeleton-card {
      border-radius: 12px;
      overflow: hidden;
      background: var(--wp-surface);
      box-shadow: 0 2px 8px var(--wp-shadow);
    }
    .sk-img, .sk-line {
      background: linear-gradient(
        90deg,
        var(--wp-surface-variant) 25%,
        var(--wp-border)          50%,
        var(--wp-surface-variant) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    .sk-img  { height: 156px; }
    .sk-body { padding: 14px 16px 16px; }
    .sk-line { height: 12px; border-radius: 6px; margin-bottom: 10px; }
    @keyframes shimmer {
      0%   { background-position:  200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
  template: `
    <div class="skeleton-grid">
      @for (i of items(); track i) {
        <div class="skeleton-card">
          <div class="sk-img"></div>
          <div class="sk-body">
            <div class="sk-line" style="width:68%"></div>
            <div class="sk-line" style="width:45%;margin-bottom:14px"></div>
            <div class="sk-line" style="width:32%;height:9px"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SkeletonGridComponent {
  count = input(6);
  items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
