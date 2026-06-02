import { Routes } from '@angular/router';

export const RESTAURANT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./restaurants-list.component').then((m) => m.RestaurantsListComponent),
  },
];
