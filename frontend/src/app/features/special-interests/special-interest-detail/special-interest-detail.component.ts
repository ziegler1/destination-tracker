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
import { ClaudeService, ScrapedSiteInfo } from '../../../core/services/claude.service';
import { MiniMapComponent } from '../../../shared/mini-map/mini-map.component';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { AddToTripSheetComponent } from '../../../shared/components/add-to-trip-sheet/add-to-trip-sheet.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SpecialInterestPlace, SpecialInterestCategory } from '../../../types/schema.types';
import { SiCategoryService } from '../../../core/services/si-category.service';

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
    /* ── Hero / carousel ───────────────────────────────────── */
    .hero-wrap {
      position:relative; width:100%; border-radius:12px; overflow:hidden;
      margin-bottom:20px; background:#000;
    }
    .hero-wrap img { width:100%; max-height:320px; height:320px; object-fit:cover; display:block; }
    @media(max-width:768px) { .hero-wrap img { max-height:220px; height:220px; } }
    .hero-placeholder {
      width:100%; height:220px; border-radius:12px; margin-bottom:20px;
      background:linear-gradient(135deg,#4a148c,#7b1fa2);
      display:flex; align-items:center; justify-content:center; font-size:64px;
    }
    .carousel-btn {
      position:absolute; top:50%; transform:translateY(-50%);
      background:rgba(0,0,0,.45); color:#fff; border:none; border-radius:50%;
      width:36px; height:36px; cursor:pointer; display:flex; align-items:center; justify-content:center;
      padding:0; line-height:1;
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

    /* ── Layout ───────────────────────────────────────────── */
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
    .would-return { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; border-radius:12px; font-size:13px; font-weight:500; }
    .would-return.yes { background:#e8f5e9; color:#2e7d32; }
    .would-return.no  { background:#fce4ec; color:#c62828; }
    .stars { display:flex; align-items:center; gap:2px; }
    .link-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; }
    .ai-box { margin-top:10px; padding:14px 16px; border-radius:8px; background:var(--wp-surface-variant); border-left:3px solid var(--wp-primary); line-height:1.6; }

    /* ── Fetch Info / site-info box ───────────────────────── */
    .site-info-box { margin-top:16px; padding:16px; border-radius:8px; background:var(--wp-surface-variant); border-left:3px solid var(--wp-primary); }
    .site-info-updated { margin:0 0 8px; font-size:12px; color:var(--wp-text-hint); text-transform:uppercase; letter-spacing:.04em; }
    .site-info-meta { display:flex; gap:16px; flex-wrap:wrap; margin-top:10px; font-size:13px; color:var(--wp-text-secondary); }
    .site-info-meta span { display:inline-flex; align-items:center; gap:4px; }
    .site-info-meta mat-icon { font-size:16px; height:16px; width:16px; }
    .highlight-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin-top:10px; }
    .highlight-card { padding:10px 12px; border-radius:8px; background:var(--wp-surface); border:1px solid var(--wp-border); }
    .hl-name { font-size:14px; font-weight:600; margin:0 0 2px; }
    .hl-detail { font-size:12px; color:var(--wp-text-secondary); margin:0; }
  `],
  template: `
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else if (p) {
      <app-page-header [title]="p.name" backRoute="/special-interests" />
      <div class="page-container">

        @if (photoUrls(p).length > 0) {
          <div class="hero-wrap">
            <img [src]="photoUrls(p)[photoIdx()]" [alt]="p.name" />
            @if (photoUrls(p).length > 1) {
              <button class="carousel-btn carousel-btn-prev" (click)="photoIdx.set(photoIdx()-1)" [disabled]="photoIdx()===0">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button class="carousel-btn carousel-btn-next" (click)="photoIdx.set(photoIdx()+1)" [disabled]="photoIdx()===photoUrls(p).length-1">
                <mat-icon>chevron_right</mat-icon>
              </button>
              <div class="carousel-dots">
                @for (url of photoUrls(p); track url; let i = $index) {
                  <button class="carousel-dot" [class.active]="photoIdx()===i" (click)="photoIdx.set(i)"></button>
                }
              </div>
            }
          </div>
        } @else {
          <div class="hero-placeholder">{{ categoryIcon(p.category) }}</div>
        }

        <div class="header-row">
          <div>
            <h1 class="title">{{ p.name }}</h1>
            <p class="subtitle">{{ p.city }}, {{ p.state_province }} · {{ categoryLabel(p.category) }}</p>
          </div>
          <div class="actions">
            <button mat-raised-button color="primary" (click)="logVisit(p)" [disabled]="visitLogging()">
              <mat-icon>add_location_alt</mat-icon>
              {{ visitLogging() ? 'Logged!' : 'Log a Visit' }}
              @if ((p.visit_count ?? 0) > 0) { &nbsp;({{ p.visit_count }}x) }
            </button>
            <button mat-stroked-button color="accent" (click)="openAddToTrip(p)">
              <mat-icon>add_road</mat-icon> Add to Trip
            </button>
            <button mat-stroked-button [routerLink]="['/special-interests', p.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="confirmDelete(p.id)">
              <mat-icon>delete</mat-icon> Delete
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
              <span>{{ p.visited_at | date:'mediumDate':'UTC' }}</span>
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
            @if (p.website) {
              <button mat-stroked-button (click)="fetchSiteInfo(p)" [disabled]="siteInfoLoading()">
                <mat-icon>travel_explore</mat-icon>
                {{ siteInfoLoading() ? (siteInfo() ? 'Refreshing…' : 'Fetching…') : (siteInfo() ? 'Refresh Info' : 'Fetch Info') }}
              </button>
            }
          </div>
        }

        @if (siteInfo(); as info) {
          <div class="site-info-box">
            @if (p.site_info_fetched_at) {
              <p class="site-info-updated">Updated {{ p.site_info_fetched_at | date:'MMM d, y, h:mm a' }}</p>
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
              <p class="section-title" style="margin:14px 0 0">Highlights</p>
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
  private catSvc      = inject(SiCategoryService);
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private svc         = inject(SpecialInterestService);
  private claudeSvc   = inject(ClaudeService);
  private snack       = inject(MatSnackBar);
  private bottomSheet = inject(MatBottomSheet);

  loading      = signal(true);
  visitLogging = signal(false);
  place        = signal<SpecialInterestPlace | null>(null);
  protected get p(): SpecialInterestPlace | null { return this.place(); }

  aiLoading = signal(false);
  aiResult  = signal<string | null>(null);

  photoIdx        = signal(0);
  siteInfoLoading = signal(false);
  siteInfo        = signal<ScrapedSiteInfo | null>(null);

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.get(id).subscribe({
      next: (p) => { this.place.set(p); this.siteInfo.set(p.site_info ?? null); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/special-interests']); },
    });
  }

  photoUrls(p: SpecialInterestPlace): string[] {
    const fromPhotos = (p.photos ?? [])
      .slice()
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(ph => ph.url)
      .filter(Boolean) as string[];
    if (fromPhotos.length > 0) return fromPhotos;
    return p.image_url ? [p.image_url] : [];
  }
  stars(n?: number): boolean[] { return Array.from({ length: 5 }, (_, i) => i < (n ?? 0)); }
  categoryLabel(c?: SpecialInterestCategory): string { return c ? this.catSvc.label(c) : 'Special Interest'; }
  categoryIcon(c?: SpecialInterestCategory): string  { return this.catSvc.icon(c); }
  mapsUrl(p: SpecialInterestPlace): string {
    if (p.latitude && p.longitude) return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(`${p.address ?? ''} ${p.city} ${p.state_province}`)}`;
  }
  reload() {
    const p = this.place();
    if (!p) return;
    this.svc.get(p.id).subscribe((updated) => { this.place.set(updated); this.photoIdx.set(0); });
  }

  fetchSiteInfo(p: SpecialInterestPlace) {
    if (!p.website) return;
    this.siteInfoLoading.set(true);
    this.claudeSvc.scrapeWebsite(p.website, p.name, 'special_interest').subscribe({
      next: (res) => {
        try {
          const info = JSON.parse(res.result) as ScrapedSiteInfo;
          this.siteInfo.set(info);
          this.svc.saveSiteInfo(p.id, info).subscribe((updated) => {
            this.place.update((cur) => cur ? { ...cur, site_info: updated.site_info, site_info_fetched_at: updated.site_info_fetched_at } : cur);
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

  logVisit(p: SpecialInterestPlace) {
    this.visitLogging.set(true);
    this.svc.logVisit(p.id).subscribe({
      next: ({ visit_count }) => {
        this.place.update(cur => cur ? { ...cur, visit_count } : cur);
        this.snack.open('Visit logged!', 'OK', { duration: 2000 });
        setTimeout(() => this.visitLogging.set(false), 1500);
      },
      error: () => { this.snack.open('Failed to log visit', 'Dismiss', { duration: 3000 }); this.visitLogging.set(false); },
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
