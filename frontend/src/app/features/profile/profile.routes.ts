import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./profile-page/profile-page').then((m) => m.ProfilePageComponent),
  },
];
