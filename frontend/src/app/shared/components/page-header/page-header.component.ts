import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule],
  styles: [`
    .header {
      display: flex; align-items: center; gap: 8px;
      background: var(--wp-bg);
      border-bottom: 1px solid var(--wp-border);
      padding: 12px 16px;
      position: sticky; top: 0; z-index: 50;
    }
    .back-btn {
      display: flex; align-items: center; gap: 2px;
      color: var(--wp-primary) !important;
      font-size: 15px; font-weight: 500;
      padding: 0 8px !important; min-width: 0;
    }
    .title {
      flex: 1; text-align: center;
      font-size: 17px; font-weight: 700;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .actions { display: flex; align-items: center; gap: 4px; min-width: 44px; justify-content: flex-end; }

    @media (min-width: 769px) {
      .header { display: none; }
    }
  `],
  template: `
    <div class="header">
      <div class="actions" style="justify-content:flex-start">
        @if (showBackButton) {
          <button class="back-btn" mat-button (click)="goBack()">
            <mat-icon>chevron_left</mat-icon>{{ backLabel }}
          </button>
        }
      </div>
      <p class="title">{{ title }}</p>
      <div class="actions">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() backRoute?: string;
  @Input() backLabel = 'Back';
  @Input() showBackButton = true;

  private location = inject(Location);
  private router = inject(Router);

  goBack(): void {
    if (this.backRoute) {
      this.router.navigateByUrl(this.backRoute);
    } else {
      this.location.back();
    }
  }
}
