import {
  Component, OnInit, ChangeDetectionStrategy, HostListener,
  inject, signal, computed,
} from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ThemeService } from '../services/theme.service';
import { TripService } from '../services/trip.service';
import { Trip } from '../../types/schema.types';
import { QuickAddRestaurantComponent } from '../../shared/components/quick-add/quick-add-restaurant.component';
import { QuickAddLodgingComponent } from '../../shared/components/quick-add/quick-add-lodging.component';
import { QuickAddDestinationComponent } from '../../shared/components/quick-add/quick-add-destination.component';
import { QuickAddFuelComponent } from '../../shared/components/quick-add/quick-add-fuel.component';

interface NavItem { icon: string; label: string; path: string; exact?: boolean; }
interface QuickAddItem { icon: string; label: string; type: string; }

const PRIMARY_NAV: NavItem[] = [
  { icon: '🏠',  label: 'Home',            path: '/',            exact: true },
  { icon: '🗺️', label: 'My Travels',      path: '/travels' },
  { icon: '✈️',  label: 'Trips',           path: '/trips' },
  { icon: '📊',  label: 'Stats & Insights', path: '/stats' },
];

const SECONDARY_NAV: NavItem[] = [
  { icon: '📍',  label: 'Destinations',  path: '/destinations' },
  { icon: '🍽️', label: 'Restaurants',   path: '/restaurants' },
  { icon: '🏨',  label: 'Lodging',       path: '/lodging' },
];

