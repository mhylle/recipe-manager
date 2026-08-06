import { Routes } from '@angular/router';
import { canContributeGuard } from '../../shared/guards/can-contribute.guard';

export const RECIPE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./recipe-list/recipe-list').then((m) => m.RecipeListComponent),
  },
  {
    path: 'new',
    canActivate: [canContributeGuard],
    loadComponent: () => import('./recipe-form/recipe-form').then((m) => m.RecipeFormComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./recipe-detail/recipe-detail').then((m) => m.RecipeDetailComponent),
  },
  {
    // Same guard as 'new': the backend gates PATCH on the grant too, so without
    // it an account that cannot contribute reaches an edit form it cannot save.
    // Authorship is checked separately, by the form itself.
    path: ':id/edit',
    canActivate: [canContributeGuard],
    loadComponent: () => import('./recipe-form/recipe-form').then((m) => m.RecipeFormComponent),
  },
];
