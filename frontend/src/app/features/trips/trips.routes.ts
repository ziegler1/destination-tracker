import { Routes } from '@angular/router';

export const TRIP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./trips-list/trips-list.component').then((m) => m.TripsListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./trip-wizard/trip-wizard.component').then((m) => m.TripWizardComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./trip-detail/trip-detail.component').then((m) => m.TripDetailComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./trip-form/trip-form.component').then((m) => m.TripFormComponent),
  },
  {
    path: ':id/journal',
    loadComponent: () =>
      import('./trip-detail/trip-detail.component').then((m) => m.TripDetailComponent),
  },
];
