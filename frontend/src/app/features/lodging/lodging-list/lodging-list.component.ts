import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SkeletonGridComponent } from '../../../shared/skeleton-grid/skeleton-grid.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LodgingService } from '../../../core/services/lodging.service';
import { Lodging, LodgingType } from '../../../types/schema.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { QuickAddLodgingComponent } from '../../../shared/components/quick-add/quick-add-lodging.component';

type TypeFilter = LodgingType | 'all';

const TYPE_LABELS: Record<LodgingType, string> = {
  hotel: 'Hotel', motel: 'Motel', airbnb: 'Airbnb',
  resort: 'Resort', campground: 'Campground', other: 'Other',
};

@Component({
  selector: 'app-lodging-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, CurrencyPipe, MatCardModule, MatFormFieldModule, MatInputModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule, SkeletonGridComponent,
    EmptyStateComponent,
  ],
  styles: [`
    .toolbar { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
    .search-field { flex:1; min-width:180px; }
    .chips { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .chip {
      padding:4px 14px; border-radius:16px; border:1.5px solid var(--wp-border);
      background:var(--wp-surface); cursor:pointer; font-size:13px;
      color:var(--wp-text-secondary); transition:all .2s;
    }
    .chip.active { background:var(--wp-primary); color:#fff; border-color:var(--wp-primary); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
    .card { cursor:pointer; overflow:hidden; transition:transform .2s, box-shadow .2s; }
    .card:hover { transform:translateY(-3px); box-shadow:0 8px 24px var(--wp-shadow) !important; }
    .card-img { width:100%; height:150px; object-fit:cover; display:block; }
    .card-placeholder {
      width:100%; height:150px;
      background:#1E2A35;
      display:flex; align-items:center; justify-content:center; font-size:44px;
    }
    .card-body { padding:14px 16px 12px; }
    .card-name { font-size:16px; font-weight:600; margin:0 0 3px; }
    .card-loc  { font-size:13px; color:var(--wp-text-secondary); margin:0 0 8px; }
    .card-meta { display:flex; align-items:center; justify-content:space-between; }
    .type-badge {
      display:inline-block; padding:2px 10px; border-radius:10px; font-size:12px;
      font-weight:500; background:var(--wp-surface-variant); color:var(--wp-text-secondary);
      text-transform:capitalize;
    }
    .price { font-size:13px; font-weight:600; color:var(--wp-primary); }
    .return-yes { font-size:11px; font-weight:700; color:#2E7D32; background:#E8F5E9; padding:2px 8px; border-radius:10px; }
    .return-no  { font-size:11px; font-weight:700; color:#B71C1C; background:#FFEBEE; padding:2px 8px; border-radius:10px; }
    .visit-badge { font-size:11px; font-weight:700; color:#00695C; background:#E0F2F1; padding:2px 8px; border-radius:10px; }
    .stars { display:flex; align-items:center; gap:2px; margin-bottom:4px; }
    .empty { text-align:center; color:var(--wp-text-secondary); padding:60px 0; }
    .empty-icon { font-size:56px; display:block; margin-bottom:12px; }
    .fab {
      position:fixed; bottom:28px; right:28px;
      background:var(--wp-primary) !important; color:#fff !important;
      box-shadow:0 4px 12px var(--wp-shadow) !important;
    }

    @media (max-width: 768px) {
      .page-container { padding-bottom: 160px; }
      .fab            { bottom: 88px; right: 20px; z-index: 100; }
      .grid           { grid-template-columns: 1fr; gap: 12px; }
      .card-img, .card-placeholder { height: 180px; }
      .card-name {
        font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .card-loc { font-size: 12px; }
    }
  `],
  template: `
    <div class="page-container">

      <div class="toolbar">
        <mat-form-field class="search-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search lodging</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput placeholder="Name, city…" (input)="onSearch($event)" />
        </mat-form-field>
      </div>

      <div class="chips">
        @for (t of typeChips; track t.value) {
          <span class="chip" [class.active]="typeFilter() === t.value"
                (click)="typeFilter.set(t.value)">
            {{ t.label }}
          </span>
        }
      </div>

      @if (loading()) {
        <app-skeleton-grid [count]="6" />
      } @else if (lodgings().length === 0) {
        <app-empty-state icon="🏨" title="Log your stays"
          subtitle="Record hotels and lodging from your travels"
          ctaLabel="Add Lodging" (ctaClick)="openAdd()" />
      } @else if (filtered().length === 0) {
        <div class="empty">
          <span class="empty-icon">🏨</span>
          <p>No lodging found</p>
        </div>
      } @else {
        <div class="grid">
          @for (l of filtered(); track l.id) {
            <mat-card class="card" [routerLink]="['/lodging', l.id]">
              @if (primaryPhoto(l); as url) {
                <img class="card-img" [src]="url" [alt]="l.name" loading="lazy" />
              } @else {
                <div class="card-placeholder">🏨</div>
              }
              <div class="card-body">
                <p class="card-name">{{ l.name }}</p>
                <p class="card-loc">{{ l.city }}, {{ l.state_province }}</p>
                @if (l.room_quality) {
                  <div class="stars">
                    @for (s of stars(l.room_quality); track $index) {
                      <mat-icon style="font-size:14px;color:var(--wp-accent)">{{ s ? 'star' : 'star_border' }}</mat-icon>
                    }
                  </div>
                }
                <div class="card-meta">
                  <span class="type-badge">{{ typeLabel(l.lodging_type) }}</span>
                  <span>
                    @if (l.price_per_night) {
                      <span class="price">{{ l.price_per_night | currency:'USD':'symbol':'1.0-0' }}/night</span>
                    }
                    @if (l.pet_friendly) { <span title="Pet friendly"> 🐾</span> }
                  </span>
                </div>
                <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  @if (l.would_return === true) {
                    <span class="return-yes">✓ Would Return</span>
                  } @else if (l.would_return === false) {
                    <span class="return-no">✗ Wouldn't Return</span>
                  }
                  @if ((l.visit_count ?? 0) > 0) {
                    <span class="visit-badge">{{ l.visit_count }}× visited</span>
                  }
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>

    <button mat-fab class="fab" (click)="openAdd()" matTooltip="Add lodging">
      <mat-icon>add</mat-icon>
    </button>
  `,
})
export class LodgingListComponent implements OnInit {
  private svc = inject(LodgingService);
  private bottomSheet = inject(MatBottomSheet);

