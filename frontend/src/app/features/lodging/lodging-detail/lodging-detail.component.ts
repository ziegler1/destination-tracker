import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { LodgingService } from '../../../core/services/lodging.service';
import { ClaudeService, ScrapedSiteInfo } from '../../../core/services/claude.service';
import { MiniMapComponent } from '../../../shared/mini-map/mini-map.component';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { AddToTripSheetComponent } from '../../../shared/components/add-to-trip-sheet/add-to-trip-sheet.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
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
    RouterLink, CurrencyPipe, DatePipe, MatCardModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule, MatBottomSheetModule,
    MiniMapComponent, PhotoUploaderComponent, PageHeaderComponent,
  ],
  styles: [`
    .hero-wrap {
      position:relative; width:100%; border-radius:12px; overflow:hidden;
      margin-bottom:20px; background:#000;
    }
    .hero-wrap img { width:100%; max-height:320px; height:320px; object-fit:cover; display:block; }
    @media(max-width:768px) { .hero-wrap img { max-height:220px; height:220px; } }
    .hero-placeholder {
      width:100%; height:220px; border-radius:12px; margin-bottom:20px;
      background:linear-gradient(135deg,#004d40,#00897b);
      display:flex; align-items:center; justify-content:center; font-size:64px;
    }
    .carousel-btn {
      position:absolute; top:50%; transform:translateY(-50%);
      background:rgba(0,0,0,.45); color:#fff; border:none; border-radius:50%;
      width:36px; height:36px; cursor:pointer; display:flex; align-items:center; justify-content:center;
      padding:0;
    }
    .carousel-btn:disabled { opacity:.3; cursor:default; }
    .carousel-btn-prev { left:10px; }
    .carousel-btn-next { right:10px; }
    .carousel-dots {
      position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
      display:flex; gap:6px;
    }
    .carousel-dot {
      width:8px; height:8px; border-radius:50%; border:none; padding:0; cursor:pointer;
      background:rgba(255,255,255,.5); transition:background .2s;
    }
    .carousel-dot.active { background:#fff; }
    .header-row { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
    .title { font-size:26px; font-weight:700; margin:0; }
    .subtitle { font-size:14px; color:var(--wp-text-secondary); margin:4px 0 0; }
    .actions { display:flex; gap:8px; }
    @media (max-width:768px) {
      .header-row { flex-direction:column; }
      .actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%; }
      .actions button { width:100%; }
    }
    .info-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; margin:16px 0; }
    .info-item label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--wp-text-hint); display:block; }
    .info-item span  { font-size:15px; font-weight:500; }
    .section-title { font-size:16px; font-weight:600; margin:24px 0 12px; }
    .amenities-row { display:flex; flex-wrap:wrap; gap:8px; }
    .amenity-chip { padding:4px 12px; border-radius:14px; background:var(--wp-surface-variant); font-size:13px; }
    .would-return { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; border-radius:12px; font-size:13px; font-weight:500; }
    .would-return.yes { background:#e8f5e9; color:#2e7d32; }
    .would-return.no  { background:#fce4ec; color:#c62828; }
    .stars { display:flex; align-items:center; gap:2px; }
    .photos-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-top:8px; }
    .photos-grid img { width:100%; height:110px; object-fit:cover; border-radius:8px; }
    .link-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; }

    .site-info-box { margin-top:16px; padding:16px; border-radius:8px; background:var(--wp-surface-variant); border-left:3px solid var(--wp-primary); }
    .site-info-updated { margin:0 0 8px; font-size:12px; color:var(--wp-text-hint); text-transform:uppercase; letter-spacing:.04em; }
    .site-info-meta { display:flex; gap:16px; flex-wrap:wrap; margin-top:10px; font-size:13px; color:var(--wp-text-secondary); }
    .site-info-meta span { display:inline-flex; align-items:center; gap:4px; }
    .site-info-meta mat-icon { font-size:16px; height:16px; width:16px; }
    .highlight-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin-top:10px; }
    .highlight-card { padding:10px 12px; border-radius:8px; background:var(--wp-surface); border:1px solid var(--wp-border); }
    .hl-name { font-size:14px; font-weight:600; margin:0 0 2px; }
    .hl-detail { font-size:12px; color:var(--wp-text-secondary); margin:0; }
    .ai-box { margin-top:10px; padding:14px 16px; border-radius:8px; background:var(--wp-surface-variant); border-left:3px solid var(--wp-primary); line-height:1.6; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (l) {
      <app-page-header [title]="l.name" backRoute="/lodging" />
      <div class="page-container">

        @if (photoUrls(l).length > 0) {
          <div class="hero-wrap">
            <img [src]="photoUrls(l)[photoIdx()]" [alt]="l.name" />
            @if (photoUrls(l).length > 1) {
              <button class="carousel-btn carousel-btn-prev" (click)="photoIdx.set(photoIdx()-1)" [disabled]="photoIdx()===0">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button class="carousel-btn carousel-btn-next" (click)="photoIdx.set(photoIdx()+1)" [disabled]="photoIdx()===photoUrls(l).length-1">
                <mat-icon>chevron_right</mat-icon>
              </button>
              <div class="carousel-dots">
                @for (url of photoUrls(l); track url; let i = $index) {
                  <button class="carousel-dot" [class.active]="photoIdx()===i" (click)="photoIdx.set(i)"></button>
                }
              </div>
            }
          </div>
        } @else {
          <div class="hero-placeholder">🏨</div>
        }

        <div class="header-row">
          <div>
            <h1 class="title">{{ l.name }}</h1>
            <p class="subtitle">{{ l.city }}, {{ l.state_province }} · {{ typeLabel(l.lodging_type) }}</p>
          </div>
          <div class="actions">
            <button mat-raised-button color="primary" (click)="logVisit(l.id)" [disabled]="visitLogging()">
              <mat-icon>add_location_alt</mat-icon>
              {{ visitLogging() ? 'Logged!' : 'Log a Stay' }}
              @if ((l.visit_count ?? 0) > 0) { &nbsp;({{ l.visit_count }}x) }
            </button>
            <button mat-stroked-button color="accent" (click)="openAddToTrip(l)">
              <mat-icon>add_road</mat-icon> Add to Trip
            </button>
            <button mat-stroked-button [routerLink]="['/lodging', l.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="confirmDelete(l.id)">
              <mat-icon>delete</mat-icon> Delete
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

        @if (l.address || l.phone || l.website || l.booking_url) {
          <mat-divider style="margin:16px 0" />
          <div class="link-row">
            @if (l.address) {
              <a [href]="mapsUrl(l)" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>map</mat-icon> View on Maps</button>
              </a>
            }
            @if (l.booking_url) {
              <a [href]="l.booking_url" target="_blank" rel="noopener">
                <button mat-stroked-button color="primary"><mat-icon>event_available</mat-icon> Book Now</button>
              </a>
            }
            @if (l.website) {
              <a [href]="l.website" target="_blank" rel="noopener">
                <button mat-stroked-button><mat-icon>language</mat-icon> Website</button>
              </a>
              <button mat-stroked-button (click)="fetchSiteInfo(l)" [disabled]="siteInfoLoading()">
                <mat-icon>travel_explore</mat-icon>
                {{ siteInfoLoading() ? (siteInfo() ? 'Refreshing…' : 'Fetching…') : (siteInfo() ? 'Refresh Info' : 'Fetch Info') }}
              </button>
            }
            @if (l.phone) {
              <a [href]="'tel:' + l.phone">
                <button mat-stroked-button><mat-icon>phone</mat-icon> {{ l.phone }}</button>
              </a>
            }
          </div>
        }

        @if (siteInfo(); as info) {
          <div class="site-info-box">
            @if (l.site_info_fetched_at) {
              <p class="site-info-updated">Updated {{ l.site_info_fetched_at | date:'MMM d, y, h:mm a' }}</p>
            }
            @if (info.description) {
              <p style="margin:0">{{ info.description }}</p>
            }
            @if (info.hours || info.phone || info.address) {
              <div class="site-info-meta">
                @if (info.hours)   { <span><mat-icon>schedule</mat-icon> {{ info.hours }}</span> }
                @if (info.phone)   { <span><mat-icon>phone</mat-icon> {{ info.phone }}</span> }
                @if (info.address) { <span><mat-icon>place</mat-icon> {{ info.address }}</span> }
              </div>
            }
            @if (info.highlights?.length) {
              <p class="section-title" style="margin:14px 0 0">Rooms &amp; Amenities</p>
              <div class="highlight-grid">
                @for (h of info.highlights!; track h.name) {
                  <div class="highlight-card">
                    <p class="hl-name">{{ h.name }}</p>
                    @if (h.detail) { <p class="hl-detail">{{ h.detail }}</p> }
                  </div>
                }
              </div>
            }
          </div>
        }

        <mat-divider style="margin:16px 0" />
        <p class="section-title">Highlights</p>
        <button mat-stroked-button (click)="generateHighlights(l)" [disabled]="aiLoading()">
          <mat-icon>auto_awesome</mat-icon>
          {{ aiLoading() ? 'Generating…' : 'Generate Highlights' }}
        </button>
        @if (aiResult(); as result) {
          <div class="ai-box">{{ result }}</div>
          <button mat-stroked-button color="primary" style="margin-top:8px" (click)="saveHighlights()">
            <mat-icon>save</mat-icon> Save to Highlights
          </button>
        }
        @if (l.highlights) {
          <p style="color:var(--wp-text-secondary);line-height:1.6;margin-top:10px">{{ l.highlights }}</p>
        }

        @if (l.notes) {
          <mat-divider style="margin:16px 0" />
          <p class="section-title">Notes</p>
          <p style="color:var(--wp-text-secondary);line-height:1.6">{{ l.notes }}</p>
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
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private svc         = inject(LodgingService);
  private claudeSvc   = inject(ClaudeService);
  private snack       = inject(MatSnackBar);
  private bottomSheet = inject(MatBottomSheet);

  loading      = signal(true);
  visitLogging = signal(false);
  lodging      = signal<Lodging | null>(null);
  protected get l(): Lodging | null { return this.lodging(); }
  photoIdx     = signal(0);
  siteInfoLoading = signal(false);
  siteInfo     = signal<ScrapedSiteInfo | null>(null);
  aiLoading    = signal(false);
  aiResult     = signal<string | null>(null);

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (l) => { this.lodging.set(l); this.siteInfo.set(l.site_info ?? null); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/lodging']); },
    });
  }

  photoUrls(l: Lodging): string[] {
    const fromPhotos = (l.photos ?? [])
      .slice()
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(p => p.url)
      .filter(Boolean) as string[];
    return fromPhotos.length > 0 ? fromPhotos : l.image_url ? [l.image_url] : [];
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
    this.photoIdx.set(0);
    this.svc.get(l.id).subscribe((updated) => this.lodging.set(updated));
  }

  fetchSiteInfo(l: Lodging) {
    if (!l.website) return;
    this.siteInfoLoading.set(true);
    this.siteInfo.set(null);
    this.claudeSvc.scrapeWebsite(l.website, l.name, 'lodging').subscribe({
      next: (res) => {
        try {
          const info = JSON.parse(res.result) as ScrapedSiteInfo;
          this.siteInfo.set(info);
          this.svc.saveSiteInfo(l.id, info).subscribe((updated) => {
            this.lodging.update((cur) => cur ? { ...cur, site_info: updated.site_info, site_info_fetched_at: updated.site_info_fetched_at } : cur);
          });
        } catch {
          this.snack.open('Could not parse site info — try again', 'Dismiss', { duration: 3000 });
        }
        this.siteInfoLoading.set(false);
      },
      error: () => {
        this.snack.open('Fetch Info failed — the site may be unreachable', 'Dismiss', { duration: 3000 });
        this.siteInfoLoading.set(false);
      },
    });
  }

  generateHighlights(l: Lodging) {
    this.aiLoading.set(true);
    this.aiResult.set(null);
    this.claudeSvc.generateHighlights({
      type: 'lodging',
      name: l.name,
      city: l.city,
      state: l.state_province,
      details: this.typeLabel(l.lodging_type),
    }).subscribe({
      next: (res) => { this.aiResult.set(res.result); this.aiLoading.set(false); },
      error: () => { this.snack.open('AI generation failed', 'Dismiss', { duration: 3000 }); this.aiLoading.set(false); },
    });
  }
  saveHighlights() {
    const l = this.lodging();
    if (!l || !this.aiResult()) return;
    this.svc.update(l.id, { ...l, highlights: this.aiResult()! }).subscribe((updated) => {
      this.lodging.update((cur) => cur ? { ...cur, highlights: updated.highlights } : cur);
      this.snack.open('Highlights saved!', 'OK', { duration: 2000 });
    });
  }

  logVisit(id: number) {
    this.visitLogging.set(true);
    this.svc.logVisit(id).subscribe({
      next: ({ visit_count }) => {
        this.lodging.update(l => l ? { ...l, visit_count } : l);
        this.snack.open('Stay logged!', 'OK', { duration: 2000 });
        setTimeout(() => this.visitLogging.set(false), 1500);
      },
      error: () => { this.snack.open('Failed to log stay', 'Dismiss', { duration: 3000 }); this.visitLogging.set(false); },
    });
  }

  openAddToTrip(l: Lodging) {
    this.bottomSheet.open(AddToTripSheetComponent, {
      data: { entityType: 'lodging', entityId: l.id, entityName: l.name },
    });
  }

  confirmDelete(id: number) {
    if (!confirm('Delete this lodging?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/lodging']));
  }
}
