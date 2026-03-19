import { Routes } from '@angular/router';

export const PANTRY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pantry-list/pantry-list').then((m) => m.PantryListComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./pantry-form/pantry-form').then((m) => m.PantryFormComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pantry-detail/pantry-detail').then((m) => m.PantryDetailComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pantry-form/pantry-form').then((m) => m.PantryFormComponent),
  },
];
