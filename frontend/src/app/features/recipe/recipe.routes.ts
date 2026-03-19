import { Routes } from '@angular/router';

export const RECIPE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./recipe-list/recipe-list').then((m) => m.RecipeListComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./recipe-form/recipe-form').then((m) => m.RecipeFormComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./recipe-detail/recipe-detail').then((m) => m.RecipeDetailComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./recipe-form/recipe-form').then((m) => m.RecipeFormComponent),
  },
];
