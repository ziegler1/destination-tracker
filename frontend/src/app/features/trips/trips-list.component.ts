import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-trips-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>✈️ Trips</mat-card-title>
          <mat-card-subtitle>Plan and track your road adventures</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content style="padding-top:16px">
          <p style="color:var(--wp-text-secondary)">Trips feature — coming in Phase 1.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class TripsListComponent {}
