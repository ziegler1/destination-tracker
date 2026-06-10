import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit, computed,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { forkJoin, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TripService } from '../../core/services/trip.service';
import { StatsService } from '../../core/services/stats.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { LodgingService } from '../../core/services/lodging.service';
import { TripDraftService } from '../../core/services/trip-draft.service';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../../shared/components/places-autocomplete/places-autocomplete.component';
import { Trip, Restaurant, Lodging, TripStop } from '../../types/schema.types';

const TRIP_COLORS = ['#00695C', '#1565C0', '#6A1B9A', '#B71C1C', '#E65100', '#2E7D32', '#00838F', '#AD1457'];

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DatePipe, DecimalPipe,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    PlacesAutocompleteComponent,
  ],
  styles: [`
    .page { padding: 0; }

    /* ── Loading ── */
    .loading-wrap { display:flex; justify-content:center; padding:80px; }

    /* ── Active trip hero ── */
    .active-hero {
      background: linear-gradient(135deg, var(--wp-primary) 0%, var(--wp-primary-light) 100%);
      border-radius: 16px; padding: 32px; margin-bottom: 28px; color: #fff;
      position: relative; overflow: hidden;
    }
    .active-hero::before {
      content:''; position:absolute; top:-60px; right:-60px;
      width:220px; height:220px; border-radius:50%;
      background:rgba(255,255,255,.08);
    }
    .active-badge {
      display:inline-block; background:rgba(255,255,255,.2);
      border-radius:20px; padding:3px 12px; font-size:11px; font-weight:700;
      letter-spacing:.08em; text-transform:uppercase; margin-bottom:12px;
    }
    .active-title { font-size:28px; font-weight:800; margin:0 0 6px; line-height:1.2; }
    .active-meta  { font-size:14px; opacity:.85; margin:0 0 16px; }
    .active-stops {
      display:flex; gap:24px; margin-bottom:24px; flex-wrap:wrap;
    }
    .stop-block { }
    .stop-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; opacity:.7; margin-bottom:2px; }
    .stop-city  { font-size:15px; font-weight:600; }
    .active-actions { display:flex; gap:12px; flex-wrap:wrap; }
    .companion-btn {
      background:#fff !important; color:var(--wp-primary) !important;
      font-weight:700 !important;
    }
    .companion-btn-outline {
      border-color:rgba(255,255,255,.6) !important; color:#fff !important;
    }

    /* ── Search hero (no active trip) ── */
    .search-hero {
      text-align:center; padding:48px 24px 32px; margin-bottom:8px;
    }
    .search-title { font-size:32px; font-weight:800; margin:0 0 6px; color:var(--wp-primary); }
    .search-sub   { font-size:15px; color:var(--wp-text-secondary); margin:0 0 24px; }
    .search-wrap  { max-width:520px; margin:0 auto; }

    /* ── Section headers ── */
    .section-header {
      display:flex; align-items:center; justify-content:space-between;
      margin:0 0 14px;
    }
    .section-title { font-size:17px; font-weight:700; margin:24px 0 12px; }
    .section-link  { font-size:13px; color:var(--wp-primary); text-decoration:none; }
    .section-link:hover { text-decoration:underline; }

    /* ── Recent trips row ── */
    .trips-row {
      display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; margin-bottom:28px;
      scrollbar-width:none;
    }
    .trips-row::-webkit-scrollbar { display:none; }
    .trip-card {
      flex:0 0 auto; width:max-content; min-width:140px; max-width:240px;
      border-radius:12px; overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,.12); cursor:pointer;
      text-decoration:none; color:inherit;
      transition:transform .15s, box-shadow .15s;
    }
    .trip-card:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,.16); }
    .trip-card-top {
      min-height:55px; display:flex; align-items:flex-end; padding:12px;
    }
    .trip-card-name { font-size:14px; font-weight:700; color:#fff; line-height:1.3; text-shadow:0 1px 4px rgba(0,0,0,.4); }
    .trip-card-body { padding:10px 12px 12px; background:var(--wp-surface); }
    .trip-card-dates { font-size:11px; color:var(--wp-text-secondary); margin-bottom:4px; }
    .trip-card-meta  { font-size:12px; color:var(--wp-text-hint); }

    /* ── Stats row ── */
    .stats-row {
      display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px;
    }
    @media(max-width:600px){ .stats-row { grid-template-columns:repeat(2,1fr); } }
    .stat-tile {
      background:var(--wp-surface); border-radius:12px; padding:18px 16px;
      box-shadow:0 1px 4px rgba(0,0,0,.07); text-align:center;
      cursor:pointer; transition:transform .15s, box-shadow .15s; display:block;
    }
    .stat-tile:hover { transform:translateY(-2px); box-shadow:0 4px 14px rgba(0,0,0,.12); }
    .stat-emoji { font-size:26px; display:block; margin-bottom:6px; }
    .stat-value { font-size:26px; font-weight:800; color:var(--wp-primary); line-height:1; }
    .stat-label { font-size:12px; color:var(--wp-text-secondary); margin-top:4px; }

    /* ── Highlights sections ── */
    .highlights-grid {
      display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:28px;
    }
    @media(max-width:768px){ .highlights-grid { grid-template-columns:repeat(2,1fr); } }
    @media(max-width:480px){ .highlights-grid { grid-template-columns:1fr; } }

    .highlight-card {
      background:var(--wp-surface); border-radius:12px; overflow:hidden;
      box-shadow:0 1px 4px rgba(0,0,0,.07); text-decoration:none; color:inherit;
      transition:transform .15s, box-shadow .15s;
    }
    .highlight-card:hover { transform:translateY(-2px); box-shadow:0 4px 14px rgba(0,0,0,.12); }
    .highlight-photo {
      height:120px; object-fit:cover; width:100%; display:block;
    }
    .highlight-placeholder {
      height:120px; display:flex; align-items:center; justify-content:center;
      font-size:36px;
    }
    .highlight-body { padding:10px 12px 12px; }
    .highlight-name { font-size:14px; font-weight:700; margin-bottom:2px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .highlight-loc  { font-size:12px; color:var(--wp-text-secondary); margin-bottom:6px; }
    .highlight-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .stars { display:flex; gap:1px; }
    .star  { font-size:13px; }
    .return-badge {
      font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px;
    }
    .return-yes { background:#E8F5E9; color:#2E7D32; }
    .cuisine-chip {
      font-size:11px; background:var(--wp-bg); padding:2px 8px; border-radius:10px;
      color:var(--wp-text-secondary);
    }

    /* ── Empty state ── */
    .empty { text-align:center; padding:40px 16px; color:var(--wp-text-hint); }
    .empty-icon { font-size:48px; display:block; margin-bottom:8px; }

    /* ── Section spacing ── */
    .section { margin-bottom:28px; }
  `],
  template: `
    <div class="page">
      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="48" /></div>
      } @else {

        <!-- ════ STATE A — Active Trip ════ -->
        @if (activeTrip(); as trip) {
          <div class="active-hero">
            <div class="active-badge">Active Trip</div>
            <h1 class="active-title">{{ trip.name }}</h1>
            <p class="active-meta">
              Day {{ dayInfo().dayNum }} of {{ dayInfo().totalDays }}
              @if (trip.start_date && trip.end_date) {
                &nbsp;·&nbsp;{{ trip.start_date | date:'MMM d' }} – {{ trip.end_date | date:'MMM d, y' }}
              }
            </p>

            <div class="active-stops">
              @if (currentStop(); as stop) {
                <div class="stop-block">
                  <div class="stop-label">Current Stop</div>
                  <div class="stop-city">
                    {{ stop.destination?.city ?? 'In Transit' }}@if (stop.destination?.state_province) {, {{ stop.destination!.state_province }}}
                  </div>
                </div>
              }
              @if (nextStop(); as stop) {
                <div class="stop-block">
                  <div class="stop-label">Next Stop</div>
                  <div class="stop-city">
                    {{ stop.destination?.city ?? '—' }}@if (stop.destination?.state_province) {, {{ stop.destination!.state_province }}}
                  </div>
                </div>
              }
            </div>

            <div class="active-actions">
              <button mat-raised-button class="companion-btn" [routerLink]="['/trips', trip.id]">
                <mat-icon>navigation</mat-icon> Open Trip Companion
              </button>
              <button mat-stroked-button class="companion-btn-outline" [routerLink]="['/trips']">
                All Trips
              </button>
            </div>
          </div>
        }

        <!-- ════ Planned / Upcoming Trips ════ -->
        @if (planningTrips().length > 0) {
          <div class="section">
            <div class="section-header">
              <h2 class="section-title">🗓️ Upcoming Trips</h2>
              <a class="section-link" [routerLink]="['/trips']">View All →</a>
            </div>
            <div class="trips-row">
              @for (trip of planningTrips(); track trip.id; let i = $index) {
                <a class="trip-card" [routerLink]="['/trips', trip.id]">
                  <div class="trip-card-top" [style.background]="tripGradient(i + 2)">
                    <div class="trip-card-name">{{ trip.name }}</div>
                  </div>
                  <div class="trip-card-body">
                    <div class="trip-card-dates">
                      @if (trip.start_date) {
                        {{ trip.start_date | date:'MMM d' }}@if (trip.end_date) { – {{ trip.end_date | date:'MMM d, y' }}}
                      } @else {
                        Dates TBD
                      }
                    </div>
                    <div class="trip-card-meta">{{ trip.stop_count ?? 0 }} stops · Planning</div>
                  </div>
                </a>
              }
            </div>
          </div>
        }

        <!-- ════ STATE B — No active trip ════ -->
        @if (!activeTrip()) {
          <div class="search-hero">
            <h1 class="search-title">Where to next?</h1>
            <p class="search-sub">Search a destination to start planning your next adventure</p>
            <div class="search-wrap">
              <app-places-autocomplete
                placeholder="Enter a city or destination…"
                [types]="['(cities)']"
                (placeSelected)="onDestinationSearch($event)" />
            </div>
          </div>

          <!-- Recent Trips -->
          @if (recentTrips().length > 0) {
            <div class="section">
              <div class="section-header">
                <h2 class="section-title">Your Recent Trips</h2>
                <a class="section-link" [routerLink]="['/trips']">View All →</a>
              </div>
              <div class="trips-row">
                @for (trip of recentTrips(); track trip.id; let i = $index) {
                  <a class="trip-card" [routerLink]="['/trips', trip.id]">
                    <div class="trip-card-top" [style.background]="tripGradient(i)">
                      <div class="trip-card-name">{{ trip.name }}</div>
                    </div>
                    <div class="trip-card-body">
                      <div class="trip-card-dates">
                        {{ trip.start_date | date:'MMM d' }} – {{ trip.end_date | date:'MMM d, y' }}
                      </div>
                      <div class="trip-card-meta">{{ trip.stop_count ?? 0 }} stops</div>
                    </div>
                  </a>
                }
              </div>
            </div>
          }
        }

        <!-- ════ Quick Stats ════ -->
        @if (stats(); as s) {
          <div class="stats-row">
            <a class="stat-tile" [routerLink]="['/destinations']" [queryParams]="{status:'visited'}" style="text-decoration:none;color:inherit">
              <span class="stat-emoji">🗺️</span>
              <div class="stat-value">{{ s.statesVisited }}</div>
              <div class="stat-label">States Visited</div>
            </a>
            <a class="stat-tile" [routerLink]="['/trips']" style="text-decoration:none;color:inherit">
              <span class="stat-emoji">✈️</span>
              <div class="stat-value">{{ s.tripsTotal }}</div>
              <div class="stat-label">Trips Taken</div>
            </a>
            <a class="stat-tile" [routerLink]="['/would-return']" style="text-decoration:none;color:inherit">
              <span class="stat-emoji">🍽️</span>
              <div class="stat-value">{{ s.restaurantsTotal }}</div>
              <div class="stat-label">Restaurants Logged</div>
            </a>
            <a class="stat-tile" [routerLink]="['/trips']" style="text-decoration:none;color:inherit">
              <span class="stat-emoji">🏨</span>
              <div class="stat-value">{{ s.nightsAway }}</div>
              <div class="stat-label">Nights Away</div>
            </a>
          </div>
        }

        <!-- ════ Places You Loved ════ -->
        @if (topRestaurants().length > 0) {
          <div class="section">
            <div class="section-header">
              <h2 class="section-title">🍽️ Places You Loved</h2>
              <a class="section-link" [routerLink]="['/restaurants']">View All →</a>
            </div>
            <div class="highlights-grid">
              @for (r of topRestaurants(); track r.id) {
                <a class="highlight-card" [routerLink]="['/restaurants', r.id]">
                  @if (primaryPhoto(r); as url) {
                    <img class="highlight-photo" [src]="url" [alt]="r.name" loading="lazy" />
                  } @else {
                    <div class="highlight-placeholder" [style.background]="'linear-gradient(135deg,#E8F5E9,#C8E6C9)'">🍽️</div>
                  }
                  <div class="highlight-body">
                    <div class="highlight-name">{{ r.name }}</div>
                    <div class="highlight-loc">{{ r.city }}, {{ r.state_province }}</div>
                    <div class="highlight-meta">
                      <div class="stars">
                        @for (filled of stars(r.rating ?? 0); track $index) {
                          <span class="star">{{ filled ? '⭐' : '☆' }}</span>
                        }
                      </div>
                      @if (r.would_return) {
                        <span class="return-badge return-yes">✓ Would Return</span>
                      }
                      @if (r.cuisine_type) {
                        <span class="cuisine-chip">{{ r.cuisine_type }}</span>
                      }
                    </div>
                  </div>
                </a>
              }
            </div>
          </div>
        }

        <!-- ════ Stays Worth Repeating ════ -->
        @if (topLodging().length > 0) {
          <div class="section">
            <div class="section-header">
              <h2 class="section-title">🏨 Stays Worth Repeating</h2>
              <a class="section-link" [routerLink]="['/lodging']">View All →</a>
            </div>
            <div class="highlights-grid">
              @for (l of topLodging(); track l.id) {
                <a class="highlight-card" [routerLink]="['/lodging', l.id]">
                  @if (primaryPhoto(l); as url) {
                    <img class="highlight-photo" [src]="url" [alt]="l.name" loading="lazy" />
                  } @else {
                    <div class="highlight-placeholder" [style.background]="'linear-gradient(135deg,#E3F2FD,#BBDEFB)'">🏨</div>
                  }
                  <div class="highlight-body">
                    <div class="highlight-name">{{ l.name }}</div>
                    <div class="highlight-loc">{{ l.city }}, {{ l.state_province }}</div>
                    <div class="highlight-meta">
                      <div class="stars">
                        @for (filled of stars(l.room_quality ?? 0); track $index) {
                          <span class="star">{{ filled ? '⭐' : '☆' }}</span>
                        }
                      </div>
                      @if (l.would_return) {
                        <span class="return-badge return-yes">✓ Would Return</span>
                      }
                      @if (l.lodging_type) {
                        <span class="cuisine-chip">{{ l.lodging_type }}</span>
                      }
                    </div>
                  </div>
                </a>
              }
            </div>
          </div>
        }

        <!-- Empty state — brand new user -->
        @if (!activeTrip() && recentTrips().length === 0 && topRestaurants().length === 0) {
          <div class="empty">
            <span class="empty-icon">✈️</span>
            <p>Your travel encyclopedia is empty — start by planning a trip or logging a destination.</p>
            <button mat-raised-button color="primary" [routerLink]="['/trips/new']">
              Plan Your First Trip
            </button>
          </div>
        }

      }
    </div>
  `,
})
export class HomeComponent implements OnInit {
  private tripSvc   = inject(TripService);
  private statsSvc  = inject(StatsService);
  private restSvc   = inject(RestaurantService);
  private lodgeSvc  = inject(LodgingService);
  private draftSvc  = inject(TripDraftService);
  private router    = inject(Router);

