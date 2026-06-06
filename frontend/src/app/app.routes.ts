import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'travels',
    loadComponent: () =>
      import('./features/travels/travels.component').then((m) => m.TravelsComponent),
  },
  {
    path: 'trips',
    loadChildren: () =>
      import('./features/trips/trips.routes').then((m) => m.TRIP_ROUTES),
  },
  {
    path: 'destinations',
    loadChildren: () =>
      import('./features/destinations/destinations.routes').then(
        (m) => m.DESTINATION_ROUTES,
      ),
  },
  {
    path: 'restaurants',
    loadChildren: () =>
      import('./features/restaurants/restaurants.routes').then(
        (m) => m.RESTAURANT_ROUTES,
      ),
  },
  {
    path: 'lodging',
    loadChildren: () =>
      import('./features/lodging/lodging.routes').then((m) => m.LODGING_ROUTES),
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./features/map/map.component').then((m) => m.MapComponent),
  },
  {
    path: 'stats',
    loadComponent: () =>
      import('./features/stats/stats.component').then((m) => m.StatsComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
];
