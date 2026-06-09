import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { DestinationService } from '../../../core/services/destination.service';
import { WeatherService, weatherEmoji } from '../../../core/services/weather.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { MiniMapComponent } from '../../../shared/mini-map/mini-map.component';
import { PhotoUploaderComponent } from '../../../shared/photo-uploader/photo-uploader.component';
import { AddToTripSheetComponent } from '../../../shared/components/add-to-trip-sheet/add-to-trip-sheet.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PhotoPlaceholderComponent } from '../../../shared/components/photo-placeholder/photo-placeholder.component';
import { Destination, WeatherResponse } from '../../../types/schema.types';

interface WeatherDay {
  date: string;
  dayName: string;
  icon: string;
  high: number;
  low: number;
}

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DatePipe, DecimalPipe,
    MatCardModule, MatChipsModule, MatIconModule, MatButtonModule,
    MatDividerModule, MatProgressSpinnerModule, MatListModule, MatTooltipModule,
    MatSnackBarModule, MatBottomSheetModule, MiniMapComponent, PhotoUploaderComponent,
    PageHeaderComponent, PhotoPlaceholderComponent,
  ],
  styles: [`
    .back-btn { margin-bottom: 16px; }
    @media (max-width: 768px) { .back-btn { display: none; } }

    .hero { position:relative; width:100%; max-height:340px; overflow:hidden; border-radius:12px; margin-bottom:24px; }
    .hero img { width:100%; height:340px; object-fit:cover; }
    .hero-placeholder { width:100%; height:240px; border-radius:12px; margin-bottom:24px; overflow:hidden; }
    @media (max-width:768px) {
      .hero { max-height:220px; }
      .hero img { height:220px; }
      .hero-placeholder { height:220px; }
    }
    .hero-overlay {
      position:absolute; bottom:0; left:0; right:0;
      background:linear-gradient(transparent,rgba(0,0,0,.7));
      padding:24px;
    }
    .hero-title { color:#fff; font-size:28px; font-weight:700; margin:0; }
    .hero-sub   { color:rgba(255,255,255,.85); margin:4px 0 0; font-size:15px; }
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
      position:absolute; bottom:52px; left:50%; transform:translateX(-50%);
      display:flex; gap:6px;
    }
    .carousel-dot {
      width:8px; height:8px; border-radius:50%; border:none; padding:0; cursor:pointer;
      background:rgba(255,255,255,.5); transition:background .2s;
    }
    .carousel-dot.active { background:#fff; }

    .layout { display:grid; grid-template-columns:1fr 320px; gap:20px; }
    /* min-width:0 prevents grid children from overflowing their column */
    .layout > * { min-width: 0; }
    @media(max-width:768px){ .layout { grid-template-columns:1fr; } }

    .info-card {
      background:var(--wp-surface); border-radius:12px; padding:20px;
      /* overflow:hidden contains the weather strip scroll track inside the card */
      overflow:hidden;
    }
    @media(max-width:768px){ .info-card { padding:14px; } }

    .section-title { font-size:14px; font-weight:600; text-transform:uppercase;
                     letter-spacing:.8px; color:var(--wp-text-secondary); margin:24px 0 12px; }
    @media(max-width:768px){ .section-title { margin:14px 0 8px; } }

    .meta-row  { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; }
    .meta-icon { color:var(--wp-primary); flex-shrink:0; }
    .meta-val  { font-size:14px; color:var(--wp-text-primary); overflow-wrap:break-word; word-break:break-word; min-width:0; }

    .months-wrap { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
    .month-chip  {
      padding:3px 12px; border-radius:14px; font-size:13px;
      background:var(--wp-primary); color:#fff;
    }

    .photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:16px; }
    .photo-thumb { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; cursor:pointer; }

    /* Weather strip scrolls horizontally inside the card */
    .weather-strip { display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; -webkit-overflow-scrolling:touch; }
    .weather-day {
      flex:0 0 auto; text-align:center; padding:10px 12px;
      background:var(--wp-surface-variant); border-radius:10px; min-width:72px;
    }
    .wd-name  { font-size:11px; color:var(--wp-text-secondary); font-weight:600; }
    .wd-icon  { font-size:26px; margin:4px 0; }
    .wd-high  { font-size:14px; font-weight:600; }
    .wd-low   { font-size:12px; color:var(--wp-text-secondary); }

    .poi-item { padding:8px 0; border-bottom:1px solid var(--wp-divider); }
    .poi-item:last-child { border:none; }
    .poi-name { font-weight:500; font-size:14px; overflow-wrap:break-word; }
    .poi-type { font-size:12px; color:var(--wp-text-secondary); text-transform:capitalize; }
    .poi-desc { font-size:13px; color:var(--wp-text-secondary); margin-top:2px; overflow-wrap:break-word; }

    .stars { color:#FFB300; }
    /* pre-wrap preserves newlines but long unbroken words need break-word */
    .notes { font-size:14px; color:var(--wp-text-secondary); line-height:1.6; white-space:pre-wrap; overflow-wrap:break-word; word-break:break-word; }

    /* Hero overlay text: clamp font size on small screens */
    @media(max-width:768px){
      .hero-title { font-size:20px; }
      .hero-sub   { font-size:13px; }
    }

    .status-rating { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .action-grid { display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap; align-items:center; }
    @media (max-width:768px) {
      .action-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .action-grid button { width:100%; }
      .action-grid > a { grid-column:1/-1; display:block; }
      .action-grid > a button { width:100%; }
    }
    .ai-box {
      margin-top:12px; padding:14px; border-radius:8px;
      background:var(--wp-surface-variant); font-size:14px;
      line-height:1.6; color:var(--wp-text-secondary);
    }
  `],
  template: `
    <app-page-header [title]="dest()?.name ?? 'Destination'" backRoute="/destinations" />
    <div class="page-container">
      <button mat-stroked-button class="back-btn" routerLink="/destinations">
        <mat-icon>arrow_back</mat-icon> Destinations
      </button>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="48" /></div>
      } @else if (dest()) {
        <!-- Hero photo / carousel -->
        @if (destPhotoUrls().length > 0) {
          <div class="hero">
            <img [src]="destPhotoUrls()[photoIdx()]" [alt]="dest()!.name" />
            <div class="hero-overlay">
              <p class="hero-title">{{ dest()!.name }}</p>
              <p class="hero-sub">{{ dest()!.city }}, {{ dest()!.state_province }} · {{ dest()!.country }}</p>
            </div>
            @if (destPhotoUrls().length > 1) {
              <button class="carousel-btn carousel-btn-prev" (click)="photoIdx.set(photoIdx()-1)" [disabled]="photoIdx()===0">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button class="carousel-btn carousel-btn-next" (click)="photoIdx.set(photoIdx()+1)" [disabled]="photoIdx()===destPhotoUrls().length-1">
                <mat-icon>chevron_right</mat-icon>
              </button>
              <div class="carousel-dots">
                @for (url of destPhotoUrls(); track url; let i = $index) {
                  <button class="carousel-dot" [class.active]="photoIdx()===i" (click)="photoIdx.set(i)"></button>
                }
              </div>
            }
          </div>
        } @else {
          <div class="hero-placeholder">
            <app-photo-placeholder entityType="destination" [name]="dest()!.city" style="height:100%;display:block" />
          </div>
        }

        <!-- Status + rating -->
        <div class="status-rating">
          <span class="status-badge {{ dest()!.status }}">{{ statusLabel(dest()!.status) }}</span>
          <span class="stars">
            @for (i of stars(dest()!.rating); track $index) {
              <mat-icon style="font-size:18px">{{ i ? 'star' : 'star_border' }}</mat-icon>
            }
          </span>
        </div>

        <!-- Action buttons — 2×2 grid on mobile -->
        <div class="action-grid">
          <button mat-raised-button color="primary" (click)="logVisit()" [disabled]="visitLogging()">
            <mat-icon>add_location_alt</mat-icon>
            {{ visitLogging() ? 'Logged!' : 'Log a Visit' }}
            @if ((dest()?.visit_count ?? 0) > 0) { &nbsp;({{ dest()!.visit_count }}x) }
          </button>
          <button mat-stroked-button color="accent" (click)="openAddToTrip()">
            <mat-icon>add_road</mat-icon> Add to Trip
          </button>
          <button mat-stroked-button [routerLink]="['/destinations', dest()!.id, 'edit']">
            <mat-icon>edit</mat-icon> Edit
          </button>
          <button mat-stroked-button color="warn" (click)="confirmDelete()">
            <mat-icon>delete</mat-icon> Delete
          </button>
          <a [href]="mapsUrl(dest()!)" target="_blank" rel="noopener" style="text-decoration:none">
            <button mat-stroked-button style="width:100%">
              <mat-icon>map</mat-icon> View on Maps
            </button>
          </a>
        </div>

        <div class="layout">
          <!-- Left column -->
          <div>
            <!-- Description -->
            @if (dest()!.description) {
              <div class="info-card" style="margin-bottom:16px">
                <p class="section-title">About</p>
                <p class="notes">{{ dest()!.description }}</p>
              </div>
            }

            <!-- Weather strip -->
            @if (dest()!.latitude && dest()!.longitude) {
              <div class="info-card" style="margin-bottom:16px">
                <p class="section-title">7-Day Forecast</p>
                @if (weatherLoading()) {
                  <mat-spinner diameter="32" style="margin:8px auto" />
                } @else if (weatherDays().length) {
                  <div class="weather-strip">
                    @for (day of weatherDays(); track day.date) {
                      <div class="weather-day">
                        <div class="wd-name">{{ day.dayName }}</div>
                        <div class="wd-icon">{{ day.icon }}</div>
                        <div class="wd-high">{{ day.high | number:'1.0-0' }}°</div>
                        <div class="wd-low">{{ day.low | number:'1.0-0' }}°</div>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- Best months -->
            @if (dest()!.best_months?.length) {
              <div class="info-card" style="margin-bottom:16px">
                <p class="section-title">Best Months to Visit</p>
                <div class="months-wrap">
                  @for (m of dest()!.best_months!; track m) {
                    <span class="month-chip">{{ m }}</span>
                  }
                </div>
              </div>
            }

            <!-- Notes -->
            @if (dest()!.notes) {
              <div class="info-card" style="margin-bottom:16px">
                <p class="section-title">Notes</p>
                <p class="notes">{{ dest()!.notes }}</p>
              </div>
            }

            <!-- Travel Tips -->
            @if (dest()!.travel_tips) {
              <div class="info-card" style="margin-bottom:16px">
                <p class="section-title">Travel Tips</p>
                <p class="notes">{{ dest()!.travel_tips }}</p>
              </div>
            }

            <!-- Highlights -->
            <div class="info-card" style="margin-bottom:16px">
              <p class="section-title">Highlights</p>
              <button mat-stroked-button (click)="generateHighlights()" [disabled]="aiHighlightsLoading()">
                <mat-icon>auto_awesome</mat-icon>
                {{ aiHighlightsLoading() ? 'Generating…' : 'Generate Highlights' }}
              </button>
              @if (aiHighlightsResult(); as result) {
                <div class="ai-box">{{ result }}</div>
                <button mat-stroked-button color="primary" style="margin-top:8px" (click)="saveHighlights()">
                  <mat-icon>save</mat-icon> Save to Entry
                </button>
              }
              @if (dest()!.highlights) {
                <p style="color:var(--wp-text-secondary);line-height:1.6;margin-top:10px">{{ dest()!.highlights }}</p>
              }
            </div>

            <!-- POIs -->
            @if (dest()!.pois?.length) {
              <div class="info-card" style="margin-bottom:16px">
                <p class="section-title">Points of Interest</p>
                @for (poi of dest()!.pois!; track poi.id) {
                  <div class="poi-item">
                    <div class="poi-name">{{ poi.name }}</div>
                    @if (poi.poi_type) {
                      <div class="poi-type">{{ poi.poi_type.replace('_',' ') }}</div>
                    }
                    @if (poi.description) {
                      <div class="poi-desc">{{ poi.description }}</div>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Right column -->
          <div>
            <!-- Key info -->
            <div class="info-card" style="margin-bottom:16px">
              <p class="section-title">Details</p>
              @if (dest()!.region) {
                <div class="meta-row">
                  <mat-icon class="meta-icon">map</mat-icon>
                  <span class="meta-val">{{ dest()!.region }}</span>
                </div>
              }
              @if (dest()!.visited_at) {
                <div class="meta-row">
                  <mat-icon class="meta-icon">event</mat-icon>
                  <span class="meta-val">Visited {{ dest()!.visited_at | date:'MMM d, y' }}</span>
                </div>
              }
              @if (dest()!.latitude) {
                <div class="meta-row">
                  <mat-icon class="meta-icon">location_on</mat-icon>
                  <span class="meta-val">
                    {{ dest()!.latitude | number:'1.4-4' }}, {{ dest()!.longitude | number:'1.4-4' }}
                  </span>
                </div>
              }
            </div>

            <!-- Best Time to Visit -->
            <div class="info-card" style="margin-bottom:16px">
              <p class="section-title">Best Time to Visit</p>
              <button mat-stroked-button (click)="getBestTime()" [disabled]="btLoading()">
                <mat-icon>auto_awesome</mat-icon>
                {{ btLoading() ? 'Asking Claude…' : 'Ask Claude' }}
              </button>
              @if (btResult(); as bt) {
                <div style="margin-top:12px">
                  @if (bt.best_months.length) {
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
                      @for (m of bt.best_months; track m) {
                        <span style="padding:3px 12px;border-radius:14px;background:var(--wp-primary);color:white;font-size:13px">{{ m }}</span>
                      }
                    </div>
                  }
                  <p style="font-size:14px;color:var(--wp-text-secondary);line-height:1.6;margin:0 0 10px">{{ bt.summary }}</p>
                  @if (bt.seasons && (bt.seasons['spring'] || bt.seasons['summer'])) {
                    @for (season of ['spring','summer','fall','winter']; track season) {
                      @if (bt.seasons[season]) {
                        <p style="font-size:13px;margin:4px 0"><strong style="text-transform:capitalize">{{ season }}:</strong> {{ bt.seasons[season] }}</p>
                      }
                    }
                  }
                  @if (bt.best_months.length) {
                    <button mat-stroked-button color="primary" style="margin-top:10px" (click)="applyBestMonths()">
                      <mat-icon>done</mat-icon> Apply to Best Months
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Mini map -->
            @if (dest()!.latitude && dest()!.longitude) {
              <div class="info-card">
                <p class="section-title">Location</p>
                <app-mini-map
                  [lat]="dest()!.latitude!"
                  [lon]="dest()!.longitude!"
                  [label]="dest()!.name"
                  height="220px" />
              </div>
            }

            <!-- Photos -->
            <div class="info-card">
              <p class="section-title">Photos</p>
              <app-photo-uploader
                entityType="destinations"
                [entityId]="entityId"
                [photos]="dest()!.photos ?? []"
                (changed)="onPhotosChanged()" />
            </div>

            <!-- Photo gallery -->
            @if (dest()!.photos && dest()!.photos!.length > 1) {
              <div class="info-card">
                <p class="section-title">Photos</p>
                <div class="photo-grid">
                  @for (ph of dest()!.photos!; track ph.id) {
                    <img class="photo-thumb" [src]="ph.url" [alt]="ph.caption ?? dest()!.name" />
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DestinationDetailComponent implements OnInit {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private destSvc     = inject(DestinationService);
  private weatherSvc  = inject(WeatherService);
  private claudeSvc   = inject(ClaudeService);
  private snack       = inject(MatSnackBar);
  private bottomSheet = inject(MatBottomSheet);

  loading        = signal(true);
  visitLogging   = signal(false);
  weatherLoading = signal(false);
  dest           = signal<Destination | null>(null);
  photoIdx       = signal(0);
  weatherDays    = signal<WeatherDay[]>([]);

  // Best Time to Visit
  btLoading     = signal(false);
  btResult      = signal<{ best_months: string[]; summary: string; seasons: Record<string, string> } | null>(null);

  // AI Highlights
  aiHighlightsLoading = signal(false);
  aiHighlightsResult  = signal<string | null>(null);

  // Photos
  protected get entityId(): number { return this.dest()?.id ?? 0; }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.destSvc.get(id).subscribe({
      next: (d) => {
        this.dest.set(d);
        this.loading.set(false);
        if (d.latitude && d.longitude) this.loadWeather(d.latitude, d.longitude);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadWeather(lat: number, lon: number): void {
    this.weatherLoading.set(true);
    this.weatherSvc.getWeather(lat, lon).subscribe({
      next: (w) => {
        this.weatherDays.set(this.parseDays(w));
        this.weatherLoading.set(false);
      },
      error: () => this.weatherLoading.set(false),
    });
  }

  private parseDays(w: WeatherResponse): WeatherDay[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (w.daily?.time ?? []).slice(0, 7).map((date, i) => ({
      date,
      dayName: i === 0 ? 'Today' : days[new Date(date + 'T00:00:00').getDay()],
      icon: weatherEmoji(w.daily.weathercode[i]),
      high: w.daily.temperature_2m_max[i],
      low:  w.daily.temperature_2m_min[i],
    }));
  }

  destPhotoUrls(): string[] {
    const d = this.dest();
    if (!d) return [];
    const fromPhotos = (d.photos ?? [])
      .slice()
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(p => p.url)
      .filter(Boolean) as string[];
    return fromPhotos.length > 0 ? fromPhotos : d.image_url ? [d.image_url] : [];
  }

  stars(rating?: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < (rating ?? 0));
  }

  statusLabel(s: string): string {
    return { want_to_visit: 'Want to Visit', planned: 'Planned', visited: 'Visited' }[s] ?? s;
  }

  getBestTime(): void {
    const d = this.dest();
    if (!d) return;
    this.btLoading.set(true);
    this.btResult.set(null);
    this.claudeSvc.bestTimeToVisit(d.name, `${d.city}, ${d.state_province}`).subscribe({
      next: (res) => {
        try {
          this.btResult.set(JSON.parse(res.result));
        } catch {
          this.btResult.set({ best_months: [], summary: res.result, seasons: {} });
        }
        this.btLoading.set(false);
      },
      error: () => this.btLoading.set(false),
    });
  }

  applyBestMonths(): void {
    const d = this.dest();
    const months = this.btResult()?.best_months;
    if (!d || !months?.length) return;
    this.destSvc.update(d.id, { ...d, best_months: months }).subscribe((updated) => {
      this.dest.update((cur) => cur ? { ...cur, best_months: updated.best_months } : cur);
    });
  }

  generateHighlights(): void {
    const d = this.dest();
    if (!d) return;
    this.aiHighlightsLoading.set(true);
    this.aiHighlightsResult.set(null);
    this.claudeSvc.generateHighlights({
      type: 'destination', name: d.name, city: d.city, state: d.state_province,
    }).subscribe({
      next: (res) => { this.aiHighlightsResult.set(res.result); this.aiHighlightsLoading.set(false); },
      error: () => { this.snack.open('AI generation failed', 'Dismiss', { duration: 3000 }); this.aiHighlightsLoading.set(false); },
    });
  }

  saveHighlights(): void {
    const d = this.dest();
    if (!d || !this.aiHighlightsResult()) return;
    this.destSvc.update(d.id, { ...d, highlights: this.aiHighlightsResult()! }).subscribe((updated) => {
      this.dest.update((cur) => cur ? { ...cur, highlights: updated.highlights } : cur);
      this.snack.open('Highlights saved!', 'OK', { duration: 2000 });
    });
  }

  mapsUrl(d: Destination): string {
    if (d.latitude && d.longitude) return `https://www.google.com/maps?q=${d.latitude},${d.longitude}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(`${d.city}, ${d.state_province}`)}`;
  }

  logVisit(): void {
    const d = this.dest();
    if (!d) return;
    this.visitLogging.set(true);
    this.destSvc.logVisit(d.id).subscribe({
      next: ({ visit_count }) => {
        this.dest.update(cur => cur ? { ...cur, visit_count } : cur);
        this.snack.open('Visit logged!', 'OK', { duration: 2000 });
        setTimeout(() => this.visitLogging.set(false), 1500);
      },
      error: () => { this.snack.open('Failed to log visit', 'Dismiss', { duration: 3000 }); this.visitLogging.set(false); },
    });
  }

  confirmDelete(): void {
    const d = this.dest();
    if (!d) return;
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    this.destSvc.delete(d.id).subscribe(() => this.router.navigate(['/destinations']));
  }

  openAddToTrip(): void {
    const d = this.dest();
    if (!d) return;
    this.bottomSheet.open(AddToTripSheetComponent, {
      data: { entityType: 'destination', entityId: d.id, entityName: d.name },
    });
  }

  onPhotosChanged(): void {
    const d = this.dest();
    if (!d) return;
    this.destSvc.get(d.id).subscribe((updated) => { this.dest.set(updated); this.photoIdx.set(0); });
  }
}
