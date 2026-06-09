import { Injectable, signal, computed } from '@angular/core';

export interface SiCategory {
  value:   string;
  label:   string;
  icon:    string;
  custom?: boolean;
}

export const BUILT_IN_SI_CATEGORIES: SiCategory[] = [
  { value: 'winery_brewery',      label: 'Winery / Brewery',    icon: '🍷' },
  { value: 'bourbon_distillery',  label: 'Bourbon Distillery',  icon: '🥃' },
  { value: 'museum',              label: 'Museum',               icon: '🏛️' },
  { value: 'historic_site',       label: 'Historic Site',        icon: '🏛️' },
  { value: 'state_park',          label: 'State Park',           icon: '🌲' },
  { value: 'national_park',       label: 'National Park',        icon: '⛰️' },
  { value: 'live_music',          label: 'Live Music',           icon: '🎵' },
  { value: 'scenic',              label: 'Scenic',               icon: '🌅' },
  { value: 'roadside_attraction', label: 'Roadside Attraction',  icon: '🗿' },
  { value: 'shopping',            label: 'Shopping',             icon: '🛍️' },
  { value: 'other',               label: 'Other',                icon: '📌' },
];

const STORAGE_KEY = 'wp_si_custom_cats';

@Injectable({ providedIn: 'root' })
export class SiCategoryService {
  private custom = signal<SiCategory[]>(this.loadFromStorage());

  readonly all = computed<SiCategory[]>(() => [
    ...BUILT_IN_SI_CATEGORIES,
    ...this.custom(),
  ]);

  byValue(value?: string | null): SiCategory | undefined {
    if (!value) return undefined;
    return this.all().find(c => c.value === value);
  }

  icon(value?: string | null):  string { return this.byValue(value)?.icon  ?? '📌'; }
  label(value?: string | null): string { return this.byValue(value)?.label ?? (value ?? ''); }

  add(label: string): SiCategory {
    const trimmed = label.trim();
    const value   = trimmed.toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, '');
    if (this.all().some(c => c.value === value)) {
      throw new Error(`Category "${trimmed}" already exists.`);
    }
    const cat: SiCategory = { value, label: trimmed, icon: '📌', custom: true };
    this.custom.update(list => [...list, cat]);
    this.persist();
    return cat;
  }

  remove(value: string): void {
    this.custom.update(list => list.filter(c => c.value !== value));
    this.persist();
  }

  customCategories(): SiCategory[] {
    return this.custom();
  }

  private loadFromStorage(): SiCategory[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SiCategory[];
    } catch {
      return [];
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.custom()));
  }
}
