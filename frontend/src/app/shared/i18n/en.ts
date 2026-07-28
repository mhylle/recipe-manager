import type { DayOfWeek, Difficulty, MealType, PantryCategory, Unit } from '../enums';

/**
 * Every enum value must have a display label. Spelling that requirement as a
 * template-literal union means adding a value to any of these enums breaks the
 * build until both dictionaries gain a label — instead of shipping a blank cell.
 */
export type EnumLabelKey =
  | `enum.difficulty.${Difficulty}`
  | `enum.unit.${Unit}`
  | `enum.pantryCategory.${PantryCategory}`
  | `enum.mealType.${MealType}`
  | `enum.dayOfWeek.${DayOfWeek}`
  // Abbreviated weekday for the meal-plan column headers. A separate namespace
  // because abbreviations are not derivable by slicing the full name across
  // languages ('wednesday'->'Wed' but 'onsdag'->'Ons').
  | `enum.dayOfWeekShort.${DayOfWeek}`;

/**
 * English is the source-of-truth dictionary: its shape defines `Dictionary`, so
 * every other language is checked against it at compile time.
 *
 * Keys are `<feature>.<component>.<element>`. Strings shared across features live
 * under `common.*` and must not be duplicated per feature.
 *
 * `{{param}}` placeholders are filled by LocaleService.translate(). Always
 * parameterise instead of concatenating translated fragments — word order differs
 * between languages, and concatenation hard-codes English order.
 */
