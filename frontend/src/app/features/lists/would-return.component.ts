import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LodgingService } from '../../core/services/lodging.service';
import { DestinationService } from '../../core/services/destination.service';
import { Restaurant, Lodging, Destination } from '../../types/schema.types';

export type ListMode = 'would_return' | 'avoid';

@Component({
  selector: 'app-would-return',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, TitleCasePipe,
    MatTabsModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatFormFieldModule, MatInputModule,
  ],
  styles: [`
    .header { margin-bottom: 20px; }
    .page-title { font-size:24px; font-weight:800; margin:0 0 4px; }
    .page-sub   { font-size:14px; color:var(--wp-text-secondary); margin:0 0 16px; }

    .search-row { margin-bottom: 16px; }
    .search-field { width:100%; max-width:400px; }

    .count-badge {
      font-size:12px; background:var(--wp-surface-variant);
      padding:2px 8px; border-radius:10px; margin-left:6px; color:var(--wp-text-secondary);
    }

    .items-grid {
      display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
      gap:14px; margin-top:12px;
    }

    .item-card {
      border-radius:12px; overflow:hidden; background:var(--wp-surface);
      border:1.5px solid var(--wp-border); text-decoration:none; color:inherit;
      transition:transform .15s, box-shadow .15s; display:block;
    }
    .item-card:hover { transform:translateY(-2px); box-shadow:0 6px 18px var(--wp-shadow); }

    .card-photo {
      width:100%; height:120px; object-fit:cover; display:block;
      background:linear-gradient(135deg,var(--wp-primary),var(--wp-primary-light));
    }
    .card-placeholder {
      width:100%; height:120px; display:flex; align-items:center;
      justify-content:center; font-size:40px;
    }
    .card-body  { padding:12px 14px; }
    .card-name  { font-size:14px; font-weight:700; margin:0 0 3px;
                  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .card-loc   { font-size:12px; color:var(--wp-text-secondary); margin:0 0 6px; }
    .card-meta  { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }

    .stars { display:flex; gap:1px; }
    .star  { font-size:13px; }

    .tag {
      font-size:11px; padding:2px 8px; border-radius:10px;
      background:var(--wp-surface-variant); color:var(--wp-text-secondary);
    }
    .avoid-tag {
      font-size:11px; padding:2px 8px; border-radius:10px;
      background:#fce4ec; color:#b71c1c; font-weight:600;
    }
    .return-tag {
      font-size:11px; padding:2px 8px; border-radius:10px;
      background:#e8f5e9; color:#2e7d32; font-weight:600;
    }

    .empty { text-align:center; padding:48px 16px; color:var(--wp-text-hint); }
    .empty-icon { font-size:48px; display:block; margin-bottom:8px; }
  `],
  template: `
    <div class="page-container">
      <div class="header">
        <h1 class="page-title">
          {{ mode === 'would_return' ? '✅ Would Return' : '🚫 Avoid List' }}
        </h1>
        <p class="page-sub">
          {{ mode === 'would_return'
            ? 'Places you rated highly and would visit again.'
            : 'Places you would not recommend or return to.' }}
        </p>
      </div>

      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:60px">
          <mat-spinner diameter="48" />
        </div>
      } @else {
        <mat-form-field class="search-field" appearance="outline" subscriptSizing="dynamic"
                        style="margin-bottom:16px">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput (input)="q.set($any($event.target).value)" />
        </mat-form-field>

        <mat-tab-group animationDuration="150ms">

          <!-- ── Restaurants tab ── -->
          <mat-tab>
            <ng-template mat-tab-label>
              🍽️ Restaurants
              <span class="count-badge">{{ filteredRests().length }}</span>
            </ng-template>
            @if (filteredRests().length === 0) {
              <div class="empty">
                <span class="empty-icon">🍽️</span>
                <p>No restaurants here yet.</p>
              </div>
            } @else {
              <div class="items-grid">
                @for (r of filteredRests(); track r.id) {
                  <a class="item-card" [routerLink]="['/restaurants', r.id]">
                    @if (photo(r); as url) {
                      <img class="card-photo" [src]="url" [alt]="r.name" loading="lazy" />
                    } @else {
                      <div class="card-placeholder" style="background:linear-gradient(135deg,#E8F5E9,#C8E6C9)">🍽️</div>
                    }
                    <div class="card-body">
                      <p class="card-name">{{ r.name }}</p>
                      <p class="card-loc">{{ r.city }}, {{ r.state_province }}</p>
                      <div class="card-meta">
                        <div class="stars">
                          @for (filled of stars(r.rating ?? 0); track $index) {
                            <span class="star">{{ filled ? '⭐' : '' }}</span>
                          }
                        </div>
                        @if (r.cuisine_type) { <span class="tag">{{ r.cuisine_type }}</span> }
                        @if (r.would_return) { <span class="return-tag">✓ Go back</span> }
                        @if (r.would_return === false) { <span class="avoid-tag">✗ Skip it</span> }
                      </div>
                    </div>
                  </a>
                }
              </div>
            }
          </mat-tab>

          <!-- ── Lodging tab ── -->
          <mat-tab>
            <ng-template mat-tab-label>
              🏨 Lodging
              <span class="count-badge">{{ filteredLodging().length }}</span>
            </ng-template>
            @if (filteredLodging().length === 0) {
              <div class="empty">
                <span class="empty-icon">🏨</span>
                <p>No lodging here yet.</p>
              </div>
            } @else {
              <div class="items-grid">
                @for (l of filteredLodging(); track l.id) {
                  <a class="item-card" [routerLink]="['/lodging', l.id]">
                    @if (photo(l); as url) {
                      <img class="card-photo" [src]="url" [alt]="l.name" loading="lazy" />
                    } @else {
                      <div class="card-placeholder" style="background:linear-gradient(135deg,#E3F2FD,#BBDEFB)">🏨</div>
                    }
                    <div class="card-body">
                      <p class="card-name">{{ l.name }}</p>
                      <p class="card-loc">{{ l.city }}, {{ l.state_province }}</p>
                      <div class="card-meta">
                        <div class="stars">
                          @for (filled of stars(l.room_quality ?? 0); track $index) {
                            <span class="star">{{ filled ? '⭐' : '' }}</span>
                          }
                        </div>
                        <span class="tag">{{ l.lodging_type | titlecase }}</span>
                        @if (l.would_return) { <span class="return-tag">✓ Go back</span> }
                        @if (l.would_return === false) { <span class="avoid-tag">✗ Skip it</span> }
                      </div>
                    </div>
                  </a>
                }
              </div>
            }
          </mat-tab>

          <!-- ── Destinations tab (would_return only — visited destinations) ── -->
          @if (mode === 'would_return') {
            <mat-tab>
              <ng-template mat-tab-label>
                📍 Destinations
                <span class="count-badge">{{ filteredDests().length }}</span>
              </ng-template>
              @if (filteredDests().length === 0) {
                <div class="empty">
                  <span class="empty-icon">📍</span>
                  <p>No visited destinations yet.</p>
                </div>
              } @else {
                <div class="items-grid">
                  @for (d of filteredDests(); track d.id) {
                    <a class="item-card" [routerLink]="['/destinations', d.id]">
                      @if (destPhoto(d); as url) {
                        <img class="card-photo" [src]="url" [alt]="d.name" loading="lazy" />
                      } @else {
                        <div class="card-placeholder" style="background:linear-gradient(135deg,#FFF8E1,#FFE082)">📍</div>
                      }
                      <div class="card-body">
                        <p class="card-name">{{ d.name }}</p>
                        <p class="card-loc">{{ d.city }}, {{ d.state_province }}</p>
                        <div class="card-meta">
                          <div class="stars">
                            @for (filled of stars(d.rating ?? 0); track $index) {
                              <span class="star">{{ filled ? '⭐' : '' }}</span>
                            }
                          </div>
                          <span class="return-tag">✓ Visited</span>
                        </div>
                      </div>
                    </a>
                  }
                </div>
              }
            </mat-tab>
          }

        </mat-tab-group>
      }
    </div>
  `,
})
export class WouldReturnComponent implements OnInit {
  mode: ListMode = 'would_return';

