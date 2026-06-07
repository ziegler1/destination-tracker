import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { SpecialInterestService } from '../../core/services/special-interest.service';
import { QuickAddSpecialInterestComponent } from '../../shared/components/quick-add/quick-add-special-interest.component';
import { SpecialInterestPlace, SpecialInterestCategory } from '../../types/schema.types';

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  winery_brewery:     { icon: '🍷', label: 'Winery / Brewery' },
  bourbon_distillery: { icon: '🥃', label: 'Bourbon Distillery' },
  museum:             { icon: '🏛️', label: 'Museum' },
  historic_site:      { icon: '🏛️', label: 'Historic Site' },
  state_park:         { icon: '🌲', label: 'State Park' },
  national_park:      { icon: '⛰️', label: 'National Park' },
  live_music:         { icon: '🎵', label: 'Live Music' },
  scenic:             { icon: '🌅', label: 'Scenic' },
  roadside_attraction:{ icon: '🗿', label: 'Roadside Attraction' },
  shopping:           { icon: '🛍️', label: 'Shopping' },
  other:              { icon: '📌', label: 'Other' },
};

const CATEGORIES: Array<{ value: SpecialInterestCategory | ''; label: string }> = [
  { value: '', label: 'All categories' },
  ...Object.entries(CATEGORY_META).map(([value, { label }]) => ({
    value: value as SpecialInterestCategory,
    label,
  })),
];

@Component({
  selector: 'app-special-interests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .page-title  { font-size: 26px; font-weight: 800; margin: 0; flex: 1; }
    .filters { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .filters mat-form-field { flex: 1; min-width: 160px; max-width: 280px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .card {
      border-radius: 12px; overflow: hidden;
      border: 1px solid var(--wp-border);
      background: var(--wp-surface);
      box-shadow: 0 2px 6px var(--wp-shadow);
      transition: box-shadow .2s, transform .2s;
      cursor: pointer; text-decoration: none; color: inherit; display: block;
    }
    .card:hover { box-shadow: 0 4px 16px var(--wp-shadow); transform: translateY(-2px); }
    .card-photo {
      width: 100%; height: 140px; object-fit: cover; display: block;
      background: linear-gradient(135deg, var(--wp-primary), var(--wp-primary-light));
    }
    .card-photo-placeholder {
      width: 100%; height: 140px; display: flex; align-items: center; justify-content: center;
      font-size: 48px;
      background: linear-gradient(135deg, var(--wp-surface-variant), var(--wp-border));
    }
    .card-body { padding: 14px; }
    .card-name { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
    .card-loc  { font-size: 13px; color: var(--wp-text-secondary); margin: 0 0 8px; }
    .card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .cat-badge {
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
      background: var(--wp-surface-variant); color: var(--wp-text-secondary);
    }
    .stars { color: #f57f17; font-size: 12px; font-weight: 600; }
    .would-return { font-size: 11px; color: #2e7d32; font-weight: 600; }
    .empty {
      grid-column: 1/-1; text-align: center; padding: 60px 20px;
      color: var(--wp-text-hint);
    }
    .empty-icon { font-size: 56px; display: block; margin-bottom: 12px; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <p class="page-title">🌟 Special Interest Places</p>
        <button mat-raised-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> Add Place
        </button>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" placeholder="Name or city…" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="filterCategory">
            @for (c of categories; track c.value) {
              <mat-option [value]="c.value">{{ c.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="grid">
        @for (place of filtered(); track place.id) {
          <a class="card" [routerLink]="['/special-interests', place.id]">
            @if (primaryPhoto(place)) {
              <img class="card-photo" [src]="primaryPhoto(place)" [alt]="place.name"
                   (error)="onImgErr($event)" />
            } @else {
              <div class="card-photo-placeholder">{{ catIcon(place.category) }}</div>
            }
            <div class="card-body">
              <p class="card-name">{{ place.name }}</p>
              <p class="card-loc">{{ place.city }}, {{ place.state_province }}</p>
              <div class="card-meta">
                @if (place.category) {
                  <span class="cat-badge">{{ catLabel(place.category) }}</span>
                }
                @if (place.rating) {
                  <span class="stars">★ {{ place.rating }}</span>
                }
                @if (place.would_return) {
                  <span class="would-return">✓ Would return</span>
                }
              </div>
            </div>
          </a>
        }
        @if (filtered().length === 0) {
          <div class="empty">
            <span class="empty-icon">🌟</span>
            <p style="font-size:16px;font-weight:600;margin-bottom:6px">
              {{ places().length === 0 ? 'No places yet' : 'No matches' }}
            </p>
            <p style="font-size:13px">
              {{ places().length === 0 ? 'Add wineries, parks, museums, and more.' : 'Try a different filter.' }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class SpecialInterestsComponent implements OnInit {
  private svc         = inject(SpecialInterestService);
  private bottomSheet = inject(MatBottomSheet);

  places        = signal<SpecialInterestPlace[]>([]);
  searchQuery   = '';
  filterCategory: SpecialInterestCategory | '' = '';

  readonly categories = CATEGORIES;

  filtered = computed(() => {
    const q   = this.searchQuery.toLowerCase();
    const cat = this.filterCategory;
    return this.places().filter(p =>
      (!q || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q)) &&
      (!cat || p.category === cat),
    );
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.svc.list().subscribe(places => this.places.set(places));
  }

  openAdd() {
    const ref = this.bottomSheet.open(QuickAddSpecialInterestComponent);
    ref.afterDismissed().subscribe(added => { if (added) this.load(); });
  }

  primaryPhoto(p: SpecialInterestPlace) {
    return p.photos?.find(ph => ph.is_primary)?.url ?? p.photos?.[0]?.url ?? null;
  }

  catIcon(cat?: string)  { return cat ? (CATEGORY_META[cat]?.icon ?? '📌') : '📌'; }
  catLabel(cat?: string) { return cat ? (CATEGORY_META[cat]?.label ?? cat) : ''; }

  onImgErr(e: Event) { (e.target as HTMLImageElement).style.display = 'none'; }
}