export const en = {
  // The product name is deliberately identical in every language. It lives here
  // rather than inline so the templates stay free of bare literals and so there
  // is exactly one place to change it.
  'layout.brand': 'The Atelier Kitchen',

  'language.switcher.label': 'Language',

  'layout.nav.mainLabel': 'Main navigation',
  'layout.nav.secondaryLabel': 'Secondary navigation',
  'layout.nav.discover': 'Discover',
  'layout.nav.library': 'My Library',
  'layout.nav.pantry': 'Pantry',
  'layout.nav.plan': 'Plan',
  'layout.nav.settings': 'Settings',
  'layout.footer.shoppingList': 'Shopping List',
  'layout.footer.essentials': 'Essentials',
  'layout.footer.tagline': 'Crafted for slow living.',

  'common.actions.add': 'Add',
  'common.actions.cancel': 'Cancel',
  'common.actions.delete': 'Delete',
  'common.actions.deleteNamed': 'Delete {{name}}',
  'common.actions.edit': 'Edit',
  'common.actions.remove': 'Remove',
  'common.actions.removeNamed': 'Remove {{name}}',
  'common.actions.save': 'Save',
  'common.actions.create': 'Create',
  'common.actions.update': 'Update',
  'common.actions.reset': 'Reset',
  'common.actions.all': 'All',
  'common.confirm.delete': 'Are you sure you want to delete "{{name}}"?',
  'common.update.available': 'A new version is available.',
  'common.update.reload': 'Reload',
  'common.requiredMarker': '*',
  'common.unknown': 'Unknown',

  'recipe.list.title': 'Recipes',
  'recipe.list.add': 'Add Recipe',
  'recipe.list.empty.filtered': 'No recipes match the current filters.',
  'recipe.list.empty.none': 'No recipes yet. Add your first recipe to get started.',
  'recipe.list.prep': 'Prep: {{minutes}}min',
  'recipe.list.cook': 'Cook: {{minutes}}min',
  'recipe.list.servings': '{{count}} servings',
  'recipe.view.label': 'View',
  'recipe.view.cards': 'Cards',
  'recipe.view.list': 'List',
  'recipe.view.gallery': 'Gallery',

  'recipe.sort.label': 'Sort by',
  'recipe.sort.nameAsc': 'Name (A\u2013Z)',
  'recipe.sort.nameDesc': 'Name (Z\u2013A)',
  'recipe.sort.timeAsc': 'Quickest first',
  'recipe.sort.timeDesc': 'Longest first',
  'recipe.sort.difficultyAsc': 'Easiest first',

  'recipe.list.prepLabel': 'Prep time',
  'recipe.list.cookLabel': 'Cook time',
  'recipe.list.servingsLabel': 'Servings',

  'recipe.filters.cuisineLabel': 'Cuisine',
  'recipe.filters.cuisineGroup': 'Filter by cuisine',
  'recipe.filters.proteinLabel': 'Protein',
  'recipe.filters.proteinGroup': 'Filter by protein',
  'recipe.filters.courseLabel': 'Course',
  'recipe.filters.courseGroup': 'Filter by course',
  'recipe.filters.search': 'Search',
  'recipe.filters.searchPlaceholder': 'Search recipes...',
  'recipe.filters.difficulty': 'Difficulty',
  'recipe.filters.maxPrep': 'Max Prep (min)',
  'recipe.filters.maxPrepPlaceholder': 'Any',
  'recipe.filters.tags': 'Tags',
  'recipe.filters.tagsPlaceholder': 'e.g. slow-cooked, quick',

  // Display labels for the filter chips. The VALUES these map to are matched
  // against tags stored on the recipe, so the values stay English — see
  // recipe-filters.ts, where each option carries both a value and a label key.
  'recipe.filters.cuisine.mexican': 'Mexican',
  'recipe.filters.cuisine.italian': 'Italian',
  'recipe.filters.cuisine.thai': 'Thai',
  'recipe.filters.cuisine.japanese': 'Japanese',
  'recipe.filters.cuisine.danish': 'Danish',
  'recipe.filters.cuisine.french': 'French',
  'recipe.filters.protein.chicken': 'Chicken',
  'recipe.filters.protein.pork': 'Pork',
  'recipe.filters.protein.beef': 'Beef',
  'recipe.filters.protein.fish': 'Fish',
  'recipe.filters.protein.vegetarian': 'Vegetarian',
  'recipe.filters.course.main': 'Main',
  'recipe.filters.course.dessert': 'Dessert',
  'recipe.filters.course.appetizer': 'Appetizer',
  'recipe.filters.course.soup': 'Soup',
  'recipe.filters.course.snack': 'Snack',
  'recipe.filters.course.baking': 'Baking',

  'recipe.form.titleAdd': 'Add Recipe',
  'recipe.form.titleEdit': 'Edit Recipe',
  'recipe.form.name': 'Name',
  'recipe.form.nameRequired': 'Name is required.',
  'recipe.form.description': 'Description',
  'recipe.form.descriptionRequired': 'Description is required.',
  'recipe.form.servings': 'Servings',
  'recipe.form.prepTime': 'Prep Time (min)',
  'recipe.form.cookTime': 'Cook Time (min)',
  'recipe.form.difficulty': 'Difficulty',
  'recipe.form.difficultyPlaceholder': 'Select difficulty',
  'recipe.form.tags': 'Tags (comma-separated)',
  'recipe.form.tagsPlaceholder': 'e.g. breakfast, quick, italian',
  'recipe.form.ingredients': 'Ingredients',
  'recipe.form.ingredientNamePlaceholder': 'Ingredient name',
  'recipe.form.ingredientNameLabel': 'Ingredient {{index}} name',
  'recipe.form.ingredientQtyPlaceholder': 'Qty',
  'recipe.form.ingredientQtyLabel': 'Ingredient {{index}} quantity',
  'recipe.form.ingredientUnitLabel': 'Ingredient {{index}} unit',
  'recipe.form.ingredientCategoryLabel': 'Ingredient {{index}} category',
  'recipe.form.removeIngredient': 'Remove ingredient {{index}}',
  'recipe.form.addIngredient': '+ Add Ingredient',
  'recipe.form.instructions': 'Instructions (one per line)',
  'recipe.form.instructionsPlaceholder': 'Step 1\nStep 2\nStep 3',
  'recipe.form.languageTabs': 'Language being edited',
  'recipe.form.missingTranslation': 'No translation yet',
  'recipe.form.missingHint': 'Languages marked with a dot have no name yet. Readers will see the source language instead.',

  'recipe.detail.totalTime': '{{minutes}} min total',
  'recipe.detail.prep': 'Prep',
  'recipe.detail.cook': 'Cook',
  'recipe.detail.servings': 'Servings',
  'recipe.detail.ingredients': 'Ingredients',
  'recipe.detail.minutes': 'min',
  'recipe.detail.addToShoppingList': 'Add to Shopping List',
  'recipe.detail.adding': 'Adding...',
  'recipe.detail.allRecipes': 'All Recipes',
  'recipe.detail.instructions': 'Instructions',
  'recipe.detail.stepAlt': 'Step {{number}} illustration',
  'recipe.detail.noImage': 'No image yet. Edit this recipe to add a photo URL.',
  'recipe.detail.actionsLabel': 'Recipe actions',
  'recipe.detail.delete': 'Delete recipe',
  'recipe.detail.regenerate': 'Regenerate images',
  'recipe.detail.signInToEdit': 'Sign in at mhylle.com to edit this recipe.',
  'recipe.detail.scaleLabel': 'Scale recipe',
  'recipe.detail.scaleServings': 'Servings',
  'recipe.detail.scaleNote': 'Ingredient amounts are scaled. Step text still shows the original quantities.',
  'recipe.detail.startTimerFor': 'Start a {{duration}} timer for step {{number}}',
  'recipe.detail.timerLabel': 'Step {{number}} — {{name}}',
  'recipe.detail.timersLabel': 'Kitchen timers',
  'recipe.detail.timerDone': 'Done',
  'recipe.detail.timerCancel': 'Cancel timer',
  'recipe.detail.timerDismiss': 'Dismiss timer',
  'recipe.detail.generating': 'Generating...',
  'recipe.detail.keepAwake': 'Keep screen on',
  'recipe.detail.keepAwakeOn': 'Screen stays on',
  'recipe.detail.keepAwakeHint': 'Stops the screen dimming while you cook.',
  'recipe.detail.loading': 'Loading recipe...',

  'pantry.list.title': 'The Pantry',
  'pantry.list.subtitle': 'A curated inventory of your essential ingredients.',
  'pantry.list.add': 'Add Item',
  'pantry.list.empty.filtered': 'No items match the current filters.',
  'pantry.list.empty.none': 'No pantry items yet. Add your first item to get started.',
  'pantry.expiry.expired': 'Expired',
  'pantry.expiry.expiringSoon': 'Expiring Soon',

  'pantry.detail.quantity': 'Quantity',
  'pantry.detail.category': 'Category',
  'pantry.detail.barcode': 'Barcode',
  'pantry.detail.expiryDate': 'Expiry Date',
  'pantry.detail.added': 'Added',
  'pantry.detail.lastUpdated': 'Last Updated',
  'pantry.detail.backToList': 'Back to List',
  'pantry.detail.loading': 'Loading...',

  'pantry.filters.search': 'Search',
  'pantry.filters.searchPlaceholder': 'Search pantry...',
  'pantry.filters.category': 'Category',

  'pantry.form.titleAdd': 'Add Pantry Item',
  'pantry.form.titleEdit': 'Edit Pantry Item',
  'pantry.form.name': 'Name',
  'pantry.form.nameRequired': 'Name is required.',
  'pantry.form.quantity': 'Quantity',
  'pantry.form.quantityRequired': 'Quantity is required.',
  'pantry.form.quantityMin': 'Quantity must be at least 0.',
  'pantry.form.unit': 'Unit',
  'pantry.form.unitPlaceholder': 'Select a unit',
  'pantry.form.unitRequired': 'Unit is required.',
  'pantry.form.category': 'Category',
  'pantry.form.categoryPlaceholder': 'Select a category',
  'pantry.form.categoryRequired': 'Category is required.',
  'pantry.form.barcode': 'Barcode',
  'pantry.form.expiryDate': 'Expiry Date',

  'enum.difficulty.easy': 'Easy',
  'enum.difficulty.medium': 'Medium',
  'enum.difficulty.hard': 'Hard',

  'enum.unit.g': 'g',
  'enum.unit.kg': 'kg',
  'enum.unit.ml': 'ml',
  'enum.unit.l': 'l',
  'enum.unit.tsp': 'tsp',
  'enum.unit.tbsp': 'tbsp',
  'enum.unit.piece': 'piece',
  'enum.unit.pinch': 'pinch',

  'enum.pantryCategory.dairy': 'Dairy',
  'enum.pantryCategory.meat': 'Meat',
  'enum.pantryCategory.produce': 'Produce',
  'enum.pantryCategory.grains': 'Grains',
  'enum.pantryCategory.spices': 'Spices',
  'enum.pantryCategory.condiments': 'Condiments',
  'enum.pantryCategory.baking': 'Baking',
  'enum.pantryCategory.frozen': 'Frozen',
  'enum.pantryCategory.canned': 'Canned',
  'enum.pantryCategory.beverages': 'Beverages',
  'enum.pantryCategory.snacks': 'Snacks',
  'enum.pantryCategory.other': 'Other',

  'enum.mealType.breakfast': 'Breakfast',
  'enum.mealType.lunch': 'Lunch',
  'enum.mealType.dinner': 'Dinner',
  'enum.mealType.snack': 'Snack',

  'enum.dayOfWeek.monday': 'Monday',
  'enum.dayOfWeek.tuesday': 'Tuesday',
  'enum.dayOfWeek.wednesday': 'Wednesday',
  'enum.dayOfWeek.thursday': 'Thursday',
  'enum.dayOfWeek.friday': 'Friday',
  'enum.dayOfWeek.saturday': 'Saturday',
  'enum.dayOfWeek.sunday': 'Sunday',

  'enum.dayOfWeekShort.monday': 'Mon',
  'enum.dayOfWeekShort.tuesday': 'Tue',
  'enum.dayOfWeekShort.wednesday': 'Wed',
  'enum.dayOfWeekShort.thursday': 'Thu',
  'enum.dayOfWeekShort.friday': 'Fri',
  'enum.dayOfWeekShort.saturday': 'Sat',
  'enum.dayOfWeekShort.sunday': 'Sun',

  'mealPlan.title': 'Meal Plan',
  'mealPlan.subtitle': 'A curated selection of seasonal recipes designed for mindful preparation.',
  'mealPlan.weekOf': 'Week of {{date}}',
  'mealPlan.gridLabel': 'Weekly meal plan',
  'mealPlan.servingsShort': '{{count}} srv',
  'mealPlan.done': 'Done',
  'mealPlan.markCooked': 'Mark as cooked: {{recipe}}',
  'mealPlan.addFor': 'Add recipe for {{day}} {{meal}}',
  'mealPlan.picker.dialogLabel': 'Select a recipe',
  'mealPlan.picker.title': 'Select a Recipe',
  'mealPlan.picker.empty': 'No recipes available. Create some recipes first.',
  'mealPlan.picker.meta': '{{minutes}}min | {{servings}} servings',

  'dashboard.inspiration.eyebrow': 'Inspiration for you',
  'dashboard.inspiration.title': 'Three dishes to cook today.',
  'dashboard.inspiration.empty': 'Add a few recipes and your suggestions will appear here.',
  'dashboard.readiness.complete': 'Everything in stock',
  'dashboard.readiness.partial': '{{have}} of {{total}} ingredients',
  'dashboard.readiness.unknown': 'Needs a shop',

  'dashboard.heading': 'Welcome home,',
  'dashboard.headingEmphasis': 'Chef.',
  'dashboard.subtitle': 'See what you can craft from your pantry today.',
  'dashboard.viewAll': 'View all',
  'dashboard.canMake.label': 'READY TO CRAFT',
  'dashboard.canMake.title': 'Available ingredients matched.',
  'dashboard.canMake.empty': 'No recipes can be made with current pantry items.',
  'dashboard.almost.label': 'ALMOST THERE',
  'dashboard.almost.title': 'Just one or two pieces missing.',
  'dashboard.almost.expiryBadge': 'Use it soon!',
  'dashboard.missing.label': 'NEEDS A SHOP',
  'dashboard.missing.title': 'Worth a trip to the shops.',
  'dashboard.empty': 'No recipes in this category.',
  'dashboard.totalTime': '{{minutes}} min total',

  'shoppingList.title': 'Shopping List',
  'shoppingList.subtitle': 'Everything you need, nothing you do not.',
  'shoppingList.sendToBilkatogo': 'Send to BilkaToGo',
  'shoppingList.sendToBilkatogoLabel': 'Send unchecked items to BilkaToGo basket',
  'shoppingList.sending': 'Sending...',
  'shoppingList.generate': 'Generate from Meal Plan',
  'shoppingList.generating': 'Generating...',
  'shoppingList.generatedOn': 'Generated: {{date}}',
  'shoppingList.itemLabel': '{{name}} - {{quantity}} {{unit}}',
  'shoppingList.empty.nothingToBuy': 'All ingredients are already in your pantry. Nothing to buy!',
  'shoppingList.empty.none': 'No shopping list generated yet. Click "Generate from Meal Plan" to create one.',
  'shoppingList.sendFailed': 'Failed to send items to BilkaToGo. Please try again.',

  // "BilkaToGo" and "Salling Group" are the retailer's brand names and stay as-is.
  'bilkatogo.login.dialogLabel': 'Log in to BilkaToGo',
  'bilkatogo.login.title': 'Log in to BilkaToGo',
  'bilkatogo.login.subtitle':
    'Enter your Salling Group credentials to send items to your BilkaToGo basket.',
  'bilkatogo.login.email': 'Email',
  'bilkatogo.login.emailPlaceholder': 'you@example.com',
  'bilkatogo.login.password': 'Password',
  'bilkatogo.login.submit': 'Log in',
  'bilkatogo.login.submitting': 'Logging in...',
  'bilkatogo.login.errorInvalid': 'Invalid credentials. Please try again.',
  'bilkatogo.login.errorConnection': 'Connection error. Please try again.',
  'bilkatogo.results.dialogLabel': 'BilkaToGo results',
  'bilkatogo.results.title': 'BilkaToGo Results',
  'bilkatogo.results.summary': '{{matched}} of {{total}} items added to your basket',
  'bilkatogo.results.matchedLabel': 'Matched items',
  'bilkatogo.results.matchedHeading': 'Added to basket',
  'bilkatogo.results.unmatchedLabel': 'Unmatched items',
  'bilkatogo.results.unmatchedHeading': 'Could not add',
  'bilkatogo.results.openBasket': 'Open BilkaToGo Basket',
  'bilkatogo.results.openBasketLabel': 'Open BilkaToGo basket in new tab',
  'bilkatogo.results.close': 'Close',
  'bilkatogo.results.reason.noMatch': 'No matching products found',
  'bilkatogo.results.reason.error': 'Could not be looked up',

  'staples.title': 'Kitchen Essentials',
  'staples.subtitle': 'Define the essential ingredients that always have a home in your pantry.',
  'staples.addTitle': 'Add New Essential',
  'staples.newStapleLabel': 'New staple name',
  'staples.newStaplePlaceholder': 'e.g. Olive Oil, Sea Salt...',
  'staples.listTitle': 'Your Essentials',
  'staples.itemCount': '{{count}} items',
  'staples.empty': 'No staples configured. Add items you always have on hand.',
} satisfies Record<EnumLabelKey, string> & Record<string, string>;

export type TranslationKey = keyof typeof en;

/** Every language must supply exactly the keys English defines — no more, no fewer. */
export type Dictionary = Record<TranslationKey, string>;
