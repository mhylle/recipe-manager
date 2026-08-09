import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService } from '../recipe.service';
import { ShoppingListService } from '../../shopping-list/shopping-list.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { AuthService } from '../../../shared/services/auth.service';
import { WakeLockService } from '../../../shared/services/wake-lock.service';
import {
  CookingTimerService,
  formatRemaining,
} from '../../../shared/services/cooking-timer.service';
import { TimerPushService } from '../../../shared/services/timer-push.service';
import { GeminiKeyDialogComponent } from '../../../shared/components/gemini-key-dialog/gemini-key-dialog';
import { TransferRecipeDialogComponent } from '../../../shared/components/transfer-recipe-dialog/transfer-recipe-dialog';
import { PlanRecipeDialogComponent } from '../../../shared/components/plan-recipe-dialog/plan-recipe-dialog';

/** Kept in step with RecipeImageService on the backend. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
import { SCALE_PRESETS, scaleFactor, scaleIngredients, type ScaleSelection } from '../recipe-scale';
import { parseStepDurations, type StepDuration } from '../step-duration';
import {
  EnumLabelPipe,
  LocaleNumberPipe,
  LocaleService,
  TranslatePipe,
  reloadOnLocaleChange,
} from '../../../shared/i18n';

@Component({
  selector: 'app-recipe-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    EnumLabelPipe,
    LocaleNumberPipe,
    GeminiKeyDialogComponent,
    TransferRecipeDialogComponent,
    PlanRecipeDialogComponent,
  ],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.scss',
})
export class RecipeDetailComponent implements OnInit, OnDestroy {
  private readonly recipeService = inject(RecipeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly locale = inject(LocaleService);
  // Exposed to the template so the toggle can reflect real lock state.
  readonly wakeLock = inject(WakeLockService);
  readonly timers = inject(CookingTimerService);
  // Exposed to the template so the offer reflects the real subscription state.
  readonly push = inject(TimerPushService);

  readonly recipe = signal<Recipe | null>(null);
  readonly chosenVariation = signal<string | null>(null);

  /** Whether the hand-over dialog is up. Author-only, gated by canEdit(). */
  readonly transferOpen = signal(false);

  /** Whether the meal-plan picker is up. Open to anyone with a kitchen. */
  readonly planOpen = signal(false);
  /** Confirmation after planning, so the action is not silent. */
  readonly planned = signal(false);
  readonly regenerating = signal(false);
  readonly addingToList = signal(false);
  readonly enablingPhoneAlarms = signal(false);
  /** Open while asking for the Gemini key that a generation run needs. */
  readonly keyDialogOpen = signal(false);
  readonly uploading = signal(false);
  /** Set when a chosen file is refused before it is ever sent. */
  readonly uploadErrorKey = signal<'recipe.detail.uploadTooLarge' | 'recipe.detail.uploadWrongType' | 'recipe.detail.uploadFailed' | null>(null);

  readonly scalePresets = SCALE_PRESETS;
  readonly scale = signal<ScaleSelection>({ mode: 'multiplier', multiplier: 1 });

  readonly totalTime = computed(() => {
    const r = this.recipe();
    return r ? r.prepTime + r.cookTime : 0;
  });

  readonly factor = computed(() => {
    const r = this.recipe();
    return r ? scaleFactor(this.scale(), r.servings) : 1;
  });

  readonly isScaled = computed(() => this.factor() !== 1);

  /**
   * Only the person who added this recipe may change it. Enforced server-side;
   * this keeps the UI from offering an action that would be refused.
   */
  readonly canEdit = computed(() => {
    const me = this.authService.localUserId();
    return !!me && this.recipe()?.createdBy?.id === me;
  });

  /** Servings after scaling — what the ingredient list below now makes. */
  readonly scaledServings = computed(() => {
    const r = this.recipe();
    if (!r) return 0;
    return Math.max(1, Math.round(r.servings * this.factor()));
  });

  readonly scaledIngredients = computed(() => {
    const r = this.recipe();
    return r ? scaleIngredients(r.ingredients, this.factor()) : [];
  });

  /**
   * Timeable durations per step, indexed the same as `instructions`.
   *
   * Recomputed when the language changes because the step text changes with it,
   * and the unit words are language-specific.
   */
  readonly stepDurations = computed<StepDuration[][]>(() => {
    const r = this.recipe();
    const activeLocale = this.locale.locale();
    if (!r) return [];
    return r.instructions.map((step) => parseStepDurations(step, activeLocale));
  });

  // Re-fetches on every language switch; API content is localised server-side.
  private readonly reload = reloadOnLocaleChange(() => this.loadRecipe());

  ngOnInit(): void {
    this.authService.checkAuth();
    // Re-attach to a subscription granted on an earlier visit, then pull back
    // any timer the backend is still holding — the pair is what makes a timer
    // survive the phone discarding this page.
    void this.push.syncExistingSubscription().then(() => {
      if (this.push.ringsOnPhone()) {
        return this.timers.restore();
      }
      return undefined;
    });
  }

  ngOnDestroy(): void {
    // The lock must not outlive the recipe that asked for it — walking away from
    // the page should not leave a phone burning its battery on a bright screen.
    // Timers deliberately DO outlive it: leaving the page to check the pantry
    // should not silently cancel a proving countdown.
    void this.wakeLock.disable();
  }

  toggleWakeLock(): void {
    void this.wakeLock.toggle();
  }

  // --- Scaling -------------------------------------------------------------

  setMultiplier(multiplier: number): void {
    this.scale.set({ mode: 'multiplier', multiplier });
  }

  setServings(value: string): void {
    const servings = Number(value);
    if (Number.isFinite(servings) && servings > 0) {
      this.scale.set({ mode: 'servings', servings });
    }
  }

  isPresetActive(multiplier: number): boolean {
    const current = this.scale();
    return current.mode === 'multiplier' && current.multiplier === multiplier;
  }

  // --- Timers --------------------------------------------------------------

  startTimer(stepIndex: number, duration: StepDuration): void {
    const r = this.recipe();
    if (!r) return;
    // Permission is requested here because this is a user gesture; asking on
    // page load is both rude and, in most browsers, ignored.
    void this.timers.requestNotificationPermission();
    this.timers.start(
      this.locale.translate('recipe.detail.timerLabel', {
        number: stepIndex + 1,
        name: r.name,
      }),
      duration.seconds,
      // Translated here rather than in the service: the notification body is
      // written by whoever knows which language the cook is reading.
      this.locale.translate('recipe.detail.timerDone'),
    );
  }

  /**
   * Subscribe this device so timers ring with the app closed.
   *
   * Driven by an explicit tap because subscribing prompts for notification
   * permission, and a prompt fired on page load is both rude and, in most
   * browsers, refused outright.
   */
  async enablePhoneAlarms(): Promise<void> {
    if (this.enablingPhoneAlarms() || this.push.ringsOnPhone()) return;
    this.enablingPhoneAlarms.set(true);
    try {
      await this.push.enable();
    } finally {
      this.enablingPhoneAlarms.set(false);
    }
  }

  remaining(seconds: number): string {
    return formatRemaining(seconds);
  }

  // --- Data ----------------------------------------------------------------

  private loadRecipe(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.recipeService.getById(id, this.chosenVariation() ?? undefined).subscribe((recipe) => {
        this.recipe.set(recipe);
      });
    }
  }

  /**
   * Which way to cook it. Null is the recipe as written.
   *
   * Re-fetched rather than filtered here: the server owns what a variation
   * means, so the page cannot drift from the shopping list's idea of it.
   */
  chooseVariation(variationId: string | null): void {
    this.chosenVariation.set(variationId);
    this.loadRecipe();
  }

  /** The note explaining why this variation exists — #77 asked for it by name. */
  readonly variationNote = computed(() => {
    const r = this.recipe();
    const chosen = this.chosenVariation();
    if (!r || !chosen) return '';
    return r.variations?.find((v) => v.id === chosen)?.note ?? '';
  });

  onDelete(): void {
    const currentRecipe = this.recipe();
    if (
      currentRecipe &&
      confirm(this.locale.translate('common.confirm.delete', { name: currentRecipe.name }))
    ) {
      this.recipeService.delete(currentRecipe.id).subscribe(() => {
        this.router.navigate(['/recipes']);
      });
    }
  }

  addToShoppingList(): void {
    const currentRecipe = this.recipe();
    if (!currentRecipe) return;

    this.addingToList.set(true);
    // Scaled servings, not the recipe's own — the list should match what the
    // ingredient panel is currently showing. And the chosen variation, for the
    // same reason: the panel is showing ITS ingredients, so a list built from
    // the recipe as written would disagree with the screen it was pressed on.
    this.shoppingListService
      .generateFromRecipe(
        currentRecipe.id,
        this.scaledServings(),
        this.chosenVariation() ?? undefined,
      )
      .subscribe({
        next: (list) => {
          this.addingToList.set(false);
          this.router.navigate(['/shopping-list'], { queryParams: { id: list.id } });
        },
        error: () => {
          this.addingToList.set(false);
        },
      });
  }

  /**
   * Upload a hero image the cook took themselves.
   *
   * Checked here before the request as well as on the server: rejecting an 11 MB
   * photo without spending a minute uploading it first is the whole point of a
   * client-side check, and the server still has the final say.
   */
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const currentRecipe = this.recipe();
    if (!currentRecipe) return;

    this.uploadErrorKey.set(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      this.uploadErrorKey.set('recipe.detail.uploadWrongType');
      input.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      this.uploadErrorKey.set('recipe.detail.uploadTooLarge');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.recipeService.uploadImage(currentRecipe.id, file).subscribe({
      next: (recipe) => {
        this.recipe.set(recipe);
        this.uploading.set(false);
        // Cleared so choosing the same file again re-fires the change event.
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        this.uploadErrorKey.set('recipe.detail.uploadFailed');
        input.value = '';
      },
    });
  }

  /**
   * Ask for a key first. There is no shared one to fall back on, by design.
   */
  regenerateImages(): void {
    if (!this.recipe() || this.regenerating()) return;
    this.keyDialogOpen.set(true);
  }

  onKeyDialogDismissed(): void {
    this.keyDialogOpen.set(false);
  }

  openPlan(): void {
    this.planned.set(false);
    this.planOpen.set(true);
  }

  closePlan(): void {
    this.planOpen.set(false);
  }

  /**
   * Planned. Confirmed in place rather than navigating to the meal plan: the
   * cook is reading this recipe, and taking the page away from them to prove
   * the click worked is a poor trade.
   */
  onPlanned(): void {
    this.planOpen.set(false);
    this.planned.set(true);
  }

  openTransfer(): void {
    this.transferOpen.set(true);
  }

  closeTransfer(): void {
    this.transferOpen.set(false);
  }

  /**
   * The hand-over landed: show the new byline, and drop the author-only actions.
   *
   * `canEdit` is derived from the recipe's `createdBy`, so replacing the signal
   * is what makes Edit and Delete disappear — leaving buttons that now 403 would
   * be a worse way to learn the transfer worked.
   */
  onTransferred(updated: Recipe): void {
    this.recipe.set(updated);
    this.transferOpen.set(false);
  }

  /** Handed the plaintext key by the dialog; used for this run and not kept. */
  onKeyUnlocked(apiKey: string): void {
    this.keyDialogOpen.set(false);
    const currentRecipe = this.recipe();
    if (!currentRecipe) return;

    this.regenerating.set(true);
    this.recipeService.regenerateImages(currentRecipe.id, apiKey).subscribe({
      next: () => {
        setTimeout(() => {
          this.recipeService.getById(currentRecipe.id).subscribe((recipe) => {
            this.recipe.set(recipe);
            this.regenerating.set(false);
          });
        }, 2000);
      },
      error: () => {
        this.regenerating.set(false);
      },
    });
  }
}
