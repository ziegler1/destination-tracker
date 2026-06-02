import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  constructor() {
    effect(() => {
      document.body.classList.toggle('dark-theme', this.darkMode());
    });
    this.applyVars(this.darkMode());
  }

  toggle(): void {
    this.darkMode.update((v) => !v);
    this.applyVars(this.darkMode());
  }

  private applyVars(dark: boolean): void {
    const r = document.documentElement;
    if (dark) {
      r.style.setProperty('--wp-bg',              '#121212');
      r.style.setProperty('--wp-surface',         '#1e1e1e');
      r.style.setProperty('--wp-surface-variant', '#2a2a2a');
      r.style.setProperty('--wp-text-primary',    'rgba(255,255,255,.87)');
      r.style.setProperty('--wp-text-secondary',  'rgba(255,255,255,.60)');
      r.style.setProperty('--wp-text-hint',       'rgba(255,255,255,.38)');
      r.style.setProperty('--wp-border',          'rgba(255,255,255,.12)');
      r.style.setProperty('--wp-divider',         'rgba(255,255,255,.08)');
      r.style.setProperty('--wp-sidebar-bg',      '#1a2e2a');
      r.style.setProperty('--wp-sidebar-text',    'rgba(255,255,255,.90)');
      r.style.setProperty('--wp-sidebar-active',  'rgba(255,255,255,.12)');
      r.style.setProperty('--wp-shadow',          'rgba(0,0,0,.50)');
      r.style.setProperty('--wp-status-visited',  '#66bb6a');
    } else {
      r.style.setProperty('--wp-bg',              '#f5f5f5');
      r.style.setProperty('--wp-surface',         '#ffffff');
      r.style.setProperty('--wp-surface-variant', '#f0f0f0');
      r.style.setProperty('--wp-text-primary',    'rgba(0,0,0,.87)');
      r.style.setProperty('--wp-text-secondary',  'rgba(0,0,0,.60)');
      r.style.setProperty('--wp-text-hint',       'rgba(0,0,0,.38)');
      r.style.setProperty('--wp-border',          'rgba(0,0,0,.12)');
      r.style.setProperty('--wp-divider',         'rgba(0,0,0,.08)');
      r.style.setProperty('--wp-sidebar-bg',      '#00695C');
      r.style.setProperty('--wp-sidebar-text',    'rgba(255,255,255,.92)');
      r.style.setProperty('--wp-sidebar-active',  'rgba(255,255,255,.18)');
      r.style.setProperty('--wp-shadow',          'rgba(0,0,0,.16)');
      r.style.setProperty('--wp-status-visited',  '#43a047');
    }
  }
}
