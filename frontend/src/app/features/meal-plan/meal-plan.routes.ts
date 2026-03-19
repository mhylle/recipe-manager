import { Routes } from '@angular/router';

export const MEAL_PLAN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./meal-plan-grid/meal-plan-grid').then((m) => m.MealPlanGridComponent),
  },
];