  loading = signal(true);
  lodgings = signal<Lodging[]>([]);
  searchQuery = signal('');
  typeFilter = signal<TypeFilter>('all');

  readonly typeChips: { label: string; value: TypeFilter }[] = [
    { label: 'All',        value: 'all' },
    { label: 'Hotel',      value: 'hotel' },
    { label: 'Motel',      value: 'motel' },
    { label: 'Airbnb',     value: 'airbnb' },
    { label: 'Resort',     value: 'resort' },
    { label: 'Campground', value: 'campground' },
    { label: 'Other',      value: 'other' },
  ];

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const t = this.typeFilter();
    return this.lodgings().filter((l) => {
      if (t !== 'all' && l.lodging_type !== t) return false;
      if (q && !`${l.name} ${l.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  ngOnInit() { this.load(); }

  private load() {
    this.svc.list().subscribe({
      next: (list) => { this.lodgings.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openAdd() {
    const ref = this.bottomSheet.open(QuickAddLodgingComponent);
    ref.afterDismissed().subscribe(() => this.load());
  }

  onSearch(e: Event) { this.searchQuery.set((e.target as HTMLInputElement).value); }
  primaryPhoto(l: Lodging): string | null {
    return l.photos?.find((p) => p.is_primary)?.url ?? l.photos?.[0]?.url ?? l.image_url ?? null;
  }
  typeLabel(t: LodgingType): string { return TYPE_LABELS[t] ?? t; }
  stars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }
}
