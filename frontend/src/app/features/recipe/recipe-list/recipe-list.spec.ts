import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { RecipeListComponent } from './recipe-list';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../../../shared/models/recipe.model';
import { Unit } from '../../../shared/enums/unit.enum';
import { Difficulty } from '../../../shared/enums/difficulty.enum';
import { PantryCategory } from '../../../shared/enums/pantry-category.enum';

describe('RecipeListComponent', () => {
  let fixture: ComponentFixture<RecipeListComponent>;
  let component: RecipeListComponent;
  let mockRecipeService: { getAll: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  const mockRecipes: Recipe[] = [
    {
      id: 'recipe-1',
      name: 'Pancakes',
      description: 'Fluffy breakfast pancakes',
      servings: 4,
      instructions: ['Mix', 'Cook'],
      ingredients: [
        { name: 'Flour', quantity: 200, unit: Unit.G, pantryCategory: PantryCategory.BAKING },
      ],
      prepTime: 10,
      cookTime: 15,
      difficulty: Difficulty.EASY,
      tags: ['breakfast'],
    },
    {
      id: 'recipe-2',
      name: 'Pasta Carbonara',
      description: 'Classic Italian pasta',
      servings: 2,
      instructions: ['Boil pasta', 'Make sauce'],
      ingredients: [
        { name: 'Pasta', quantity: 200, unit: Unit.G, pantryCategory: PantryCategory.GRAINS },
      ],
      prepTime: 5,
      cookTime: 20,
      difficulty: Difficulty.MEDIUM,
      tags: ['italian', 'dinner'],
    },
  ];

  beforeEach(async () => {
    mockRecipeService = {
      getAll: vi.fn().mockReturnValue(of(mockRecipes)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [RecipeListComponent],
      providers: [
        provideRouter([]),
        { provide: RecipeService, useValue: mockRecipeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render cards in alphabetical order by default, not fetch order', () => {
    // The service returns Pancakes before Pasta Carbonara; 'Aioli' is appended
    // LAST by the mock, so if the component rendered fetch order it would come
    // third. Alphabetically it must come first.
    mockRecipeService.getAll.mockReturnValue(
      of([...mockRecipes, { ...mockRecipes[0], id: 'recipe-3', name: 'Aioli' }]),
    );
    component.loadItems();
    fixture.detectChanges();

    const titles = Array.from(
      fixture.nativeElement.querySelectorAll('.recipe-card__title'),
    ).map((el) => (el as HTMLElement).textContent!.trim());
    expect(titles).toEqual(['Aioli', 'Pancakes', 'Pasta Carbonara']);
  });

  it('should re-order when a different sort is chosen', () => {
    const select: HTMLSelectElement =
      fixture.nativeElement.querySelector('.recipe-list__sort select');
    select.value = 'name-desc';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const titles = Array.from(
      fixture.nativeElement.querySelectorAll('.recipe-card__title'),
    ).map((el) => (el as HTMLElement).textContent!.trim());
    expect(titles).toEqual(['Pasta Carbonara', 'Pancakes']);
  });

  it('should render list of recipe cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.recipe-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Pancakes');
    expect(cards[1].textContent).toContain('Pasta Carbonara');
  });

  it('should display difficulty badges', () => {
    const badges = fixture.nativeElement.querySelectorAll('.badge');
    expect(badges.length).toBe(2);

    // The user reads a translated label...
    expect(badges[0].textContent.trim()).toBe('Easy');
    expect(badges[1].textContent.trim()).toBe('Medium');

    // ...while the underlying enum value — which goes to the API and the DB — is
    // untouched. The class name is derived from it, so this is the guard against
    // a "translation" that corrupts stored data.
    expect(badges[0].classList.contains('badge--easy')).toBe(true);
    expect(badges[1].classList.contains('badge--medium')).toBe(true);
  });

  it('should display prep and cook times', () => {
    const firstCard = fixture.nativeElement.querySelector('.recipe-card');
    expect(firstCard.textContent).toContain('Prep: 10min');
    expect(firstCard.textContent).toContain('Cook: 15min');
  });

  it('should show empty state when no recipes', async () => {
    mockRecipeService.getAll.mockReturnValue(of([]));
    component.loadItems();
    fixture.detectChanges();

    const emptyMessage = fixture.nativeElement.querySelector('.recipe-list__empty');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toContain('No recipes yet');
  });

  it('should call delete service when confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    component.onDelete(mockRecipes[0]);

    expect(mockRecipeService.delete).toHaveBeenCalledWith('recipe-1');
  });

  it('should not call delete service when cancelled', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

    component.onDelete(mockRecipes[0]);

    expect(mockRecipeService.delete).not.toHaveBeenCalled();
  });

  it('should display tags', () => {
    const tags = fixture.nativeElement.querySelectorAll('.tag');
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0].textContent.trim()).toBe('breakfast');
  });

  describe('gallery windowing', () => {
    /** Twenty-five recipes, so the twelve-per-window behaviour is visible. */
    const many = (count: number): Recipe[] =>
      Array.from({ length: count }, (_, i) => ({
        ...mockRecipes[0],
        id: `r-${String(i)}`,
        name: `Recipe ${String(i).padStart(2, '0')}`,
      }));

    beforeEach(() => {
      mockRecipeService.getAll.mockReturnValue(of(many(25)));
      // The component loads via loadItems(), as the other cases here do.
      component.loadItems();
      fixture.detectChanges();
    });

    it('renders a window rather than every card', () => {
      // Each card carries a photograph, and the hero images are megabytes each,
      // so rendering the whole collection asked the browser for tens of
      // megabytes at once.
      expect(component.sortedItems()).toHaveLength(25);
      expect(component.galleryItems()).toHaveLength(12);
    });

    it('says how many are still hidden', () => {
      expect(component.hasMoreToShow()).toBe(true);
      expect(component.remainingCount()).toBe(13);
    });

    it('grows the window a page at a time', () => {
      component.showMore();
      expect(component.galleryItems()).toHaveLength(24);
      expect(component.remainingCount()).toBe(1);

      component.showMore();
      expect(component.galleryItems()).toHaveLength(25);
      expect(component.hasMoreToShow()).toBe(false);
    });

    it('never renders more than exist', () => {
      component.showMore();
      component.showMore();
      component.showMore();
      expect(component.galleryItems()).toHaveLength(25);
    });

    it('windows the RENDER, not the data, so filtering still searches everything', () => {
      // The service deliberately fetches every page because sorting and
      // filtering are client-side; only the rendering is limited.
      expect(component.items()).toHaveLength(25);
    });

    it('returns to the first page when the filters change', () => {
      component.showMore();
      expect(component.galleryItems()).toHaveLength(24);

      component.onFiltersChanged({ query: 'pan' } as never);

      // A new search should start at its first result, not partway down.
      expect(component.visibleCount()).toBe(12);
    });
  });

  describe('filtering by tag', () => {
    /** A tag list wide enough to tell "matches" from "over-matches". */
    const tagged = [
      { ...mockRecipes[0], id: 'r-personal', tags: ['personal', 'quick'] },
      { ...mockRecipes[0], id: 'r-pepper', tags: ['pepper'] },
      { ...mockRecipes[0], id: 'r-italian', tags: ['italian', 'dinner'] },
    ];

    const idsFor = (tags: string) => {
      mockRecipeService.getAll.mockReturnValue(of(tagged));
      component.loadItems({ tags } as never);
      fixture.detectChanges();
      return component.items().map((r) => r.id);
    };

    it('finds a tag from part of it', () => {
      // #59: typing "per" should reach "personal" without spelling it out.
      expect(idsFor('per')).toContain('r-personal');
    });

    it('matches anywhere in the tag, not only the start', () => {
      // "per" is inside "pepper" too, and a substring match is what was asked
      // for — so this documents the breadth rather than pretending it is exact.
      expect(idsFor('per')).toEqual(
        expect.arrayContaining(['r-personal', 'r-pepper']),
      );
    });

    it('still excludes recipes with no matching tag', () => {
      // The distractor: a filter that matched everything would satisfy both
      // tests above and quietly stop filtering at all.
      expect(idsFor('per')).not.toContain('r-italian');
    });

    it('keeps an exact tag working', () => {
      expect(idsFor('italian')).toEqual(['r-italian']);
    });

    it('is case-insensitive', () => {
      expect(idsFor('PERSONAL')).toContain('r-personal');
    });

    it('requires every comma-separated term to match something', () => {
      // ALL terms, not any: narrowing is the point of adding a second one.
      expect(idsFor('ital,din')).toEqual(['r-italian']);
      expect(idsFor('ital,quick')).toEqual([]);
    });

    it('ignores a blank filter rather than matching nothing', () => {
      expect(idsFor('  ')).toHaveLength(3);
    });
  });

  describe('filtering by course', () => {
    const courses = [
      { ...mockRecipes[0], id: 'r-main', tags: ['main', 'beef'] },
      { ...mockRecipes[0], id: 'r-untagged', tags: ['italian'] },
      { ...mockRecipes[0], id: 'r-dessert', tags: ['dessert'] },
    ];

    const idsFor = (courses_: string[]) => {
      mockRecipeService.getAll.mockReturnValue(of(courses));
      component.loadItems({ courses: courses_ } as never);
      fixture.detectChanges();
      return component.items().map((r) => r.id);
    };

    it('finds a recipe its author marked as a main course', () => {
      // #84: the Main chip is new to the form; a recipe that uses it must
      // actually turn up under the facet.
      expect(idsFor(['Main'])).toContain('r-main');
    });

    it('still finds the recipes written before the main tag existed', () => {
      expect(idsFor(['Main'])).toContain('r-untagged');
    });

    it('keeps the dessert out of the main dishes', () => {
      expect(idsFor(['Main'])).not.toContain('r-dessert');
    });

    it('matches another course by its tag', () => {
      expect(idsFor(['Dessert'])).toEqual(['r-dessert']);
    });
  });

  describe('filtering to my favourites', () => {
    const summary = (likedByMe: boolean) => ({
      likeCount: likedByMe ? 1 : 0,
      ratingCount: 0,
      ratingAverage: null,
      likedByMe,
      myStars: null,
    });

    const liked = [
      { ...mockRecipes[0], id: 'r-liked', reactions: summary(true) },
      { ...mockRecipes[0], id: 'r-not-liked', reactions: summary(false) },
      // A recipe from before reactions existed carries none at all.
      { ...mockRecipes[0], id: 'r-legacy', reactions: undefined },
    ];

    const idsFor = (likedOnly: boolean) => {
      mockRecipeService.getAll.mockReturnValue(of(liked));
      component.loadItems({ likedOnly } as never);
      fixture.detectChanges();
      return component.items().map((r) => r.id);
    };

    it('keeps only what this reader liked', () => {
      expect(idsFor(true)).toEqual(['r-liked']);
    });

    it('drops a recipe that carries no reactions rather than crashing', () => {
      expect(idsFor(true)).not.toContain('r-legacy');
    });

    it('leaves the list alone when the chip is off', () => {
      expect(idsFor(false)).toHaveLength(3);
    });
  });
});
