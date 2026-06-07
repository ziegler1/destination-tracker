import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SkeletonGridComponent } from '../../../shared/skeleton-grid/skeleton-grid.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RestaurantService } from '../../../core/services/restaurant.service';
import { Restaurant, PriceRange } from '../../../types/schema.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

type PriceFilter = PriceRange | 'all';

@Component({
  selector: 'app-restaurant-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule, SkeletonGridComponent,
    EmptyStateComponent,
  ],
  styles: [`
    .toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px; }
    .search-field { flex:1; min-width:180px; }
    .cuisine-field, .price-field { width:160px; }
    .chips { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .chip {
      padding:4px 14px; border-radius:16px; border:1.5px solid var(--wp-border);
      background:var(--wp-surface); cursor:pointer; font-size:13px;
      color:var(--wp-text-secondary); transition:all .2s;
    }
    .chip.active { background:var(--wp-accent); color:#000; border-color:var(--wp-accent); }

    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }

    .card { cursor:pointer; overflow:hidden; transition:transform .2s, box-shadow .2s; }
    .card:hover { transform:translateY(-3px); box-shadow:0 8px 24px var(--wp-shadow) !important; }

    .card-img { width:100%; height:150px; object-fit:cover; display:block; }
    .card-placeholder {
      width:100%; height:150px;
      background:linear-gradient(135deg,#e65100,#ff6d00);
      display:flex; align-items:center; justify-content:center; font-size:44px;
    }
    .card-body { padding:14px 16px 12px; }
    .card-name { font-size:16px; font-weight:600; margin:0 0 3px; }
    .card-loc  { font-size:13px; color:var(--wp-text-secondary); margin:0 0 3px; }
    .card-cuisine { font-size:12px; color:var(--wp-text-hint); margin:0 0 8px; }
    .card-meta { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px; }

    .price-badge {
      display:inline-block; padding:2px 8px; border-radius:10px; font-size:12px;
      font-weight:600; background:var(--wp-surface-variant); color:var(--wp-primary);
    }
    .pet-icon { font-size:16px; vertical-align:middle; title:"Pet friendly"; }

    .return-yes { font-size:11px; font-weight:700; color:#2E7D32; background:#E8F5E9; padding:2px 8px; border-radius:10px; }
    .return-no  { font-size:11px; font-weight:700; color:#B71C1C; background:#FFEBEE; padding:2px 8px; border-radius:10px; }
    .visit-badge { font-size:11px; font-weight:700; color:#00695C; background:#E0F2F1; padding:2px 8px; border-radius:10px; }

    .empty { text-align:center; color:var(--wp-text-secondary); padding:60px 0; }
    .empty-icon { font-size:56px; display:block; margin-bottom:12px; }

    .fab {
      position:fixed; bottom:28px; right:28px;
      background:var(--wp-accent) !important; color:#000 !important;
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
          <mat-label>Search restaurants</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput placeholder="Name, city, cuisine…" (input)="onSearch($event)" />
        </mat-form-field>

        <mat-form-field class="cuisine-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Cuisine</mat-label>
          <mat-select (selectionChange)="cuisineFilter.set($event.value)" [value]="cuisineFilter()">
            <mat-option value="">All cuisines</mat-option>
            @for (c of availableCuisines(); track c) {
              <mat-option [value]="c">{{ c }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Price range chips -->
      <div class="chips">
        @for (p of priceChips; track p.value) {
          <span class="chip" [class.active]="priceFilter() === p.value"
                (click)="priceFilter.set(p.value)">
            {{ p.label }}
          </span>
        }
      </div>

      @if (loading()) {
        <app-skeleton-grid [count]="6" />
      } @else if (restaurants().length === 0) {
        <app-empty-state icon="🍽️" title="Add your favorite restaurants"
          subtitle="Log places you've eaten and rate your experience"
          ctaLabel="Add Restaurant" ctaRoute="/restaurants/new" />
      } @else if (filtered().length === 0) {
        <div class="empty">
          <span class="empty-icon">🍽️</span>
          <p>No restaurants found</p>
        </div>
      } @else {
        <div class="grid">
          @for (r of filtered(); track r.id) {
            <mat-card class="card" [routerLink]="['/restaurants', r.id]">
              @if (primaryPhoto(r); as url) {
                <img class="card-img" [src]="url" [alt]="r.name" loading="lazy" />
              } @else {
                <div class="card-placeholder">🍽️</div>
              }
              <div class="card-body">
                <p class="card-name">{{ r.name }}</p>
                <p class="card-loc">{{ r.city }}, {{ r.state_province }}</p>
                @if (r.cuisine_type) {
                  <p class="card-cuisine">{{ r.cuisine_type }}</p>
                }
                <div class="card-meta">
                  <span>
                    @for (i of stars(r.rating); track $index) {
                      <mat-icon style="font-size:16px" [class]="i ? 'star' : 'star-empty'">
                        {{ i ? 'star' : 'star_border' }}
                      </mat-icon>
                    }
                  </span>
                  <span>
                    @if (r.price_range) {
                      <span class="price-badge">{{ r.price_range }}</span>
                    }
                    @if (r.pet_friendly) {
                      <span class="pet-icon" title="Pet friendly"> 🐾</span>
                    }
                  </span>
                </div>
                <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  @if (r.would_return === true) {
                    <span class="return-yes">✓ Would Return</span>
                  } @else if (r.would_return === false) {
                    <span class="return-no">✗ Wouldn't Return</span>
                  }
                  @if ((r.visit_count ?? 0) > 0) {
                    <span class="visit-badge">{{ r.visit_count }}× visited</span>
                  }
                </div>
              </div>
            </mat-card>
          }
        </div>
        @if (restaurants().length < 3) {
          <app-empty-state icon="🍽️" title="Add your favorite restaurants"
            subtitle="Log places you've eaten and rate your experience"
            ctaLabel="Add Restaurant" ctaRoute="/restaurants/new" />
        }
      }
    </div>

    <button mat-fab class="fab" [routerLink]="['/restaurants/new']" matTooltip="Add restaurant">
      <mat-icon>add</mat-icon>
    </button>
  `,
})
export class RestaurantListComponent implements OnInit {
  private svc = inject(RestaurantService);

  loading = signal(true);
  restaurants = signal<Restaurant[]>([]);
  searchQuery = signal('');
  priceFilter = signal<PriceFilter>('all');
  cuisineFilter = signal('');

  readonly priceChips: { label: string; value: PriceFilter }[] = [
    { label: 'All', value: 'all' },
    { label: '$', value: '$' },
    { label: '$$', value: '$$' },
    { label: '$$$', value: '$$$' },
    { label: '$$$$', value: '$$$$' },
  ];

  availableCuisines = computed(() =>
    [...new Set(this.restaurants().map((r) => r.cuisine_type).filter(Boolean) as string[])].sort(),
  );

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const price = this.priceFilter();
    const cuisine = this.cuisineFilter();
    return this.restaurants().filter((r) => {
      if (price !== 'all' && r.price_range !== price) return false;
      if (cuisine && r.cuisine_type !== cuisine) return false;
      if (q && !`${r.name} ${r.city} ${r.cuisine_type ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  ngOnInit() {
    this.svc.list().subscribe({
      next: (list) => { this.restaurants.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(e: Event) {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  primaryPhoto(r: Restaurant): string | null {
    const p = r.photos?.find((ph) => ph.is_primary) ?? r.photos?.[0];
    return p?.url ?? r.image_url ?? null;
  }

  stars(rating?: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < (rating ?? 0));
  }
}
