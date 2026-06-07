import { Routes } from '@angular/router';

export const SPECIAL_INTEREST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./special-interests.component').then(m => m.SpecialInterestsComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./special-interest-form/special-interest-form.component').then(
        (m) => m.SpecialInterestFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./special-interest-detail/special-interest-detail.component').then(
        (m) => m.SpecialInterestDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./special-interest-form/special-interest-form.component').then(
        (m) => m.SpecialInterestFormComponent,
      ),
  },
];