  loading        = signal(true);
  activeTrip     = signal<Trip | null>(null);
  planningTrips  = signal<Trip[]>([]);
  recentTrips    = signal<Trip[]>([]);
  topRestaurants = signal<Restaurant[]>([]);
  topLodging    = signal<Lodging[]>([]);
  stats         = signal<{ statesVisited:number; tripsTotal:number; restaurantsTotal:number; nightsAway:number } | null>(null);

  dayInfo = computed(() => {
    const trip = this.activeTrip();
    if (!trip?.start_date || !trip?.end_date) return { dayNum: 1, totalDays: 1 };
    const start = new Date(trip.start_date + 'T00:00:00');
    const end   = new Date(trip.end_date   + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayNum   = Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1);
    const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
    return { dayNum, totalDays };
  });

  currentStop = computed<TripStop | null>(() => {
    const trip = this.activeTrip();
    if (!trip?.stops?.length) return null;
    return trip.stops.find(s => s.status === 'current')
        ?? trip.stops.find(s => s.status === 'upcoming')
        ?? null;
  });

  nextStop = computed<TripStop | null>(() => {
    const trip = this.activeTrip();
    const curr = this.currentStop();
    if (!trip?.stops || !curr) return null;
    return trip.stops.find(s => s.stop_order === curr.stop_order + 1) ?? null;
  });

