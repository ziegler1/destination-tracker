import { Routes } from '@angular/router';

export const LODGING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lodging-list.component').then((m) => m.LodgingListComponent),
  },
];
