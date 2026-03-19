import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES) },
      { path: 'pantry', loadChildren: () => import('./features/pantry/pantry.routes').then((m) => m.PANTRY_ROUTES) },
      { path: 'recipes', loadChildren: () => import('./features/recipe/recipe.routes').then((m) => m.RECIPE_ROUTES) },
      { path: 'staples', loadChildren: () => import('./features/staples/staples.routes').then((m) => m.STAPLES_ROUTES) },
      { path: 'meal-plan', loadChildren: () => import('./features/meal-plan/meal-plan.routes').then((m) => m.MEAL_PLAN_ROUTES) },
      { path: 'shopping-list', loadChildren: () => import('./features/shopping-list/shopping-list.routes').then((m) => m.SHOPPING_LIST_ROUTES) },
    ],
  },
];
