import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { StatsService, StatsResponse } from '../../core/services/stats.service';
import { ClaudeService } from '../../core/services/claude.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

const EXP_COLORS: Record<string, string> = {
  lodging: '#1565c0', food: '#e65100', fuel: '#2e7d32',
  activities: '#6a1b9a', shopping: '#f57f17', other: '#757575',
};

const CUISINE_PALETTE = [
  '#00695C','#1565C0','#6A1B9A','#C62828','#E65100',
  '#2E7D32','#00838F','#AD1457','#F57F17','#546E7A',
];

interface InsightCard { icon: string; headline: string; detail: string; }

@Component({
  selector: 'app-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, CurrencyPipe, DecimalPipe,
    MatCardModule, MatProgressSpinnerModule, MatIconModule, MatDividerModule, MatButtonModule,
    BaseChartDirective, EmptyStateComponent, PageHeaderComponent,
  ],
  styles: [`
    h2 { margin:0 0 24px; font-size:22px; font-weight:700; }
    h3 { margin:0 0 16px; font-size:17px; font-weight:700; }

    /* ── Main stat panels ── */
    .panels-grid {
      display:grid; grid-template-columns:repeat(auto-fill,minmax(360px,1fr)); gap:20px;
      margin-bottom:32px;
    }
    .panel { padding:20px; }
    .panel-title { font-size:16px; font-weight:700; margin:0 0 16px;
                   display:flex; align-items:center; gap:8px; }
    .stat-row { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
    .stat-box { text-align:center; min-width:80px; }
    .stat-val   { font-size:28px; font-weight:700; color:var(--wp-primary); }
    .stat-label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--wp-text-hint); }
    .chart-wrap { max-width:220px; margin:0 auto 16px; }
    .top-states { list-style:none; padding:0; margin:0; }
    .top-states li { display:flex; justify-content:space-between; align-items:center;
                     padding:6px 0; border-bottom:1px solid var(--wp-divider); font-size:14px; }
    .state-count { padding:2px 10px; border-radius:10px; background:var(--wp-primary);
                   color:white; font-size:12px; font-weight:600; }
    .fuel-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .fuel-card { padding:12px 14px; border-radius:10px; background:var(--wp-surface-variant); }
    .fuel-val { font-size:22px; font-weight:700; color:var(--wp-primary); }
    .fuel-lbl { font-size:11px; text-transform:uppercase; letter-spacing:.7px; color:var(--wp-text-hint); }
    .empty-note { color:var(--wp-text-hint); font-size:14px; text-align:center; padding:20px 0; }

    /* ── Personal Records ── */
    .records-section { margin-bottom:32px; }
    .records-grid {
      display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px;
    }
    .record-card {
      background:var(--wp-surface); border-radius:12px; padding:16px 18px;
      border:1px solid var(--wp-border); text-decoration:none; color:inherit;
      transition:transform .15s, box-shadow .15s; display:block;
    }
    a.record-card:hover { transform:translateY(-2px); box-shadow:0 4px 14px rgba(0,0,0,.1); }
    .record-emoji { font-size:24px; display:block; margin-bottom:8px; }
    .record-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em;
                    color:var(--wp-text-hint); margin-bottom:4px; }
    .record-value { font-size:18px; font-weight:700; color:var(--wp-primary); margin-bottom:2px; }
    .record-sub   { font-size:12px; color:var(--wp-text-secondary); }

    /* ── Cuisine diversity ── */
    .cuisine-section { margin-bottom:32px; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    @media(max-width:680px){ .two-col { grid-template-columns:1fr; } }

    /* ── Insights ── */
    .insights-section { margin-bottom:32px; }
    .insights-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .insights-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
    .insight-card {
      background:var(--wp-surface); border-radius:12px; padding:18px;
      border:1px solid var(--wp-border);
      border-left:4px solid var(--wp-primary);
    }
    .insight-icon     { font-size:28px; display:block; margin-bottom:8px; }
    .insight-headline { font-size:14px; font-weight:700; margin-bottom:6px; }
    .insight-detail   { font-size:13px; color:var(--wp-text-secondary); line-height:1.6; }
    .insights-empty   { color:var(--wp-text-hint); font-size:14px; text-align:center; padding:40px; }
  `],
  template: `
    <app-page-header title="Stats & Insights" backRoute="/" />
    <div class="page-container">
      <h2>📊 Stats &amp; Insights</h2>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="48" /></div>
      } @else if (s()) {

        <!-- ════ Stat Panels (existing 4) ════ -->
        <div class="panels-grid">

          <!-- Destinations -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">place</mat-icon> Destinations</p>
            <div class="stat-row">
              <div class="stat-box">
                <div class="stat-val">{{ s()!.destinations.total }}</div>
                <div class="stat-label">Total</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color:#1565c0">{{ s()!.destinations.want_to_visit }}</div>
                <div class="stat-label">Wish List</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color:#f57f17">{{ s()!.destinations.planned }}</div>
                <div class="stat-label">Planned</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color:#2e7d32">{{ s()!.destinations.visited }}</div>
                <div class="stat-label">Visited</div>
              </div>
            </div>
            @if (s()!.destinations.total > 0) {
              <div class="chart-wrap">
                <canvas baseChart type="doughnut" [data]="destChartData()" [options]="donutOptions"></canvas>
              </div>
            }
            @if (s()!.destinations.top_states.length > 0) {
              <mat-divider style="margin-bottom:12px" />
              <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--wp-text-secondary)">Top States / Provinces</p>
              <ul class="top-states">
                @for (st of s()!.destinations.top_states; track st.state_province) {
                  <li><span>{{ st.state_province }}</span><span class="state-count">{{ st.count }}</span></li>
                }
              </ul>
            }
          </mat-card>

          <!-- Trips -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">flight_takeoff</mat-icon> Trips</p>
            <div class="stat-row">
              <div class="stat-box">
                <div class="stat-val">{{ s()!.trips.total }}</div>
                <div class="stat-label">Total</div>
              </div>
              <div class="stat-box">
                <div class="stat-val">{{ s()!.trips.avg_duration_days }}</div>
                <div class="stat-label">Avg Days</div>
              </div>
              <div class="stat-box">
                <div class="stat-val">{{ s()!.trips.total_days }}</div>
                <div class="stat-label">Days Total</div>
              </div>
            </div>
            @if (tripsChartData().labels!.length > 0) {
              <canvas baseChart type="bar" [data]="tripsChartData()" [options]="barOptions"></canvas>
            } @else {
              <app-empty-state icon="✈️" title="No trips completed yet"
                subtitle="Plan your first trip to start tracking stats"
                ctaLabel="Plan a Trip" ctaRoute="/trips/new" />
            }
          </mat-card>

          <!-- Spending -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">receipt_long</mat-icon> Spending</p>
            <div class="stat-row">
              <div class="stat-box">
                <div class="stat-val">{{ s()!.expenses.total | currency:'USD':'symbol':'1.0-0' }}</div>
                <div class="stat-label">Total Spent</div>
              </div>
              @if (s()!.trips.total > 0) {
                <div class="stat-box">
                  <div class="stat-val">{{ (s()!.expenses.total / s()!.trips.total) | currency:'USD':'symbol':'1.0-0' }}</div>
                  <div class="stat-label">Avg / Trip</div>
                </div>
              }
            </div>
            @if (s()!.expenses.total > 0) {
              <div class="chart-wrap">
                <canvas baseChart type="doughnut" [data]="expChartData()" [options]="donutOptions"></canvas>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
                @for (cat of expCategories; track cat.key) {
                  @if (s()!.expenses[cat.key] > 0) {
                    <span style="font-size:12px;padding:2px 8px;border-radius:8px;color:white"
                          [style.background]="cat.color">
                      {{ cat.label }}: {{ s()!.expenses[cat.key] | currency:'USD':'symbol':'1.0-0' }}
                    </span>
                  }
                }
              </div>
            } @else {
              <app-empty-state icon="💰" title="No expenses logged yet"
                subtitle="Add expenses during a trip to track your spending" />
            }
          </mat-card>

          <!-- Road Stats -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">local_gas_station</mat-icon> Road Stats</p>
            <div class="fuel-grid">
              <div class="fuel-card">
                <div class="fuel-val">{{ s()!.fuel.total_miles | number:'1.0-0' }}</div>
                <div class="fuel-lbl">Miles Driven</div>
              </div>
              <div class="fuel-card">
                <div class="fuel-val">{{ s()!.fuel.total_gallons | number:'1.1-1' }}</div>
                <div class="fuel-lbl">Gallons</div>
              </div>
              <div class="fuel-card">
                <div class="fuel-val">{{ s()!.fuel.total_cost | currency:'USD':'symbol':'1.0-0' }}</div>
                <div class="fuel-lbl">Fuel Cost</div>
              </div>
              <div class="fuel-card">
                <div class="fuel-val">
                  @if (costPerMile() !== null) { {{ costPerMile()! | currency:'USD':'symbol':'1.2-2' }} } @else { — }
                </div>
                <div class="fuel-lbl">Per Mile</div>
              </div>
            </div>
            @if (s()!.fuel.total_miles === 0) {
              <p class="empty-note" style="margin-top:16px">Log fuel stops to track road stats</p>
            }
          </mat-card>
        </div>

        <!-- ════ Personal Records ════ -->
        @if (hasAnyRecord()) {
          <div class="records-section">
            <h3>🏆 Personal Records</h3>
            <div class="records-grid">

              @if (s()!.records.longest_trip_name) {
                <a class="record-card" [routerLink]="s()!.records.longest_trip_id ? ['/trips', s()!.records.longest_trip_id] : null">
                  <span class="record-emoji">📅</span>
                  <div class="record-label">Longest Trip</div>
                  <div class="record-value">{{ s()!.records.longest_trip_days }} days</div>
                  <div class="record-sub">{{ s()!.records.longest_trip_name }}</div>
                </a>
              }

              @if (s()!.records.most_visited_state) {
                <div class="record-card">
                  <span class="record-emoji">🗺️</span>
                  <div class="record-label">Most Visited State</div>
                  <div class="record-value">{{ s()!.records.most_visited_state }}</div>
                  <div class="record-sub">More destinations here than anywhere else</div>
                </div>
              }

              @if (s()!.records.top_restaurant_name) {
                <a class="record-card" [routerLink]="s()!.records.top_restaurant_id ? ['/restaurants', s()!.records.top_restaurant_id] : null">
                  <span class="record-emoji">🍽️</span>
                  <div class="record-label">Highest Rated Restaurant</div>
                  <div class="record-value">
                    @for (i of stars(s()!.records.top_restaurant_rating ?? 0); track $index) {
                      {{ i ? '⭐' : '' }}
                    }
                  </div>
                  <div class="record-sub">{{ s()!.records.top_restaurant_name }} · {{ s()!.records.top_restaurant_city }}</div>
                </a>
              }

              @if (s()!.records.top_lodging_name) {
                <a class="record-card" [routerLink]="s()!.records.top_lodging_id ? ['/lodging', s()!.records.top_lodging_id] : null">
                  <span class="record-emoji">🏨</span>
                  <div class="record-label">Highest Rated Stay</div>
                  <div class="record-value">
                    @for (i of stars(s()!.records.top_lodging_quality ?? 0); track $index) {
                      {{ i ? '⭐' : '' }}
                    }
                  </div>
                  <div class="record-sub">{{ s()!.records.top_lodging_name }} · {{ s()!.records.top_lodging_city }}</div>
                </a>
              }

              @if (s()!.records.most_expensive_trip_name) {
                <a class="record-card" [routerLink]="s()!.records.most_expensive_trip_id ? ['/trips', s()!.records.most_expensive_trip_id] : null">
                  <span class="record-emoji">💰</span>
                  <div class="record-label">Most Expensive Trip</div>
                  <div class="record-value">{{ s()!.records.most_expensive_trip_total | currency:'USD':'symbol':'1.0-0' }}</div>
                  <div class="record-sub">{{ s()!.records.most_expensive_trip_name }}</div>
                </a>
              }

            </div>
          </div>
        }

        <!-- ════ Cuisine Diversity ════ -->
        @if (s()!.cuisine_breakdown.length > 0) {
          <div class="cuisine-section">
            <div class="two-col">
              <mat-card class="panel">
                <p class="panel-title"><mat-icon color="primary">restaurant_menu</mat-icon> Cuisine Diversity</p>
                <div class="chart-wrap" style="max-width:200px">
                  <canvas baseChart type="doughnut" [data]="cuisineChartData()" [options]="donutOptions"></canvas>
                </div>
              </mat-card>
              <mat-card class="panel">
                <p class="panel-title"><mat-icon color="primary">format_list_numbered</mat-icon> Cuisines Tried</p>
                <ul class="top-states">
                  @for (c of s()!.cuisine_breakdown; track c.cuisine_type) {
                    <li>
                      <span>{{ c.cuisine_type }}</span>
                      <span class="state-count" style="background:#E65100">{{ c.count }}</span>
                    </li>
                  }
                </ul>
              </mat-card>
            </div>
          </div>
        }

        <!-- ════ Claude Travel Insights ════ -->
        <div class="insights-section">
          <div class="insights-header">
            <h3 style="margin:0">✨ Your Travel Insights</h3>
            <button mat-stroked-button color="primary" (click)="refreshInsights()" [disabled]="insightsLoading()">
              <mat-icon>auto_awesome</mat-icon>
              {{ insightsLoading() ? 'Analyzing…' : (insights().length ? 'Refresh Insights' : 'Generate Insights') }}
            </button>
          </div>

          @if (insightsLoading()) {
            <div style="display:flex;justify-content:center;padding:32px">
              <mat-spinner diameter="40" />
            </div>
          } @else if (insights().length > 0) {
            <div class="insights-grid">
              @for (card of insights(); track card.headline) {
                <div class="insight-card">
                  <span class="insight-icon">{{ card.icon }}</span>
                  <div class="insight-headline">{{ card.headline }}</div>
                  <div class="insight-detail">{{ card.detail }}</div>
                </div>
              }
            </div>
          } @else {
            <div class="insights-empty">
              Click "Generate Insights" to let Claude analyze your travel patterns and surface what makes your adventures unique.
            </div>
          }
        </div>

      }
    </div>
  `,
})
export class StatsComponent implements OnInit {
  private svc       = inject(StatsService);
  private claudeSvc = inject(ClaudeService);

