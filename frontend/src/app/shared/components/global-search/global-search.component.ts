import {
  Component, ChangeDetectionStrategy, inject, signal, computed,
  output, HostListener,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface SearchHit {
  id: number;
  name?: string;
  title?: string;
  city?: string;
  state_province?: string;
  status?: string;
  cuisine_type?: string;
  lodging_type?: string;
  rating?: number;
  room_quality?: number;
  start_date?: string;
  end_date?: string;
  trip_name?: string;
  trip_id?: number;
  entry_date?: string;
}

interface SearchResults {
  trips:        SearchHit[];
  destinations: SearchHit[];
  restaurants:  SearchHit[];
  lodging:      SearchHit[];
  journal:      SearchHit[];
}

const RECENT_KEY = 'wp_recent_searches';
const MAX_RECENT = 10;

@Component({
  selector: 'app-global-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SlicePipe, MatIconModule, MatButtonModule],
  styles: [`
    .search-backdrop {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,.45);
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 80px;
    }

    .search-box {
      width: min(640px, 94vw);
      background: var(--wp-surface);
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0,0,0,.35);
      overflow: hidden;
      max-height: calc(100vh - 120px);
      display: flex; flex-direction: column;
    }

    .search-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--wp-border);
    }
    .search-header mat-icon { color: var(--wp-text-secondary); flex-shrink: 0; }
    .search-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 17px; color: var(--wp-text-primary);
      font-family: inherit;
    }
    .search-input::placeholder { color: var(--wp-text-secondary); }
    .close-btn { color: var(--wp-text-secondary) !important; }

    .search-body { overflow-y: auto; flex: 1; }

    /* Recent searches */
    .recent-section { padding: 12px 16px; }
    .section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .9px; color: var(--wp-text-secondary);
      margin-bottom: 8px;
    }
    .recent-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .recent-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 12px; border-radius: 20px;
      background: var(--wp-surface-variant);
      font-size: 13px; color: var(--wp-text-primary);
      cursor: pointer; border: none; transition: background .15s;
    }
    .recent-chip:hover { background: var(--wp-border); }
    .recent-chip mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--wp-text-secondary); }
    .clear-recent {
      font-size: 12px; color: var(--wp-text-secondary);
      cursor: pointer; background: none; border: none;
      padding: 4px 0; margin-top: 6px; display: block;
    }
    .clear-recent:hover { color: var(--wp-primary); }

    /* Results */
    .results-group { padding: 8px 0; }
    .group-header {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 16px 4px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .9px; color: var(--wp-text-secondary);
    }
    .result-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 16px; cursor: pointer;
      transition: background .12s;
    }
    .result-row:hover { background: var(--wp-surface-variant); }
    .result-icon {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--wp-surface-variant);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .result-info { flex: 1; min-width: 0; }
    .result-name {
      font-size: 14px; font-weight: 600; color: var(--wp-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .result-sub {
      font-size: 12px; color: var(--wp-text-secondary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .result-badge {
      font-size: 10px; font-weight: 700; padding: 2px 8px;
      border-radius: 10px; background: rgba(0,105,92,.12);
      color: var(--wp-primary); flex-shrink: 0;
    }
    mat-icon.chevron { color: var(--wp-text-secondary); font-size: 18px; width: 18px; height: 18px; }

    /* States */
    .no-results, .loading-state {
      padding: 40px 16px; text-align: center;
      color: var(--wp-text-secondary); font-size: 14px;
    }
    .no-results-icon { font-size: 40px; margin-bottom: 8px; }
    .divider { height: 1px; background: var(--wp-border); margin: 0 16px; }

    @media (max-width: 480px) {
      .search-backdrop { padding-top: 0; align-items: flex-end; }
      .search-box { width: 100%; border-radius: 20px 20px 0 0; max-height: 80vh; }
    }
  `],
  template: `
    <div class="search-backdrop" (click)="onBackdropClick($event)">
      <div class="search-box" #searchBox>

        <!-- Header -->
        <div class="search-header">
          <mat-icon>search</mat-icon>
          <input #searchInput class="search-input" type="text"
                 placeholder="Search trips, places, restaurants…"
                 [(ngModel)]="query"
                 (input)="onInput()"
                 (keydown.escape)="close.emit()"
                 autofocus />
          @if (query.length > 0) {
            <button mat-icon-button class="close-btn" (click)="query = ''; clearResults()">
              <mat-icon>close</mat-icon>
            </button>
          } @else {
            <button mat-icon-button class="close-btn" (click)="close.emit()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>

        <div class="search-body">
          @if (loading()) {
            <div class="loading-state">Searching…</div>
          } @else if (!query && recentSearches().length > 0) {
            <div class="recent-section">
              <div class="section-label">Recent Searches</div>
              <div class="recent-chips">
                @for (s of recentSearches(); track s) {
                  <button class="recent-chip" (click)="applyRecent(s)">
                    <mat-icon>history</mat-icon>{{ s }}
                  </button>
                }
              </div>
              <button class="clear-recent" (click)="clearRecent()">Clear recent searches</button>
            </div>
          } @else if (query.length >= 2 && hasResults() === false && !loading()) {
            <div class="no-results">
              <div class="no-results-icon">🔍</div>
              No results for "{{ query }}"
            </div>
          } @else if (hasResults()) {
            @if (results().trips.length > 0) {
              <div class="results-group">
                <div class="group-header"><span>✈️</span> Trips</div>
                @for (r of results().trips; track r.id) {
                  <div class="result-row" (click)="navigate('/trips', r)">
                    <div class="result-icon">✈️</div>
                    <div class="result-info">
                      <div class="result-name">{{ r.name }}</div>
                      <div class="result-sub">{{ r.start_date | slice:0:4 }}{{ r.end_date ? ' · ' + (r.end_date | slice:0:4) : '' }}</div>
                    </div>
                    <span class="result-badge">{{ r.status }}</span>
                    <mat-icon class="chevron">chevron_right</mat-icon>
                  </div>
                }
              </div>
              <div class="divider"></div>
            }

            @if (results().destinations.length > 0) {
              <div class="results-group">
                <div class="group-header"><span>📍</span> Destinations</div>
                @for (r of results().destinations; track r.id) {
                  <div class="result-row" (click)="navigate('/destinations', r)">
                    <div class="result-icon">📍</div>
                    <div class="result-info">
                      <div class="result-name">{{ r.name }}</div>
                      <div class="result-sub">{{ r.city }}{{ r.state_province ? ', ' + r.state_province : '' }}</div>
                    </div>
                    <span class="result-badge">{{ r.status }}</span>
                    <mat-icon class="chevron">chevron_right</mat-icon>
                  </div>
                }
              </div>
              <div class="divider"></div>
            }

            @if (results().restaurants.length > 0) {
              <div class="results-group">
                <div class="group-header"><span>🍽️</span> Restaurants</div>
                @for (r of results().restaurants; track r.id) {
                  <div class="result-row" (click)="navigate('/restaurants', r)">
                    <div class="result-icon">🍽️</div>
                    <div class="result-info">
                      <div class="result-name">{{ r.name }}</div>
                      <div class="result-sub">{{ r.cuisine_type ? r.cuisine_type + ' · ' : '' }}{{ r.city }}{{ r.state_province ? ', ' + r.state_province : '' }}</div>
                    </div>
                    @if (r.rating) {
                      <span class="result-badge">⭐ {{ r.rating }}</span>
                    }
                    <mat-icon class="chevron">chevron_right</mat-icon>
                  </div>
                }
              </div>
              <div class="divider"></div>
            }

            @if (results().lodging.length > 0) {
              <div class="results-group">
                <div class="group-header"><span>🏨</span> Lodging</div>
                @for (r of results().lodging; track r.id) {
                  <div class="result-row" (click)="navigate('/lodging', r)">
                    <div class="result-icon">🏨</div>
                    <div class="result-info">
                      <div class="result-name">{{ r.name }}</div>
                      <div class="result-sub">{{ r.lodging_type ? r.lodging_type + ' · ' : '' }}{{ r.city }}{{ r.state_province ? ', ' + r.state_province : '' }}</div>
                    </div>
                    @if (r.room_quality) {
                      <span class="result-badge">{{ r.room_quality }}/10</span>
                    }
                    <mat-icon class="chevron">chevron_right</mat-icon>
                  </div>
                }
              </div>
              <div class="divider"></div>
            }

            @if (results().journal.length > 0) {
              <div class="results-group">
                <div class="group-header"><span>📓</span> Journal</div>
                @for (r of results().journal; track r.id) {
                  <div class="result-row" (click)="navigate('/trips', r, true)">
                    <div class="result-icon">📓</div>
                    <div class="result-info">
                      <div class="result-name">{{ r.title }}</div>
                      <div class="result-sub">{{ r.trip_name }}{{ r.entry_date ? ' · ' + (r.entry_date | slice:0:10) : '' }}</div>
                    </div>
                    <mat-icon class="chevron">chevron_right</mat-icon>
                  </div>
                }
              </div>
            }
          } @else if (!query) {
            <div class="no-results">
              <div class="no-results-icon">🔍</div>
              Start typing to search everything
            </div>
          }

        </div>
      </div>
    </div>
  `,
})
export class GlobalSearchComponent {
  close = output<void>();

  private http    = inject(HttpClient);
  private router  = inject(Router);

  query         = '';
  loading       = signal(false);
  results       = signal<SearchResults>({ trips: [], destinations: [], restaurants: [], lodging: [], journal: [] });
  recentSearches = signal<string[]>(this.loadRecent());

  hasResults = computed(() => {
    const r = this.results();
    return r.trips.length + r.destinations.length + r.restaurants.length + r.lodging.length + r.journal.length > 0;
  });

  private input$ = new Subject<string>();

  constructor() {
    this.input$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) {
          this.loading.set(false);
          this.results.set({ trips: [], destinations: [], restaurants: [], lodging: [], journal: [] });
          return of(null);
        }
        this.loading.set(true);
        return this.http.get<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
      }),
      takeUntilDestroyed(),
    ).subscribe(res => {
      this.loading.set(false);
      if (res) this.results.set(res);
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.close.emit(); }

  onInput() { this.input$.next(this.query); }

  clearResults() {
    this.results.set({ trips: [], destinations: [], restaurants: [], lodging: [], journal: [] });
    this.input$.next('');
  }

  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('search-backdrop')) {
      this.close.emit();
    }
  }

  navigate(base: string, hit: SearchHit, isJournal = false) {
    this.saveRecent(this.query);
    this.close.emit();
    if (isJournal) {
      this.router.navigate([base, hit.trip_id ?? hit.id]);
    } else {
      this.router.navigate([base, hit.id]);
    }
  }

  applyRecent(s: string) {
    this.query = s;
    this.input$.next(s);
  }

  clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    this.recentSearches.set([]);
  }

  private loadRecent(): string[] {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
  }

  private saveRecent(q: string) {
    if (!q || q.length < 2) return;
    const prev = this.loadRecent().filter(s => s !== q);
    const next = [q, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    this.recentSearches.set(next);
  }
}
