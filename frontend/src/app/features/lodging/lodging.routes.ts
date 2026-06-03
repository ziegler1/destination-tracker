import { Routes } from '@angular/router';

export const LODGING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lodging-list/lodging-list.component').then(
        (m) => m.LodgingListComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./lodging-form/lodging-form.component').then(
        (m) => m.LodgingFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./lodging-detail/lodging-detail.component').then(
        (m) => m.LodgingDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./lodging-form/lodging-form.component').then(
        (m) => m.LodgingFormComponent,
      ),
  },
];
