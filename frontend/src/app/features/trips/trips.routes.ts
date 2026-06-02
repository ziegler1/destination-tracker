import { Routes } from '@angular/router';

export const TRIP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./trips-list.component').then((m) => m.TripsListComponent),
  },
];
