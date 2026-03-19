import { Routes } from '@angular/router';

export const STAPLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./staples-config/staples-config').then((m) => m.StaplesConfigComponent),
  },
];