const QUICK_ADD_ITEMS: QuickAddItem[] = [
  { icon: '📍', label: 'Destination', type: 'destination' },
  { icon: '🍽️', label: 'Restaurant', type: 'restaurant' },
  { icon: '🏨', label: 'Lodging',     type: 'lodging' },
  { icon: '⛽', label: 'Fuel Stop',   type: 'fuel' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, DatePipe,
    MatIconModule, MatButtonModule, MatTooltipModule,
    MatDividerModule, MatSnackBarModule,
  ],
  styles: [`
    /* ── Layout ────────────────────────────────────────────────── */
    :host { display:flex; height:100vh; overflow:hidden; }

    .sidebar {
      width: 280px;
      flex-shrink: 0;
      height: 100vh;
      background: var(--wp-sidebar-bg);
      color: var(--wp-sidebar-text);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .main-content {
      flex: 1;
      height: 100vh;
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--wp-bg);
    }

    /* ── Brand ─────────────────────────────────────────────────── */
    .brand {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 16px 14px;
      border-bottom: 1px solid rgba(255,255,255,.1);
    }
    .brand-icon { font-size: 28px; }
    .brand-text { line-height: 1.2; }
    .brand-name { display: block; font-size: 18px; font-weight: 800; color: #fff; letter-spacing: .2px; }
    .brand-tag  { display: block; font-size: 11px; color: rgba(255,255,255,.55); margin-top: 1px; }

    /* ── Plan a Trip CTA ────────────────────────────────────────── */
    .cta-wrap { padding: 14px 12px 6px; }
    .plan-btn {
      width: 100%; height: 44px; font-size: 14px; font-weight: 700;
      letter-spacing: .3px; background: #FFB300 !important; color: #000 !important;
      border-radius: 10px !important;
    }

    /* ── Quick Add ──────────────────────────────────────────────── */
    .qa-wrap { padding: 4px 12px 8px; }
    .qa-toggle {
      width: 100%; height: 36px; font-size: 13px;
      color: var(--wp-sidebar-text) !important;
      border-color: rgba(255,255,255,.2) !important;
      border-radius: 8px !important;
      justify-content: flex-start; gap: 6px;
    }
    .qa-items {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; margin-top: 6px;
    }
    .qa-item {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px; border-radius: 8px; cursor: pointer;
      font-size: 13px; color: var(--wp-sidebar-text);
      background: rgba(255,255,255,.08);
      text-decoration: none; transition: background .15s;
    }
    .qa-item:hover { background: rgba(255,255,255,.16); }

    /* ── Navigation ─────────────────────────────────────────────── */
    .nav { padding: 4px 8px; flex: 1; }
    .nav-divider { border-color: rgba(255,255,255,.1) !important; margin: 6px 8px; }
    .nav-section-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: rgba(255,255,255,.35);
      padding: 10px 8px 4px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 10px; border-radius: 8px; margin-bottom: 2px;
      font-size: 14px; color: var(--wp-sidebar-text);
      text-decoration: none; transition: background .15s, color .15s;
    }
    .nav-item:hover { background: rgba(255,255,255,.08); }
    .nav-item.active { background: rgba(255,255,255,.18); font-weight: 600; }
    .nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }

    /* ── Active Trip Card ────────────────────────────────────────── */
    .active-trip-card {
      margin: 8px 12px; padding: 12px 14px;
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 10px; border-left: 3px solid #FFB300;
    }
    .atrip-badge {
      font-size: 9px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 1.2px; color: #FFB300; margin-bottom: 4px;
    }
    .atrip-name { font-size: 14px; font-weight: 700; color: #fff; margin: 0 0 2px; }
    .atrip-meta { font-size: 12px; color: rgba(255,255,255,.6); margin: 0 0 10px; }
    .atrip-btn {
      width: 100%; font-size: 12px; height: 32px;
      background: rgba(255,255,255,.15) !important;
      color: #fff !important; border-radius: 6px !important;
    }

    /* ── Sidebar Footer ──────────────────────────────────────────── */
    .sidebar-footer {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; border-top: 1px solid rgba(255,255,255,.1);
    }
    .sidebar-footer button { color: var(--wp-sidebar-text) !important; }
    .footer-label { font-size: 13px; color: var(--wp-sidebar-text); }

    /* ── Install Banner ──────────────────────────────────────────── */
    .install-banner {
      background: var(--wp-primary); color: white;
      padding: 10px 20px; display: flex; align-items: center; gap: 12px; font-size: 14px;
    }

    /* ── Mobile Bottom Tabs ──────────────────────────────────────── */
    .bottom-tabs {
      display: none;
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 56px; background: var(--wp-surface);
      border-top: 1px solid var(--wp-border);
      z-index: 500; box-shadow: 0 -2px 8px var(--wp-shadow);
    }
    .btab-grid { display: grid; grid-template-columns: repeat(5,1fr); height: 100%; }
    .btab {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; color: var(--wp-text-secondary); text-decoration: none;
      font-size: 10px; cursor: pointer; border: none; background: none;
      transition: color .15s;
    }
    .btab:hover, .btab.active { color: var(--wp-primary); }
    .btab mat-icon { font-size: 22px; width: 22px; height: 22px; }

    /* ── More Overlay (mobile) ───────────────────────────────────── */
    .more-overlay {
      position: fixed; bottom: 56px; left: 0; right: 0;
      background: var(--wp-surface); border-top: 1px solid var(--wp-border);
      padding: 12px; z-index: 499; box-shadow: 0 -4px 16px var(--wp-shadow);
    }
    .more-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
    .more-item {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 10px; border-radius: 10px; background: var(--wp-surface-variant);
      text-decoration: none; font-size: 12px; color: var(--wp-text-primary);
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main-content { height: calc(100vh - 56px); margin-bottom: 56px; }
      .bottom-tabs { display: block; }
    }
  `],
  template: `
    <!-- ── LEFT SIDEBAR (desktop) ──────────────────────────────── -->
    <aside class="sidebar">

      <!-- Brand -->
      <div class="brand">
        <span class="brand-icon">✈️</span>
        <div class="brand-text">
          <span class="brand-name">Waypoint</span>
          <span class="brand-tag">Your Travel Encyclopedia</span>
        </div>
      </div>

      <!-- Plan a Trip CTA -->
      <div class="cta-wrap">
        <a mat-raised-button class="plan-btn" [routerLink]="['/trips/new']">
          <mat-icon>add_road</mat-icon> Plan a New Trip
        </a>
      </div>

      <!-- Quick Add expandable -->
      <div class="qa-wrap">
        <button mat-stroked-button class="qa-toggle" (click)="toggleQA()">
          <mat-icon>{{ qaOpen() ? 'remove' : 'add' }}</mat-icon>
          Quick Add
          <span style="flex:1"></span>
          <mat-icon style="font-size:16px;width:16px;height:16px">
            {{ qaOpen() ? 'expand_less' : 'expand_more' }}
          </mat-icon>
        </button>
        @if (qaOpen()) {
          <div class="qa-items">
            @for (item of quickAddItems; track item.type) {
              <button class="qa-item" (click)="openQuickAdd(item.type)">
                <span>{{ item.icon }}</span> {{ item.label }}
              </button>
            }
          </div>
        }
      </div>

      <!-- Primary nav -->
      <nav class="nav">
        @for (item of primaryNav; track item.path) {
          <a class="nav-item" [routerLink]="item.path" routerLinkActive="active"
             [routerLinkActiveOptions]="item.exact ? { exact: true } : { exact: false }">
            <span class="nav-icon">{{ item.icon }}</span>{{ item.label }}
          </a>
        }

        <mat-divider class="nav-divider" />

        @for (item of secondaryNav; track item.path) {
          <a class="nav-item" [routerLink]="item.path" routerLinkActive="active">
            <span class="nav-icon">{{ item.icon }}</span>{{ item.label }}
          </a>
        }
      </nav>

      <!-- Active trip card -->
      @if (activeTrip()) {
        <div class="active-trip-card">
          <div class="atrip-badge">🔴 Active Trip</div>
          <p class="atrip-name">{{ activeTrip()!.name }}</p>
          <p class="atrip-meta">
            {{ activeTrip()!.start_date | date:'MMM d' }} → {{ activeTrip()!.end_date | date:'MMM d' }}
            @if (daysRemaining() !== null) {
              · {{ daysRemaining() }} days left
            }
          </p>
          <a mat-flat-button class="atrip-btn" [routerLink]="['/trips', activeTrip()!.id]">
            Open Companion →
          </a>
        </div>
      }

      <!-- Footer: theme toggle -->
      <div class="sidebar-footer">
        <button mat-icon-button (click)="theme.toggle()"
                [matTooltip]="theme.darkMode() ? 'Switch to light' : 'Switch to dark'">
          <mat-icon>{{ theme.darkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
        <span class="footer-label">{{ theme.darkMode() ? 'Light mode' : 'Dark mode' }}</span>
      </div>
    </aside>

    <!-- ── MAIN CONTENT ──────────────────────────────────────────── -->
    <div class="main-content">
      @if (showInstall()) {
        <div class="install-banner">
          <mat-icon>install_mobile</mat-icon>
          <span style="flex:1">Install Waypoint for offline access and home screen shortcut</span>
          <button mat-stroked-button style="color:white;border-color:rgba(255,255,255,.6)" (click)="installApp()">Install</button>
          <button mat-icon-button style="color:white" (click)="showInstall.set(false)"><mat-icon>close</mat-icon></button>
        </div>
      }
      <router-outlet />
    </div>

    <!-- ── MOBILE BOTTOM TABS ────────────────────────────────────── -->
    <div class="bottom-tabs">
      <div class="btab-grid">
        <a class="btab" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
          <mat-icon>home</mat-icon><span>Home</span>
        </a>
        <a class="btab" routerLink="/travels" routerLinkActive="active">
          <mat-icon>map</mat-icon><span>Travels</span>
        </a>
        <a class="btab" routerLink="/trips" routerLinkActive="active">
          <mat-icon>flight_takeoff</mat-icon><span>Trips</span>
        </a>
        <button class="btab" (click)="toggleQA()">
          <mat-icon>add_circle</mat-icon><span>Add</span>
        </button>
        <button class="btab" (click)="toggleMore()">
          <mat-icon>more_horiz</mat-icon><span>More</span>
        </button>
      </div>
    </div>

    <!-- Mobile Quick Add overlay -->
    @if (qaOpen() && isMobile()) {
      <div class="more-overlay">
        <div class="more-grid">
          @for (item of quickAddItems; track item.type) {
            <button class="more-item" (click)="openQuickAdd(item.type)">
              <span style="font-size:24px">{{ item.icon }}</span>{{ item.label }}
            </button>
          }
        </div>
      </div>
    }

    <!-- Mobile More overlay -->
    @if (moreOpen() && isMobile()) {
      <div class="more-overlay" (click)="moreOpen.set(false)">
        <div class="more-grid">
          <a class="more-item" routerLink="/stats">
            <span style="font-size:24px">📊</span>Stats
          </a>
          <a class="more-item" routerLink="/destinations">
            <span style="font-size:24px">📍</span>Destinations
          </a>
          <a class="more-item" routerLink="/restaurants">
            <span style="font-size:24px">🍽️</span>Restaurants
          </a>
          <a class="more-item" routerLink="/lodging">
            <span style="font-size:24px">🏨</span>Lodging
          </a>
        </div>
      </div>
    }
  `,
})
export class ShellComponent implements OnInit {
  protected theme      = inject(ThemeService);
  private tripSvc      = inject(TripService);
  private snack        = inject(MatSnackBar);
  private bottomSheet  = inject(MatBottomSheet);

