import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SkeletonGridComponent } from '../../../shared/skeleton-grid/skeleton-grid.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DestinationService } from '../../../core/services/destination.service';
import { Destination, DestinationStatus } from '../../../types/schema.types';

type StatusFilter = DestinationStatus | 'all';

@Component({
  selector: 'app-destination-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatCardModule, MatChipsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule, SkeletonGridComponent,
  ],
  styles: [`
    .toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px; }
    .search-field { flex:1; min-width:180px; }
    .state-field  { width:160px; }
    .chips        { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .chip {
      padding: 4px 14px; border-radius: 16px; border: 1.5px solid var(--wp-border);
      background: var(--wp-surface); cursor:pointer; font-size:13px; color:var(--wp-text-secondary);
      transition: all .2s;
    }
    .chip.active  { background:var(--wp-primary); color:#fff; border-color:var(--wp-primary); }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .dest-card { cursor:pointer; overflow:hidden; transition:transform .2s, box-shadow .2s; }
    .dest-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px var(--wp-shadow) !important; }

    .card-img {
      width:100%; height:160px; object-fit:cover; display:block;
    }
    .card-img-placeholder {
      width:100%; height:160px;
      background: linear-gradient(135deg, var(--wp-primary) 0%, var(--wp-primary-light) 100%);
      display:flex; align-items:center; justify-content:center; font-size:48px;
    }
    .card-body { padding:14px 16px 12px; }
    .card-name { font-size:16px; font-weight:600; margin:0 0 4px; }
    .card-loc  { font-size:13px; color:var(--wp-text-secondary); margin:0 0 8px; }
    .card-meta { display:flex; align-items:center; justify-content:space-between; }

    .empty { text-align:center; color:var(--wp-text-secondary); padding:60px 0; }
    .empty-icon { font-size:56px; display:block; margin-bottom:12px; }

    .fab {
      position: fixed; bottom: 28px; right: 28px;
      background: var(--wp-primary) !important;
      color: #fff !important;
      box-shadow: 0 4px 12px var(--wp-shadow) !important;
    }
  `],
  template: `
    <div class="page-container">

      <div class="toolbar">
        <mat-form-field class="search-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search destinations</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput placeholder="Name, city, state…" (input)="onSearch($event)" />
        </mat-form-field>

        <mat-form-field class="state-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>State / Province</mat-label>
          <mat-select (selectionChange)="stateFilter.set($event.value)" [value]="stateFilter()">
            <mat-option value="">All</mat-option>
            @for (s of availableStates(); track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="chips">
        @for (c of statusChips; track c.value) {
          <span class="chip" [class.active]="statusFilter() === c.value"
                (click)="statusFilter.set(c.value)">
            {{ c.label }}
          </span>
        }
      </div>

      @if (loading()) {
        <app-skeleton-grid [count]="6" />
      } @else {
        @if (filtered().length === 0) {
          <div class="empty">
            <span class="empty-icon">📍</span>
            <p>No destinations found</p>
          </div>
        } @else {
          <div class="grid">
            @for (d of filtered(); track d.id) {
              <mat-card class="dest-card" [routerLink]="['/destinations', d.id]">
                @if (primaryPhoto(d)) {
                  <img class="card-img" [src]="primaryPhoto(d)" [alt]="d.name" loading="lazy" />
                } @else {
                  <div class="card-img-placeholder">📍</div>
                }
                <div class="card-body">
                  <p class="card-name">{{ d.name }}</p>
                  <p class="card-loc">{{ d.city }}, {{ d.state_province }} · {{ d.country }}</p>
                  <div class="card-meta">
                    <span class="status-badge {{ d.status }}">
                      {{ statusLabel(d.status) }}
                    </span>
                    <span>
                      @for (i of stars(d.rating); track $index) {
                        <mat-icon class="{{ i ? 'star' : 'star-empty' }}" style="font-size:16px">
                          {{ i ? 'star' : 'star_border' }}
                        </mat-icon>
                      }
                    </span>
                  </div>
                </div>
              </mat-card>
            }
          </div>
        }
      }
    </div>

    <button mat-mini-fab style="position:fixed;bottom:100px;right:28px;z-index:100;background:var(--wp-surface);color:var(--wp-primary)"
            [routerLink]="['/destinations/suggest']" matTooltip="AI suggest">
      <mat-icon>auto_awesome</mat-icon>
    </button>
    <button mat-fab class="fab" [routerLink]="['/destinations/new']" matTooltip="Add destination">
      <mat-icon>add</mat-icon>
    </button>
  `,
})
export class DestinationListComponent implements OnInit {
  private svc = inject(DestinationService);
  private router = inject(Router);

  loading = signal(true);
  destinations = signal<Destination[]>([]);
  searchQuery = signal('');
  statusFilter = signal<StatusFilter>('all');
  stateFilter = signal('');

  readonly statusChips: { label: string; value: StatusFilter }[] = [
    { label: 'All',           value: 'all' },
    { label: 'Want to Visit', value: 'want_to_visit' },
    { label: 'Planned',       value: 'planned' },
    { label: 'Visited',       value: 'visited' },
  ];

  availableStates = computed(() =>
    [...new Set(this.destinations().map((d) => d.state_province))].sort(),
  );

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const st = this.statusFilter();
    const state = this.stateFilter();
    return this.destinations().filter((d) => {
      if (st !== 'all' && d.status !== st) return false;
      if (state && d.state_province !== state) return false;
      if (q && !`${d.name} ${d.city} ${d.state_province}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.svc.list().subscribe({
      next: (list) => { this.destinations.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  primaryPhoto(d: Destination): string | null {
    const p = d.photos?.find((ph) => ph.is_primary) ?? d.photos?.[0];
    return p?.url ?? d.image_url ?? null;
  }

  stars(rating?: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < (rating ?? 0));
  }

  statusLabel(s: DestinationStatus): string {
    return { want_to_visit: 'Want to Visit', planned: 'Planned', visited: 'Visited' }[s];
  }
}
