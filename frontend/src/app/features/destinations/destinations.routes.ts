import { Routes } from '@angular/router';

export const DESTINATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./destination-list/destination-list.component').then(
        (m) => m.DestinationListComponent,
      ),
  },
  {
    path: 'suggest',
    loadComponent: () =>
      import('./destination-suggest/destination-suggest.component').then(
        (m) => m.DestinationSuggestComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./destination-form/destination-form.component').then(
        (m) => m.DestinationFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./destination-detail/destination-detail.component').then(
        (m) => m.DestinationDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./destination-form/destination-form.component').then(
        (m) => m.DestinationFormComponent,
      ),
  },
];
