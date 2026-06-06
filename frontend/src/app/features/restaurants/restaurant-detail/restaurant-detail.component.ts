import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { RestaurantService } from '../../../core/services/restaurant.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { MiniMapComponent } from '../../../shared/mini-map/mini-map.component';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { AddToTripSheetComponent } from '../../../shared/components/add-to-trip-sheet/add-to-trip-sheet.component';
import { Restaurant } from '../../../types/schema.types';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule, MatBottomSheetModule,
    MiniMapComponent, PhotoUploaderComponent,
  ],
  styles: [`
    .hero { width:100%; max-height:340px; object-fit:cover; border-radius:12px; margin-bottom:20px; }
    .hero-placeholder {
      width:100%; height:200px; border-radius:12px; margin-bottom:20px;
      background:linear-gradient(135deg,#e65100,#ff6d00);
      display:flex; align-items:center; justify-content:center; font-size:64px;
    }
    .header-row { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
    .title { font-size:26px; font-weight:700; margin:0; }
    .subtitle { font-size:14px; color:var(--wp-text-secondary); margin:4px 0 0; }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }

    .info-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin:16px 0; }
    .info-item label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--wp-text-hint); display:block; }
    .info-item span  { font-size:15px; font-weight:500; }

    .section-title { font-size:16px; font-weight:600; margin:20px 0 10px; }
    .stars { display:flex; align-items:center; gap:2px; }

    .would-return { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; border-radius:12px; font-size:13px; font-weight:500; }
    .would-return.yes { background:#e8f5e9; color:#2e7d32; }
    .would-return.no  { background:#fce4ec; color:#c62828; }

    .ai-box { margin-top:16px; padding:16px; border-radius:8px; background:var(--wp-surface-variant); border-left:3px solid var(--wp-accent); font-size:14px; line-height:1.6; white-space:pre-wrap; }
    .photos-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-top:8px; }
    .photos-grid img { width:100%; height:110px; object-fit:cover; border-radius:8px; }

    .link-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (r) {
      <div class="page-container">

        @if (heroPhoto(r)) {
          <img class="hero" [src]="heroPhoto(r)!" [alt]="r.name" />
        } @else {
          <div class="hero-placeholder">🍽️</div>
        }

        <div class="header-row">
          <div>
            <h1 class="title">{{ r.name }}</h1>
            <p class="subtitle">{{ r.city }}, {{ r.state_province }} · {{ r.country }}</p>
          </div>
          <div class="actions">
            <button mat-raised-button color="primary" (click)="logVisit(r.id)" [disabled]="visitLogging()">
              <mat-icon>add_location_alt</mat-icon>
              {{ visitLogging() ? 'Logged!' : 'Log a Visit' }}
              @if ((r.visit_count ?? 0) > 0) { &nbsp;({{ r.visit_count }}x) }
            </button>
            <button mat-stroked-button color="accent" (click)="openAddToTrip(r)">
              <mat-icon>add_road</mat-icon> Add to Trip
            </button>
            <button mat-stroked-button [routerLink]="['/restaurants', r.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="confirmDelete(r.id)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>

        <div class="info-grid">
          @if (r.cuisine_type) {
            <div class="info-item"><label>Cuisine</label><span>{{ r.cuisine_type }}</span></div>
          }
          @if (r.price_range) {
            <div class="info-item"><label>Price range</label><span>{{ r.price_range }}</span></div>
          }
          @if (r.rating) {
            <div class="info-item">
              <label>Rating</label>
              <span class="stars">
                @for (i of stars(r.rating); track $index) {
                  <mat-icon style="font-size:18px" [class]="i ? 'star' : 'star-empty'">
                    {{ i ? 'star' : 'star_border' }}
                  </mat-icon>
                }
              </span>
            </div>
          }
          @if (r.would_return !== null && r.would_return !== undefined) {
            <div class="info-item">
              <label>Would return?</label>
              <span class="would-return" [class.yes]="r.would_return" [class.no]="!r.would_return">
                <mat-icon style="font-size:16px">{{ r.would_return ? 'thumb_up' : 'thumb_down' }}</mat-icon>
                {{ r.would_return ? 'Yes' : 'No' }}
              </span>
            </div>
          }
          @if (r.pet_friendly) {
            <div class="info-item"><label>Pet friendly</label><span>🐾 Yes</span></div>
          }
        </div>

        @if (r.address || r.phone || r.website) {
          <mat-divider />
          <div class="link-row">
            @if (r.address) {
              <a [href]="mapsUrl(r)" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>map</mat-icon> View on Maps</button>
              </a>
            }
            @if (r.website) {
              <a [href]="r.website" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>language</mat-icon> Website</button>
              </a>
            }
            @if (r.phone) {
              <a [href]="'tel:' + r.phone">
                <button mat-stroked-button><mat-icon>phone</mat-icon> {{ r.phone }}</button>
              </a>
            }
          </div>
        }

        @if (r.highlights) {
          <mat-divider style="margin:16px 0" />
          <p class="section-title">Highlights</p>
          <p style="color:var(--wp-text-secondary); line-height:1.6">{{ r.highlights }}</p>
        }

        @if (r.notes) {
          <p class="section-title">Notes</p>
          <p style="color:var(--wp-text-secondary); line-height:1.6">{{ r.notes }}</p>
        }

        <!-- Mini map -->
        @if (r.latitude && r.longitude) {
          <mat-divider style="margin:16px 0" />
          <p class="section-title">Location</p>
          <app-mini-map [lat]="r.latitude!" [lon]="r.longitude!" [label]="r.name" height="200px" />
        }

        <!-- AI Description -->
        <mat-divider style="margin:16px 0" />
        <p class="section-title">AI Description</p>
        <button mat-stroked-button (click)="generateDescription(r)" [disabled]="aiLoading()">
          <mat-icon>auto_awesome</mat-icon>
          {{ aiLoading() ? 'Generating…' : 'Generate with AI' }}
        </button>
        @if (aiDescription()) {
          <div class="ai-box">{{ aiDescription() }}</div>
          <button mat-stroked-button color="primary" style="margin-top:8px" (click)="saveHighlights()">
            <mat-icon>save</mat-icon> Save to Highlights
          </button>
        }

        <!-- Photos -->
        <mat-divider style="margin:16px 0" />
        <p class="section-title">Photos</p>
        <app-photo-uploader
          entityType="restaurants"
          [entityId]="r.id"
          [photos]="r.photos ?? []"
          (changed)="reloadRestaurant()" />

      </div>
    }
  `,
})
export class RestaurantDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(RestaurantService);
  private claudeSvc = inject(ClaudeService);
  private snack = inject(MatSnackBar);
  private bottomSheet = inject(MatBottomSheet);

  loading      = signal(true);
  visitLogging = signal(false);
  restaurant   = signal<Restaurant | null>(null);
  protected get r(): Restaurant | null { return this.restaurant(); }
  aiLoading    = signal(false);
  aiDescription = signal('');

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (r) => { this.restaurant.set(r); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/restaurants']); },
    });
  }

  heroPhoto(r: Restaurant): string | null {
    const p = r.photos?.find((ph) => ph.is_primary) ?? r.photos?.[0];
    return p?.url ?? r.image_url ?? null;
  }

  stars(rating?: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < (rating ?? 0));
  }

  mapsUrl(r: Restaurant): string {
    if (r.latitude && r.longitude) return `https://www.google.com/maps?q=${r.latitude},${r.longitude}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(`${r.address ?? ''} ${r.city} ${r.state_province}`)}`;
  }

  generateDescription(r: Restaurant) {
    this.aiLoading.set(true);
    this.claudeSvc.restaurantDescription(r).subscribe({
      next: (res) => { this.aiDescription.set(res.result); this.aiLoading.set(false); },
      error: () => {
        this.snack.open('AI generation failed', 'Dismiss', { duration: 3000 });
        this.aiLoading.set(false);
      },
    });
  }

  saveHighlights() {
    const r = this.restaurant();
    if (!r || !this.aiDescription()) return;
    this.svc.update(r.id, { ...r, highlights: this.aiDescription() }).subscribe((updated) => {
      this.restaurant.update((cur) => cur ? { ...cur, highlights: updated.highlights } : cur);
      this.snack.open('Highlights saved!', 'OK', { duration: 2000 });
    });
  }

  reloadRestaurant() {
    const r = this.restaurant();
    if (!r) return;
    this.svc.get(r.id).subscribe((updated) => this.restaurant.set(updated));
  }

  logVisit(id: number) {
    this.visitLogging.set(true);
    this.svc.logVisit(id).subscribe({
      next: ({ visit_count }) => {
        this.restaurant.update(r => r ? { ...r, visit_count } : r);
        this.snack.open('Visit logged!', 'OK', { duration: 2000 });
        setTimeout(() => this.visitLogging.set(false), 1500);
      },
      error: () => { this.snack.open('Failed to log visit', 'Dismiss', { duration: 3000 }); this.visitLogging.set(false); },
    });
  }

  openAddToTrip(r: Restaurant) {
    this.bottomSheet.open(AddToTripSheetComponent, {
      data: { entityType: 'restaurant', entityId: r.id, entityName: r.name },
    });
  }

  confirmDelete(id: number) {
    if (!confirm('Delete this restaurant?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/restaurants']));
  }
}
