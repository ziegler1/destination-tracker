import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { SpecialInterestService } from '../../../core/services/special-interest.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { MiniMapComponent } from '../../../shared/mini-map/mini-map.component';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { AddToTripSheetComponent } from '../../../shared/components/add-to-trip-sheet/add-to-trip-sheet.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SpecialInterestPlace, SpecialInterestCategory } from '../../../types/schema.types';

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  winery_brewery:      { icon: '🍷', label: 'Winery / Brewery' },
  bourbon_distillery:  { icon: '🥃', label: 'Bourbon Distillery' },
  museum:              { icon: '🏛️', label: 'Museum' },
  historic_site:       { icon: '🏛️', label: 'Historic Site' },
  state_park:          { icon: '🌲', label: 'State Park' },
  national_park:       { icon: '⛰️', label: 'National Park' },
  live_music:          { icon: '🎵', label: 'Live Music' },
  scenic:              { icon: '🌅', label: 'Scenic' },
  roadside_attraction: { icon: '🗿', label: 'Roadside Attraction' },
  shopping:            { icon: '🛍️', label: 'Shopping' },
  other:               { icon: '📌', label: 'Other' },
};

@Component({
  selector: 'app-special-interest-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DatePipe, MatCardModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatProgressSpinnerModule, MatSnackBarModule, MatBottomSheetModule,
    MiniMapComponent, PhotoUploaderComponent, PageHeaderComponent,
  ],
  styles: [`
    .hero { width:100%; max-height:320px; object-fit:cover; border-radius:12px; margin-bottom:20px; }
    .hero-placeholder {
      width:100%; height:200px; border-radius:12px; margin-bottom:20px;
      background:linear-gradient(135deg,#4a148c,#7b1fa2);
      display:flex; align-items:center; justify-content:center; font-size:64px;
    }
    .header-row { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
    .title { font-size:26px; font-weight:700; margin:0; }
    .subtitle { font-size:14px; color:var(--wp-text-secondary); margin:4px 0 0; }
    .actions { display:flex; gap:8px; }
    .info-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; margin:16px 0; }
    .info-item label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--wp-text-hint); display:block; }
    .info-item span  { font-size:15px; font-weight:500; }
    .section-title { font-size:16px; font-weight:600; margin:24px 0 12px; }
    .would-return { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; border-radius:12px; font-size:13px; font-weight:500; }
    .would-return.yes { background:#e8f5e9; color:#2e7d32; }
    .would-return.no  { background:#fce4ec; color:#c62828; }
    .stars { display:flex; align-items:center; gap:2px; }
    .link-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; }
    .ai-box { margin-top:10px; padding:14px 16px; border-radius:8px; background:var(--wp-surface-variant); border-left:3px solid var(--wp-primary); line-height:1.6; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (p) {
      <app-page-header [title]="p.name" backRoute="/special-interests" />
      <div class="page-container">

        @if (heroPhoto(p)) {
          <img class="hero" [src]="heroPhoto(p)!" [alt]="p.name" />
        } @else {
          <div class="hero-placeholder">{{ categoryIcon(p.category) }}</div>
        }

        <div class="header-row">
          <div>
            <h1 class="title">{{ p.name }}</h1>
            <p class="subtitle">{{ p.city }}, {{ p.state_province }} · {{ categoryLabel(p.category) }}</p>
          </div>
          <div class="actions">
            <button mat-stroked-button color="accent" (click)="openAddToTrip(p)">
              <mat-icon>add_road</mat-icon> Add to Trip
            </button>
            <button mat-stroked-button [routerLink]="['/special-interests', p.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="confirmDelete(p.id)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>

        <div class="info-grid">
          @if (p.rating) {
            <div class="info-item">
              <label>Rating</label>
              <span class="stars">
                @for (i of stars(p.rating); track $index) {
                  <mat-icon style="font-size:18px" [class]="i ? 'star' : 'star-empty'">{{ i ? 'star' : 'star_border' }}</mat-icon>
                }
              </span>
            </div>
          }
          @if (p.would_return !== null && p.would_return !== undefined) {
            <div class="info-item">
              <label>Would return?</label>
              <span class="would-return" [class.yes]="p.would_return" [class.no]="!p.would_return">
                <mat-icon style="font-size:16px">{{ p.would_return ? 'thumb_up' : 'thumb_down' }}</mat-icon>
                {{ p.would_return ? 'Yes' : 'No' }}
              </span>
            </div>
          }
          @if (p.price_range) {
            <div class="info-item">
              <label>Price range</label>
              <span>{{ p.price_range }}</span>
            </div>
          }
          @if (p.visited_at) {
            <div class="info-item">
              <label>Visited</label>
              <span>{{ p.visited_at | date:'mediumDate' }}</span>
            </div>
          }
        </div>

        @if (p.address || p.phone || p.website || p.booking_url || p.menu_url) {
          <mat-divider style="margin:16px 0" />
          <div class="link-row">
            @if (p.address) {
              <a [href]="mapsUrl(p)" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>map</mat-icon> View on Maps</button>
              </a>
            }
            @if (p.website) {
              <a [href]="p.website" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>language</mat-icon> Website</button>
              </a>
            }
            @if (p.booking_url) {
              <a [href]="p.booking_url" target="_blank" rel="noopener">
                <button mat-stroked-button color="primary"><mat-icon>event_available</mat-icon> Book / Reserve</button>
              </a>
            }
            @if (p.menu_url) {
              <a [href]="p.menu_url" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>menu_book</mat-icon> Menu</button>
              </a>
            }
            @if (p.phone) {
              <a [href]="'tel:' + p.phone">
                <button mat-stroked-button><mat-icon>phone</mat-icon> {{ p.phone }}</button>
              </a>
            }
          </div>
        }

        <mat-divider style="margin:16px 0" />
        <p class="section-title">Highlights</p>
        <button mat-stroked-button (click)="generateHighlights(p)" [disabled]="aiLoading()">
          <mat-icon>auto_awesome</mat-icon>
          {{ aiLoading() ? 'Generating…' : 'Generate Highlights' }}
        </button>
        @if (aiResult(); as result) {
          <div class="ai-box">{{ result }}</div>
          <button mat-stroked-button color="primary" style="margin-top:8px" (click)="saveHighlights()">
            <mat-icon>save</mat-icon> Save to Highlights
          </button>
        }
        @if (p.highlights) {
          <p style="color:var(--wp-text-secondary);line-height:1.6;margin-top:10px">{{ p.highlights }}</p>
        }

        @if (p.notes) {
          <mat-divider style="margin:16px 0" />
          <p class="section-title">Notes</p>
          <p style="color:var(--wp-text-secondary);line-height:1.6">{{ p.notes }}</p>
        }

        @if (p.latitude && p.longitude) {
          <mat-divider style="margin:16px 0" />
          <p class="section-title">Location</p>
          <app-mini-map [lat]="p.latitude!" [lon]="p.longitude!" [label]="p.name" height="200px" />
        }

        <mat-divider style="margin:16px 0" />
        <p class="section-title">Photos</p>
        <app-photo-uploader
          entityType="special-interests"
          [entityId]="p.id"
          [photos]="p.photos ?? []"
          (changed)="reload()" />

      </div>
    }
  `,
})
export class SpecialInterestDetailComponent implements OnInit {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private svc         = inject(SpecialInterestService);
  private claudeSvc   = inject(ClaudeService);
  private snack       = inject(MatSnackBar);
  private bottomSheet = inject(MatBottomSheet);

