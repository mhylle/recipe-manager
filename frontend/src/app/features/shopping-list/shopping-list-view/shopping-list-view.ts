import { mondayOf } from '../../../shared/utils/week';
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ShoppingListService } from '../shopping-list.service';
import { MealPlanService } from '../../meal-plan/meal-plan.service';
import { BilkaToGoService } from '../bilkatogo/bilkatogo.service';
import { BilkaToGoLoginDialogComponent } from '../bilkatogo/bilkatogo-login-dialog';
import { BilkaToGoResultsDialogComponent } from '../bilkatogo/bilkatogo-results-dialog';
import { ShoppingList, ShoppingListItem } from '../../../shared/models/shopping-list.model';
import { BilkaToGoSendResult } from '../../../shared/models/bilkatogo.model';
import { Unit } from '../../../shared/enums/unit.enum';
import {
  EnumLabelPipe,
  LocaleDatePipe,
  LocaleNumberPipe,
  LocaleService,
  TranslatePipe,
} from '../../../shared/i18n';
import { reloadOnKitchenChange } from '../../../shared/services/reload-on-kitchen-change';

@Component({
  selector: 'app-shopping-list-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BilkaToGoLoginDialogComponent,
    BilkaToGoResultsDialogComponent,
    TranslatePipe,
    EnumLabelPipe,
    LocaleDatePipe,
    LocaleNumberPipe,
  ],
  templateUrl: './shopping-list-view.html',
  styleUrl: './shopping-list-view.scss',
})
export class ShoppingListViewComponent {
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly bilkaToGoService = inject(BilkaToGoService);
  private readonly locale = inject(LocaleService);
  private readonly route = inject(ActivatedRoute);

  readonly shoppingList = signal<ShoppingList | null>(null);
  readonly generating = signal(false);
  readonly showLoginDialog = signal(false);
  readonly showResultsDialog = signal(false);
  readonly bilkatogoResult = signal<BilkaToGoSendResult | null>(null);
  readonly sendingToBilkatogo = signal(false);
  readonly bilkatogoSessionId = signal<string | null>(null);

  readonly hasUncheckedItems = computed(() => {
    const list = this.shoppingList();
    return list !== null && list.items.some((item) => !item.checked);
  });

  /** Translated unit, for feeding into the checkbox's parameterised aria-label. */
  unitLabel(unit: Unit): string {
    return this.locale.translate(`enum.unit.${unit}`);
  }

  private currentMealPlanId = '';

  // Re-fetches on every language switch; item names are localised server-side.
  private readonly reload = reloadOnKitchenChange(() => this.loadList());

  private loadList(): void {
    // If navigated with a list ID (e.g. from recipe detail), load it
    const listId = this.route.snapshot.queryParamMap.get('id');
    if (listId) {
      this.shoppingListService.getById(listId).subscribe((list) => {
        this.shoppingList.set(list);
      });
    }

    // Load current week's meal plan to get its ID
    const weekStart = mondayOf();
    this.mealPlanService.getByWeek(weekStart).subscribe((plan) => {
      this.currentMealPlanId = plan.id;
    });
  }

  generateList(): void {
    if (!this.currentMealPlanId) return;
    this.generating.set(true);
    this.shoppingListService.generate(this.currentMealPlanId).subscribe({
      next: (list) => {
        this.shoppingList.set(list);
        this.generating.set(false);
      },
      error: () => this.generating.set(false),
    });
  }

  toggleItem(index: number): void {
    const list = this.shoppingList();
    if (!list) return;
    this.shoppingListService.toggleItem(list.id, index).subscribe((updated) => {
      this.shoppingList.set(updated);
    });
  }

  sendToBilkatogo(): void {
    if (this.bilkatogoSessionId()) {
      this.sendToCart();
    } else {
      this.showLoginDialog.set(true);
    }
  }

  onBilkatogoLoginSuccess(sessionId: string): void {
    this.bilkatogoSessionId.set(sessionId);
    this.showLoginDialog.set(false);
    this.sendToCart();
  }

  private sendToCart(): void {
    const list = this.shoppingList();
    const sessionId = this.bilkatogoSessionId();
    if (!list || !sessionId) return;

    this.sendingToBilkatogo.set(true);
    this.bilkaToGoService.sendToCart(list.id, sessionId).subscribe({
      next: (result) => {
        this.bilkatogoResult.set(result);
        this.showResultsDialog.set(true);
        this.sendingToBilkatogo.set(false);
      },
      error: () => {
        this.sendingToBilkatogo.set(false);
        alert(this.locale.translate('shoppingList.sendFailed'));
      },
    });
  }

}
