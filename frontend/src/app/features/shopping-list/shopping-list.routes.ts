import { Routes } from '@angular/router';

export const SHOPPING_LIST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shopping-list-view/shopping-list-view').then((m) => m.ShoppingListViewComponent),
  },
];