  showInstall  = signal(false);
  qaOpen       = signal(false);
  moreOpen     = signal(false);
  isMobile     = signal(window.innerWidth <= 768);
  activeTrip   = signal<Trip | null>(null);

  private installPrompt: Event | null = null;

  readonly primaryNav    = PRIMARY_NAV;
  readonly secondaryNav  = SECONDARY_NAV;
  readonly quickAddItems = QUICK_ADD_ITEMS;

  daysRemaining = computed(() => {
    const t = this.activeTrip();
    if (!t?.end_date) return null;
    const diff = Math.ceil((new Date(t.end_date).getTime() - Date.now()) / 86_400_000);
    return diff > 0 ? diff : 0;
  });

  @HostListener('window:resize')
  onResize() { this.isMobile.set(window.innerWidth <= 768); }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    this.installPrompt = e;
    this.showInstall.set(true);
  }

  ngOnInit() {
    // Load trips to detect active trip for sidebar card
    this.tripSvc.list().subscribe(trips => {
      const active = trips.find(t => t.status === 'active') ?? null;
      this.activeTrip.set(active);
    });
  }

  toggleQA()   { this.qaOpen.set(!this.qaOpen());     this.moreOpen.set(false); }
  toggleMore() { this.moreOpen.set(!this.moreOpen()); this.qaOpen.set(false); }

  openQuickAdd(type: string) {
    this.qaOpen.set(false);
    this.moreOpen.set(false);
    const map: Record<string, unknown> = {
      restaurant:  QuickAddRestaurantComponent,
      lodging:     QuickAddLodgingComponent,
      destination: QuickAddDestinationComponent,
      fuel:        QuickAddFuelComponent,
    };
    const component = map[type] as Parameters<MatBottomSheet['open']>[0];
    if (component) this.bottomSheet.open(component);
  }

  installApp() {
    (this.installPrompt as any)?.prompt?.();
    this.showInstall.set(false);
  }
}
