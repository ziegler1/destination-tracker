import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LodgingService } from '../../../core/services/lodging.service';
import { MiniMapComponent } from '../../../shared/mini-map/mini-map.component';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { Lodging, LodgingType } from '../../../types/schema.types';

const TYPE_LABELS: Record<LodgingType, string> = {
  hotel: 'Hotel', motel: 'Motel', airbnb: 'Airbnb',
  resort: 'Resort', campground: 'Campground', other: 'Other',
};

@Component({
  selector: 'app-lodging-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, CurrencyPipe, MatCardModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatChipsModule, MatProgressSpinnerModule, MiniMapComponent, PhotoUploaderComponent,
  ],
  styles: [`
    .hero { width:100%; max-height:320px; object-fit:cover; border-radius:12px; margin-bottom:20px; }
    .hero-placeholder {
      width:100%; height:200px; border-radius:12px; margin-bottom:20px;
      background:linear-gradient(135deg,#004d40,#00897b);
      display:flex; align-items:center; justify-content:center; font-size:64px;
    }
    .header-row { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
    .title { font-size:26px; font-weight:700; margin:0; }
    .subtitle { font-size:14px; color:var(--wp-text-secondary); margin:4px 0 0; }
    .actions { display:flex; gap:8px; }
    .info-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; margin:16px 0; }
    .info-item label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--wp-text-hint); display:block; }
    .info-item span  { font-size:15px; font-weight:500; }
    .section-title { font-size:16px; font-weight:600; margin:20px 0 10px; }
    .amenities-row { display:flex; flex-wrap:wrap; gap:8px; }
    .amenity-chip { padding:4px 12px; border-radius:14px; background:var(--wp-surface-variant); font-size:13px; }
    .would-return { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; border-radius:12px; font-size:13px; font-weight:500; }
    .would-return.yes { background:#e8f5e9; color:#2e7d32; }
    .would-return.no  { background:#fce4ec; color:#c62828; }
    .stars { display:flex; align-items:center; gap:2px; }
    .photos-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-top:8px; }
    .photos-grid img { width:100%; height:110px; object-fit:cover; border-radius:8px; }
    .link-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (l) {
      <div class="page-container">

        @if (heroPhoto(l)) {
          <img class="hero" [src]="heroPhoto(l)!" [alt]="l.name" />
        } @else {
          <div class="hero-placeholder">🏨</div>
        }

        <div class="header-row">
          <div>
            <h1 class="title">{{ l.name }}</h1>
            <p class="subtitle">{{ l.city }}, {{ l.state_province }} · {{ typeLabel(l.lodging_type) }}</p>
          </div>
          <div class="actions">
            <button mat-stroked-button [routerLink]="['/lodging', l.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="confirmDelete(l.id)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>

        <div class="info-grid">
          @if (l.price_per_night) {
            <div class="info-item"><label>Price / night</label><span>{{ l.price_per_night | currency:'USD':'symbol':'1.0-0' }}</span></div>
          }
          @if (l.room_quality) {
            <div class="info-item">
              <label>Room quality</label>
              <span class="stars">
                @for (i of stars(l.room_quality); track $index) {
                  <mat-icon style="font-size:18px" [class]="i ? 'star' : 'star-empty'">{{ i ? 'star' : 'star_border' }}</mat-icon>
                }
              </span>
            </div>
          }
          @if (l.cleanliness) {
            <div class="info-item">
              <label>Cleanliness</label>
              <span class="stars">
                @for (i of stars(l.cleanliness); track $index) {
                  <mat-icon style="font-size:18px" [class]="i ? 'star' : 'star-empty'">{{ i ? 'star' : 'star_border' }}</mat-icon>
                }
              </span>
            </div>
          }
          @if (l.would_return !== null && l.would_return !== undefined) {
            <div class="info-item">
              <label>Would return?</label>
              <span class="would-return" [class.yes]="l.would_return" [class.no]="!l.would_return">
                <mat-icon style="font-size:16px">{{ l.would_return ? 'thumb_up' : 'thumb_down' }}</mat-icon>
                {{ l.would_return ? 'Yes' : 'No' }}
              </span>
            </div>
          }
          @if (l.pet_friendly) {
            <div class="info-item"><label>Pet friendly</label><span>🐾 Yes</span></div>
          }
        </div>

        @if (l.amenities && l.amenities.length > 0) {
          <mat-divider />
          <p class="section-title">Amenities</p>
          <div class="amenities-row">
            @for (a of l.amenities; track a) {
              <span class="amenity-chip">{{ a }}</span>
            }
          </div>
        }

        @if (l.address || l.phone || l.website) {
          <mat-divider style="margin:16px 0" />
          <div class="link-row">
            @if (l.address) {
              <a [href]="mapsUrl(l)" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>map</mat-icon> View on Maps</button>
              </a>
            }
            @if (l.website) {
              <a [href]="l.website" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>language</mat-icon> Website</button>
              </a>
            }
            @if (l.phone) {
              <a [href]="'tel:' + l.phone">
                <button mat-stroked-button><mat-icon>phone</mat-icon> {{ l.phone }}</button>
              </a>
            }
          </div>
        }

        @if (l.highlights || l.notes) {
          <mat-divider style="margin:16px 0" />
          @if (l.highlights) {
            <p class="section-title">Highlights</p>
            <p style="color:var(--wp-text-secondary);line-height:1.6">{{ l.highlights }}</p>
          }
          @if (l.notes) {
            <p class="section-title">Notes</p>
            <p style="color:var(--wp-text-secondary);line-height:1.6">{{ l.notes }}</p>
          }
        }

        <!-- Mini map -->
        @if (l.latitude && l.longitude) {
          <mat-divider style="margin:16px 0" />
          <p class="section-title">Location</p>
          <app-mini-map [lat]="l.latitude!" [lon]="l.longitude!" [label]="l.name" height="200px" />
        }

        <!-- Photos with uploader -->
        <mat-divider style="margin:16px 0" />
        <p class="section-title">Photos</p>
        <app-photo-uploader
          entityType="lodging"
          [entityId]="l.id"
          [photos]="l.photos ?? []"
          (changed)="reloadLodging()" />

      </div>
    }
  `,
})
export class LodgingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(LodgingService);

  loading = signal(true);
  lodging = signal<Lodging | null>(null);
  protected get l(): Lodging | null { return this.lodging(); }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (l) => { this.lodging.set(l); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/lodging']); },
    });
  }

  heroPhoto(l: Lodging): string | null {
    return l.photos?.find((p) => p.is_primary)?.url ?? l.photos?.[0]?.url ?? l.image_url ?? null;
  }
  stars(n?: number): boolean[] { return Array.from({ length: 5 }, (_, i) => i < (n ?? 0)); }
  typeLabel(t: LodgingType): string { return TYPE_LABELS[t] ?? t; }
  mapsUrl(l: Lodging): string {
    if (l.latitude && l.longitude) return `https://www.google.com/maps?q=${l.latitude},${l.longitude}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(`${l.address ?? ''} ${l.city} ${l.state_province}`)}`;
  }
  reloadLodging() {
    const l = this.lodging();
    if (!l) return;
    this.svc.get(l.id).subscribe((updated) => this.lodging.set(updated));
  }

  confirmDelete(id: number) {
    if (!confirm('Delete this lodging?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/lodging']));
  }
}
