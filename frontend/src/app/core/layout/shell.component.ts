import {
  Component, OnInit, ViewChild, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../services/theme.service';

interface NavItem { icon: string; label: string; path: string; }

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  styles: [`
    :host { display: block; height: 100vh; }

    mat-sidenav-container { height: 100%; }

    mat-sidenav {
      width: 240px;
      background: var(--wp-sidebar-bg);
      color: var(--wp-sidebar-text);
      border-right: none;
    }

    .brand {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 18px 16px;
      border-bottom: 1px solid rgba(255,255,255,.12);
    }
    .brand-icon { font-size: 26px; }
    .brand-name { font-size: 19px; font-weight: 700; color: #fff; letter-spacing: .3px; }

    .nav-item {
      margin: 2px 8px !important;
      border-radius: 8px !important;
      color: var(--wp-sidebar-text) !important;
    }
    .nav-item:hover  { background: var(--wp-sidebar-active) !important; }
    .nav-item.active { background: rgba(255,255,255,.22) !important; font-weight: 600; }

    .nav-icon  { margin-right: 10px; font-size: 18px; }

    .sidebar-footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,.12);
      display: flex; align-items: center; gap: 8px;
    }
    .sidebar-footer button { color: var(--wp-sidebar-text) !important; }
    .footer-label { font-size: 13px; color: var(--wp-sidebar-text); }

    .top-bar {
      background: var(--wp-surface) !important;
      color: var(--wp-text-primary) !important;
      border-bottom: 1px solid var(--wp-border);
      box-shadow: 0 2px 4px var(--wp-shadow);
      position: sticky; top: 0; z-index: 200;
      min-height: 56px;
    }
    .page-title { font-size: 17px; font-weight: 500; margin-left: 4px; }

    .content-wrap {
      background: var(--wp-bg);
      min-height: calc(100vh - 56px);
    }
  `],
  template: `
    <mat-sidenav-container>
      <mat-sidenav #sidenav
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="!isMobile()">

        <div class="brand">
          <span class="brand-icon">✈️</span>
          <span class="brand-name">Waypoint</span>
        </div>

        <mat-nav-list>
          @for (item of navItems; track item.path) {
            <a mat-list-item class="nav-item"
               [routerLink]="item.path"
               routerLinkActive="active"
               (click)="isMobile() && sidenav.close()">
              <span class="nav-icon">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </mat-nav-list>

        <div class="sidebar-footer">
          <button mat-icon-button
                  (click)="theme.toggle()"
                  [matTooltip]="theme.darkMode() ? 'Switch to light' : 'Switch to dark'">
            <mat-icon>{{ theme.darkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <span class="footer-label">{{ theme.darkMode() ? 'Light mode' : 'Dark mode' }}</span>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="top-bar">
          @if (isMobile()) {
            <button mat-icon-button (click)="sidenav.toggle()">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="page-title">{{ pageTitle() }}</span>
        </mat-toolbar>

        <div class="content-wrap">
          <router-outlet />
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class ShellComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  protected theme = inject(ThemeService);
  private router = inject(Router);
  private bp = inject(BreakpointObserver);

  isMobile = signal(false);
  pageTitle = signal('Waypoint');

  readonly navItems: NavItem[] = [
    { icon: '✈️',  label: 'Trips',        path: '/trips' },
    { icon: '📍',  label: 'Destinations', path: '/destinations' },
    { icon: '🍽️', label: 'Restaurants',  path: '/restaurants' },
    { icon: '🏨',  label: 'Lodging',      path: '/lodging' },
    { icon: '🗺️', label: 'Map',          path: '/map' },
    { icon: '📊',  label: 'Stats',        path: '/stats' },
  ];

  ngOnInit(): void {
    this.bp.observe(['(max-width: 768px)']).subscribe((r) =>
      this.isMobile.set(r.matches),
    );

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        const seg = '/' + this.router.url.split('/')[1];
        const item = this.navItems.find((n) => n.path === seg);
        this.pageTitle.set(item?.label ?? 'Waypoint');
      });
  }
}
