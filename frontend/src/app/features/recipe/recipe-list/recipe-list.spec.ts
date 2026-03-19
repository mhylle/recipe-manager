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

  it('should render list of recipe cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.recipe-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Pancakes');
    expect(cards[1].textContent).toContain('Pasta Carbonara');
  });

  it('should display difficulty badges', () => {
    const badges = fixture.nativeElement.querySelectorAll('.badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent.trim()).toBe('easy');
    expect(badges[1].textContent.trim()).toBe('medium');
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
    component.ngOnInit();
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
});