  private route    = inject(ActivatedRoute);
  private restSvc  = inject(RestaurantService);
  private lodgeSvc = inject(LodgingService);
  private destSvc  = inject(DestinationService);

  loading     = signal(true);
  q           = signal('');
  restaurants = signal<Restaurant[]>([]);
  lodging     = signal<Lodging[]>([]);
  destinations = signal<Destination[]>([]);

  filteredRests = computed(() => {
    const q = this.q().toLowerCase();
    return this.restaurants().filter(r =>
      !q || `${r.name} ${r.city} ${r.state_province}`.toLowerCase().includes(q),
    );
  });

  filteredLodging = computed(() => {
    const q = this.q().toLowerCase();
    return this.lodging().filter(l =>
      !q || `${l.name} ${l.city} ${l.state_province}`.toLowerCase().includes(q),
    );
  });

  filteredDests = computed(() => {
    const q = this.q().toLowerCase();
    return this.destinations().filter(d =>
      !q || `${d.name} ${d.city} ${d.state_province}`.toLowerCase().includes(q),
    );
  });

  ngOnInit() {
    this.mode = (this.route.snapshot.data['mode'] as ListMode) ?? 'would_return';
    const wantReturn = this.mode === 'would_return';
    forkJoin({
      restaurants:  this.restSvc.list(),
      lodging:      this.lodgeSvc.list(),
      destinations: wantReturn ? this.destSvc.list() : Promise.resolve([]),
    }).subscribe({
      next: ({ restaurants, lodging, destinations }) => {
        this.restaurants.set(
          restaurants.filter(r => wantReturn ? r.would_return === true : r.would_return === false),
        );
        this.lodging.set(
          lodging.filter(l => wantReturn ? l.would_return === true : l.would_return === false),
        );
        this.destinations.set(
          (destinations as Destination[]).filter(d => d.status === 'visited' && (d.rating ?? 0) >= 4),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  photo(item: Restaurant | Lodging): string | null {
    const photos = item.photos as Array<{ url: string; is_primary: boolean }> | undefined;
    return photos?.find(p => p.is_primary)?.url ?? photos?.[0]?.url ?? item.image_url ?? null;
  }

  destPhoto(d: Destination): string | null {
    return d.photos?.find(p => p.is_primary)?.url ?? d.photos?.[0]?.url ?? d.image_url ?? null;
  }

  stars(rating: number): boolean[] {
    return Array.from({ length: Math.round(rating) }, () => true);
  }
}
