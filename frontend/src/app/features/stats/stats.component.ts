import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { StatsService, StatsResponse } from '../../core/services/stats.service';

const EXP_COLORS: Record<string, string> = {
  lodging: '#1565c0', food: '#e65100', fuel: '#2e7d32',
  activities: '#6a1b9a', shopping: '#f57f17', other: '#757575',
};

@Component({
  selector: 'app-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, DecimalPipe,
    MatCardModule, MatProgressSpinnerModule, MatIconModule, MatDividerModule,
    BaseChartDirective,
  ],
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 20px;
    }
    .panel { padding: 20px; }
    .panel-title {
      font-size: 16px; font-weight: 700; margin: 0 0 16px;
      display: flex; align-items: center; gap: 8px;
    }
    .stat-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .stat-box { text-align: center; min-width: 80px; }
    .stat-val { font-size: 28px; font-weight: 700; color: var(--wp-primary); }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: var(--wp-text-hint); }

    .chart-wrap { max-width: 220px; margin: 0 auto 16px; }
    .top-states { list-style: none; padding: 0; margin: 0; }
    .top-states li {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 0; border-bottom: 1px solid var(--wp-divider); font-size: 14px;
    }
    .state-count {
      padding: 2px 10px; border-radius: 10px;
      background: var(--wp-primary); color: white; font-size: 12px; font-weight: 600;
    }
    .fuel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fuel-card { padding: 12px 14px; border-radius: 10px; background: var(--wp-surface-variant); }
    .fuel-val { font-size: 22px; font-weight: 700; color: var(--wp-primary); }
    .fuel-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .7px; color: var(--wp-text-hint); }

    .empty-note { color: var(--wp-text-hint); font-size: 14px; text-align: center; padding: 20px 0; }
  `],
  template: `
    <div class="page-container">
      <h2 style="margin:0 0 20px;font-size:22px;font-weight:700">📊 Stats</h2>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="48" /></div>
      } @else if (stats()) {
        <div class="grid">

          <!-- ── Destinations ────────────────────────────────── -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">place</mat-icon> Destinations</p>

            <div class="stat-row">
              <div class="stat-box">
                <div class="stat-val">{{ stats()!.destinations.total }}</div>
                <div class="stat-label">Total</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color:#1565c0">{{ stats()!.destinations.want_to_visit }}</div>
                <div class="stat-label">Wish List</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color:#f57f17">{{ stats()!.destinations.planned }}</div>
                <div class="stat-label">Planned</div>
              </div>
              <div class="stat-box">
                <div class="stat-val" style="color:#2e7d32">{{ stats()!.destinations.visited }}</div>
                <div class="stat-label">Visited</div>
              </div>
            </div>

            @if (stats()!.destinations.total > 0) {
              <div class="chart-wrap">
                <canvas baseChart type="doughnut"
                        [data]="destChartData()"
                        [options]="donutOptions"></canvas>
              </div>
            }

            @if (stats()!.destinations.top_states.length > 0) {
              <mat-divider style="margin-bottom:12px" />
              <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--wp-text-secondary)">Top States / Provinces</p>
              <ul class="top-states">
                @for (s of stats()!.destinations.top_states; track s.state_province) {
                  <li>
                    <span>{{ s.state_province }}</span>
                    <span class="state-count">{{ s.count }}</span>
                  </li>
                }
              </ul>
            }
          </mat-card>

          <!-- ── Trips ──────────────────────────────────────── -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">flight_takeoff</mat-icon> Trips</p>

            <div class="stat-row">
              <div class="stat-box">
                <div class="stat-val">{{ stats()!.trips.total }}</div>
                <div class="stat-label">Total</div>
              </div>
              <div class="stat-box">
                <div class="stat-val">{{ stats()!.trips.avg_duration_days }}</div>
                <div class="stat-label">Avg Days</div>
              </div>
              <div class="stat-box">
                <div class="stat-val">{{ stats()!.trips.total_days }}</div>
                <div class="stat-label">Days Total</div>
              </div>
            </div>

            @if (tripsChartData().labels!.length > 0) {
              <canvas baseChart type="bar"
                      [data]="tripsChartData()"
                      [options]="barOptions"></canvas>
            } @else {
              <p class="empty-note">No trip data yet</p>
            }
          </mat-card>

          <!-- ── Spending ───────────────────────────────────── -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">receipt_long</mat-icon> Spending</p>

            <div class="stat-row">
              <div class="stat-box">
                <div class="stat-val">{{ stats()!.expenses.total | currency:'USD':'symbol':'1.0-0' }}</div>
                <div class="stat-label">Total Spent</div>
              </div>
              @if (stats()!.trips.total > 0) {
                <div class="stat-box">
                  <div class="stat-val">
                    {{ (stats()!.expenses.total / stats()!.trips.total) | currency:'USD':'symbol':'1.0-0' }}
                  </div>
                  <div class="stat-label">Avg / Trip</div>
                </div>
              }
            </div>

            @if (stats()!.expenses.total > 0) {
              <div class="chart-wrap">
                <canvas baseChart type="doughnut"
                        [data]="expChartData()"
                        [options]="donutOptions"></canvas>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
                @for (cat of expCategories; track cat.key) {
                  @if (stats()!.expenses[cat.key] > 0) {
                    <span style="font-size:12px;padding:2px 8px;border-radius:8px;color:white"
                          [style.background]="cat.color">
                      {{ cat.label }}: {{ stats()!.expenses[cat.key] | currency:'USD':'symbol':'1.0-0' }}
                    </span>
                  }
                }
              </div>
            } @else {
              <p class="empty-note">No expenses logged yet</p>
            }
          </mat-card>

          <!-- ── Road Stats ─────────────────────────────────── -->
          <mat-card class="panel">
            <p class="panel-title"><mat-icon color="primary">local_gas_station</mat-icon> Road Stats</p>

            <div class="fuel-grid">
              <div class="fuel-card">
                <div class="fuel-val">{{ stats()!.fuel.total_miles | number:'1.0-0' }}</div>
                <div class="fuel-lbl">Miles Driven</div>
              </div>
              <div class="fuel-card">
                <div class="fuel-val">{{ stats()!.fuel.total_gallons | number:'1.1-1' }}</div>
                <div class="fuel-lbl">Gallons</div>
              </div>
              <div class="fuel-card">
                <div class="fuel-val">{{ stats()!.fuel.total_cost | currency:'USD':'symbol':'1.0-0' }}</div>
                <div class="fuel-lbl">Fuel Cost</div>
              </div>
              <div class="fuel-card">
                <div class="fuel-val">
                  @if (costPerMile() !== null) {
                    {{ costPerMile()! | currency:'USD':'symbol':'1.2-2' }}
                  } @else {
                    —
                  }
                </div>
                <div class="fuel-lbl">Per Mile</div>
              </div>
            </div>

            @if (stats()!.fuel.total_miles === 0) {
              <p class="empty-note" style="margin-top:16px">Log fuel stops to track road stats</p>
            }
          </mat-card>

        </div>
      }
    </div>
  `,
})
export class StatsComponent implements OnInit {
  private svc = inject(StatsService);

  loading = signal(true);
  stats   = signal<StatsResponse | null>(null);

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
    const d = this.stats()?.destinations;
    if (!d) return { labels: [], datasets: [{ data: [] }] };
    return {
      labels: ['Wish List', 'Planned', 'Visited'],
      datasets: [{
        data: [d.want_to_visit, d.planned, d.visited],
        backgroundColor: ['#1565c0', '#f57f17', '#2e7d32'],
      }],
    };
  });

  tripsChartData = computed<ChartData<'bar'>>(() => {
    const rows = this.stats()?.trips.by_year ?? [];
    return {
      labels: rows.map((r) => String(r.year)),
      datasets: [{
        label: 'Trips',
        data: rows.map((r) => r.count),
        backgroundColor: 'rgba(0,105,92,.75)',
        borderRadius: 6,
      }],
    };
  });

  expChartData = computed<ChartData<'doughnut'>>(() => {
    const e = this.stats()?.expenses;
    if (!e) return { labels: [], datasets: [{ data: [] }] };
    const cats = this.expCategories.filter((c) => e[c.key] > 0);
    return {
      labels: cats.map((c) => c.label),
      datasets: [{
        data: cats.map((c) => e[c.key]),
        backgroundColor: cats.map((c) => c.color),
      }],
    };
  });

  costPerMile = computed(() => {
    const f = this.stats()?.fuel;
    if (!f || f.total_miles === 0) return null;
    return f.total_cost / f.total_miles;
  });

  ngOnInit() {
    this.svc.get().subscribe({
      next: (s) => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