  loading         = signal(true);
  insightsLoading = signal(false);
  private statsSig = signal<StatsResponse | null>(null);
  insights         = signal<InsightCard[]>([]);

  s = computed(() => this.statsSig());

  readonly expCategories: { key: keyof StatsResponse['expenses']; label: string; color: string }[] = [
    { key: 'lodging',    label: 'Lodging',    color: EXP_COLORS['lodging'] },
    { key: 'food',       label: 'Food',       color: EXP_COLORS['food'] },
    { key: 'fuel',       label: 'Fuel',       color: EXP_COLORS['fuel'] },
    { key: 'activities', label: 'Activities', color: EXP_COLORS['activities'] },
    { key: 'shopping',   label: 'Shopping',   color: EXP_COLORS['shopping'] },
    { key: 'other',      label: 'Other',      color: EXP_COLORS['other'] },
  ];

  readonly donutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
  };

  readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  destChartData = computed<ChartData<'doughnut'>>(() => {
    const d = this.statsSig()?.destinations;
    if (!d) return { labels: [], datasets: [{ data: [] }] };
    return {
      labels: ['Wish List', 'Planned', 'Visited'],
      datasets: [{ data: [d.want_to_visit, d.planned, d.visited], backgroundColor: ['#1565c0', '#f57f17', '#2e7d32'] }],
    };
  });

  tripsChartData = computed<ChartData<'bar'>>(() => {
    const rows = this.statsSig()?.trips.by_year ?? [];
    return {
      labels: rows.map(r => String(r.year)),
      datasets: [{ label: 'Trips', data: rows.map(r => r.count), backgroundColor: 'rgba(0,105,92,.75)', borderRadius: 6 }],
    };
  });

  expChartData = computed<ChartData<'doughnut'>>(() => {
    const e = this.statsSig()?.expenses;
    if (!e) return { labels: [], datasets: [{ data: [] }] };
    const cats = this.expCategories.filter(c => e[c.key] > 0);
    return {
      labels: cats.map(c => c.label),
      datasets: [{ data: cats.map(c => e[c.key]), backgroundColor: cats.map(c => c.color) }],
    };
  });

  cuisineChartData = computed<ChartData<'doughnut'>>(() => {
    const rows = this.statsSig()?.cuisine_breakdown ?? [];
    return {
      labels: rows.map(r => r.cuisine_type),
      datasets: [{
        data: rows.map(r => r.count),
        backgroundColor: rows.map((_, i) => CUISINE_PALETTE[i % CUISINE_PALETTE.length]),
      }],
    };
  });

  costPerMile = computed(() => {
    const f = this.statsSig()?.fuel;
    if (!f || f.total_miles === 0) return null;
    return f.total_cost / f.total_miles;
  });

  hasAnyRecord = computed(() => {
    const r = this.statsSig()?.records;
    if (!r) return false;
    return !!(r.longest_trip_name || r.most_visited_state || r.top_restaurant_name || r.top_lodging_name || r.most_expensive_trip_name);
  });

  ngOnInit() {
    this.svc.get().subscribe({
      next: s => { this.statsSig.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  refreshInsights() {
    const s = this.statsSig();
    if (!s) return;
    this.insightsLoading.set(true);
    this.claudeSvc.travelInsights({
      stats: { destinations: s.destinations, trips: s.trips, expenses: s.expenses, fuel: s.fuel },
      records: s.records,
      cuisineBreakdown: s.cuisine_breakdown,
    }).subscribe({
      next: res => {
        try {
          const parsed = JSON.parse(res.result);
          this.insights.set(Array.isArray(parsed) ? parsed : []);
        } catch {
          this.insights.set([]);
        }
        this.insightsLoading.set(false);
      },
      error: () => this.insightsLoading.set(false),
    });
  }

  stars(rating: number): boolean[] {
    return Array.from({ length: Math.round(rating) }, () => true);
  }
}
