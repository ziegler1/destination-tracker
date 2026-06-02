import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-lodging-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule],
  template: `
    <div class="page-container">
      <mat-card>
        <mat-card-header><mat-card-title>🏨 Lodging</mat-card-title></mat-card-header>
        <mat-card-content style="padding-top:16px">
          <p style="color:var(--wp-text-secondary)">Lodging feature — coming in Phase 1.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class LodgingListComponent {}