  loading = signal(true);
  place   = signal<SpecialInterestPlace | null>(null);
  protected get p(): SpecialInterestPlace | null { return this.place(); }

  aiLoading = signal(false);
  aiResult  = signal<string | null>(null);

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (p) => { this.place.set(p); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/special-interests']); },
    });
  }

  heroPhoto(p: SpecialInterestPlace): string | null {
    return p.photos?.find((ph) => ph.is_primary)?.url ?? p.photos?.[0]?.url ?? p.image_url ?? null;
  }
  stars(n?: number): boolean[] { return Array.from({ length: 5 }, (_, i) => i < (n ?? 0)); }
  categoryLabel(c?: SpecialInterestCategory): string { return c ? (CATEGORY_META[c]?.label ?? c) : 'Special Interest'; }
  categoryIcon(c?: SpecialInterestCategory): string { return c ? (CATEGORY_META[c]?.icon ?? '📌') : '📌'; }
  mapsUrl(p: SpecialInterestPlace): string {
    if (p.latitude && p.longitude) return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(`${p.address ?? ''} ${p.city} ${p.state_province}`)}`;
  }
  reload() {
    const p = this.place();
    if (!p) return;
    this.svc.get(p.id).subscribe((updated) => this.place.set(updated));
  }

  generateHighlights(p: SpecialInterestPlace) {
    this.aiLoading.set(true);
    this.aiResult.set(null);
    this.claudeSvc.generateHighlights({
      type: 'special_interest',
      name: p.name,
      city: p.city,
      state: p.state_province,
      details: this.categoryLabel(p.category),
    }).subscribe({
      next: (res) => { this.aiResult.set(res.result); this.aiLoading.set(false); },
      error: () => { this.snack.open('AI generation failed', 'Dismiss', { duration: 3000 }); this.aiLoading.set(false); },
    });
  }
  saveHighlights() {
    const p = this.place();
    if (!p || !this.aiResult()) return;
    this.svc.update(p.id, { ...p, highlights: this.aiResult()! }).subscribe((updated) => {
      this.place.update((cur) => cur ? { ...cur, highlights: updated.highlights } : cur);
      this.snack.open('Highlights saved!', 'OK', { duration: 2000 });
    });
  }

  openAddToTrip(p: SpecialInterestPlace) {
    this.bottomSheet.open(AddToTripSheetComponent, {
      data: { entityType: 'special_interest', entityId: p.id, entityName: p.name },
    });
  }

  confirmDelete(id: number) {
    if (!confirm('Delete this place?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/special-interests']));
  }
}