  ngOnInit(): void {
    this.tripSvc.list().pipe(
      switchMap(trips => {
        const active  = trips.find(t => t.status === 'active') ?? null;
        const planning = trips
          .filter(t => t.status === 'planning')
          .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
          .slice(0, 5);
        this.planningTrips.set(planning);
        const recent  = trips
          .filter(t => t.status === 'completed')
          .sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))
          .slice(0, 5);
        this.recentTrips.set(recent);

        return forkJoin({
          activeTrip:  active ? this.tripSvc.get(active.id) : of(null),
          stats:       this.statsSvc.get(),
          restaurants: this.restSvc.list(),
          lodging:     this.lodgeSvc.list(),
        });
      }),
    ).subscribe({
      next: ({ activeTrip, stats, restaurants, lodging }) => {
        this.activeTrip.set(activeTrip);

        const topRests = restaurants
          .filter(r => r.would_return && (r.rating ?? 0) >= 1)
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 3);
        this.topRestaurants.set(topRests);

        const topLodg = lodging
          .filter(l => l.would_return && (l.room_quality ?? 0) >= 1)
          .sort((a, b) => (b.room_quality ?? 0) - (a.room_quality ?? 0))
          .slice(0, 3);
        this.topLodging.set(topLodg);

        this.stats.set({
          statesVisited:    stats.destinations.visited_states_count,
          tripsTotal:       stats.trips.total,
          restaurantsTotal: restaurants.length,
          nightsAway:       Math.round(stats.trips.total_days),
        });

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onDestinationSearch(e: PlaceSelectedEvent): void {
    this.draftSvc.set({
      destination: e.name,
      city: e.city,
      state_province: e.state_province,
    });
    this.router.navigate(['/trips/new']);
  }

  tripGradient(index: number): string {
    const c = TRIP_COLORS[index % TRIP_COLORS.length];
    return `linear-gradient(135deg, ${c}cc, ${c}99)`;
  }

  primaryPhoto(item: Restaurant | Lodging): string | null {
    return (item.photos as Array<{ url: string; is_primary: boolean }>)
      ?.find(p => p.is_primary)?.url
      ?? (item.photos as Array<{ url: string }>)?.[0]?.url
      ?? item.image_url
      ?? null;
  }

  stars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  }
}
