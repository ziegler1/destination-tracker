import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  styles: [`
    .hero { max-width:680px; margin:80px auto; text-align:center; padding:0 24px; }
    .hero-icon { font-size:64px; display:block; margin-bottom:16px; }
    .hero-title { font-size:36px; font-weight:800; margin:0 0 8px; color:var(--wp-primary); }
    .hero-sub { font-size:16px; color:var(--wp-text-secondary); margin:0 0 32px; line-height:1.6; }
    .quick-links { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
    .divider { margin:48px auto; max-width:500px; border:none; border-top:1px solid var(--wp-border); }
    .hint { text-align:center; font-size:13px; color:var(--wp-text-hint); }
  `],
  template: `
    <div class="hero">
      <span class="hero-icon">✈️</span>
      <h1 class="hero-title">Your Travel Encyclopedia</h1>
      <p class="hero-sub">
        Plan future adventures, track where you've been,<br/>
        and carry your travel history everywhere you go.
      </p>

      <div class="quick-links">
        <button mat-raised-button color="primary" [routerLink]="['/trips/new']">
          <mat-icon>add_road</mat-icon> Plan a Trip
        </button>
        <button mat-stroked-button [routerLink]="['/trips']">
          <mat-icon>flight_takeoff</mat-icon> My Trips
        </button>
        <button mat-stroked-button [routerLink]="['/travels']">
          <mat-icon>map</mat-icon> My Travels Map
        </button>
      </div>

      <hr class="divider" />
      <p class="hint">Full dashboard with recent trips, stats, and highlights coming soon.</p>
    </div>
  `,
})
export class HomeComponent {}
