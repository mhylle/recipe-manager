import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { TransferRecipeDialogComponent } from './transfer-recipe-dialog';
import { RecipeService } from '../../../features/recipe/recipe.service';
import { PantrySharingService } from '../../../features/pantry/pantry-sharing/pantry-sharing.service';
import { PantryContextService } from '../../services/pantry-context.service';
import { Difficulty } from '../../enums/difficulty.enum';
import type { Recipe } from '../../models/recipe.model';

const RECIPE: Recipe = {
  id: 'r-cheesecake',
  name: 'Lime and White Chocolate Cheesecake',
  description: 'Chilled',
  servings: 8,
  instructions: ['Chill'],
  ingredients: [],
  prepTime: 20,
  cookTime: 0,
  difficulty: Difficulty.EASY,
  tags: [],
};

const MEMBERS = [
  { userId: 'u-martin', displayName: 'Martin Hylleberg', email: 'm@x.com', role: 'owner', isYou: true },
  { userId: 'u-heidi', displayName: 'Heidi Klitgaard', email: 'heidi.klitgaard@gmail.com', role: 'member', isYou: false },
];

describe('TransferRecipeDialogComponent', () => {
  let fixture: ComponentFixture<TransferRecipeDialogComponent>;
  let component: TransferRecipeDialogComponent;
  let recipes: { transferAuthor: ReturnType<typeof vi.fn> };
  let sharing: { members: ReturnType<typeof vi.fn> };

  async function build(currentKitchen: string | null = 'p-home') {
    recipes = { transferAuthor: vi.fn().mockReturnValue(of({ ...RECIPE })) };
    sharing = { members: vi.fn().mockReturnValue(of(MEMBERS)) };

    await TestBed.configureTestingModule({
      imports: [TransferRecipeDialogComponent],
      providers: [
        { provide: RecipeService, useValue: recipes },
        { provide: PantrySharingService, useValue: sharing },
        { provide: PantryContextService, useValue: { currentId: signal(currentKitchen) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferRecipeDialogComponent);
    fixture.componentRef.setInput('recipe', RECIPE);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await build();
  });

  it('offers the other people in the kitchen', () => {
    expect(component.candidates().map((m) => m.userId)).toEqual(['u-heidi']);
  });

  it('never offers you yourself', () => {
    // Transferring to yourself is refused by the server; not showing it is how
    // the UI avoids inviting an action that can only fail.
    expect(component.candidates().some((m) => m.isYou)).toBe(false);
  });

  it('keeps the confirm button disabled until somebody is chosen', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn--primary');
    expect(button.disabled).toBe(true);
  });

  it('transfers to the chosen person', () => {
    component.onSelect('u-heidi');

    component.confirm();

    expect(recipes.transferAuthor).toHaveBeenCalledWith('r-cheesecake', 'u-heidi');
  });

  it('emits the updated recipe so the page can re-render', () => {
    const updated = { ...RECIPE, createdBy: { id: 'u-heidi', displayName: 'Heidi Klitgaard' } };
    recipes.transferAuthor.mockReturnValue(of(updated));
    const seen: Recipe[] = [];
    component.transferred.subscribe((r) => seen.push(r));

    component.onSelect('u-heidi');
    component.confirm();

    expect(seen).toEqual([updated]);
  });

  it('does nothing when confirmed with nobody chosen', () => {
    // The distractor: a handler that fired regardless would send undefined and
    // surface as a confusing server-side refusal.
    component.confirm();

    expect(recipes.transferAuthor).not.toHaveBeenCalled();
  });

  it('reports a refusal rather than appearing to succeed', () => {
    recipes.transferAuthor.mockReturnValue(throwError(() => new Error('403')));
    const seen: Recipe[] = [];
    component.transferred.subscribe((r) => seen.push(r));

    component.onSelect('u-heidi');
    component.confirm();

    expect(component.error()).toBe('recipe.transfer.failed');
    expect(seen).toEqual([]);
  });

  it('says so when there is nobody to hand it to', async () => {
    sharing.members.mockReturnValue(of([MEMBERS[0]]));
    TestBed.resetTestingModule();
    await build();
    sharing.members.mockReturnValue(of([MEMBERS[0]]));
    fixture = TestBed.createComponent(TransferRecipeDialogComponent);
    fixture.componentRef.setInput('recipe', RECIPE);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.candidates()).toEqual([]);
  });

  it('does not ask the server for members when there is no kitchen', async () => {
    TestBed.resetTestingModule();
    await build(null);

    expect(sharing.members).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });
});
