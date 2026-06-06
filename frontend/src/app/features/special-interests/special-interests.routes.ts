import { Routes } from '@angular/router';

export const SPECIAL_INTEREST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./special-interests.component').then(m => m.SpecialInterestsComponent),
  },
];
