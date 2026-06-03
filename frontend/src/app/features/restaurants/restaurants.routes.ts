import { Routes } from '@angular/router';

export const RESTAURANT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./restaurant-list/restaurant-list.component').then(
        (m) => m.RestaurantListComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./restaurant-form/restaurant-form.component').then(
        (m) => m.RestaurantFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./restaurant-detail/restaurant-detail.component').then(
        (m) => m.RestaurantDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./restaurant-form/restaurant-form.component').then(
        (m) => m.RestaurantFormComponent,
      ),
  },
];
