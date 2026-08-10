import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { RecipeReactionsComponent } from './recipe-reactions';
import { RecipeService } from '../../../features/recipe/recipe.service';
import { AuthService } from '../../services/auth.service';
import type { RecipeReactionSummary } from '../../models/recipe.model';

const summary = (over: Partial<RecipeReactionSummary> = {}): RecipeReactionSummary => ({
  likeCount: 0,
  ratingCount: 0,
  ratingAverage: null,
  likedByMe: false,
  myStars: null,
  ...over,
});

describe('RecipeReactionsComponent', () => {
  let fixture: ComponentFixture<RecipeReactionsComponent>;
  let component: RecipeReactionsComponent;
  let recipeService: { setLike: ReturnType<typeof vi.fn>; setRating: ReturnType<typeof vi.fn> };
  let auth: { isAuthenticated: ReturnType<typeof vi.fn> };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const likeButton = () => el().querySelector<HTMLButtonElement>('button.like');

  const build = (signedIn = true) => {
    auth.isAuthenticated.mockReturnValue(signedIn);
    fixture = TestBed.createComponent(RecipeReactionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('recipeId', 'r1');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    recipeService = {
      setLike: vi.fn().mockReturnValue(of(summary({ likeCount: 1, likedByMe: true }))),
      setRating: vi.fn().mockReturnValue(of(summary({ ratingCount: 1, ratingAverage: 4, myStars: 4 }))),
    };
    auth = { isAuthenticated: vi.fn().mockReturnValue(true) };

    await TestBed.configureTestingModule({
      imports: [RecipeReactionsComponent],
      providers: [
        { provide: RecipeService, useValue: recipeService },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
  });

  describe('liking', () => {
    it('sends the target state, not a toggle', () => {
      build();
      likeButton()!.click();

      // Stating the target makes a retry idempotent; a toggle would flip back.
      expect(recipeService.setLike).toHaveBeenCalledWith('r1', true);
    });

    it('takes the like back on a second press', () => {
      build();
      fixture.componentRef.setInput('reactions', summary({ likedByMe: true, likeCount: 1 }));
      fixture.detectChanges();

      likeButton()!.click();

      expect(recipeService.setLike).toHaveBeenCalledWith('r1', false);
    });

    it('moves before the server answers', () => {
      // Never resolves: this is the in-flight state.
      recipeService.setLike.mockReturnValue(of());
      build();

      likeButton()!.click();
      fixture.detectChanges();

      expect(component.likedByMe()).toBe(true);
      // The count follows the reader's own vote, so the number cannot disagree
      // with the heart beside it.
      expect(component.likeCount()).toBe(1);
    });

    it('rolls back when the request fails', () => {
      recipeService.setLike.mockReturnValue(throwError(() => new Error('offline')));
      build();
      fixture.componentRef.setInput('reactions', summary({ likeCount: 3 }));
      fixture.detectChanges();

      likeButton()!.click();
      fixture.detectChanges();

      expect(component.likedByMe()).toBe(false);
      expect(component.likeCount()).toBe(3);
    });

    it('settles on what the server says, not on the guess', () => {
      // Someone else liked it in the meantime: the server's tally wins.
      recipeService.setLike.mockReturnValue(of(summary({ likeCount: 12, likedByMe: true })));
      build();

      likeButton()!.click();
      fixture.detectChanges();

      expect(component.likeCount()).toBe(12);
    });

    it('tells the page holding the recipe', () => {
      build();
      let emitted: RecipeReactionSummary | null = null;
      component.changed.subscribe((s) => (emitted = s));

      likeButton()!.click();

      expect(emitted).toEqual(summary({ likeCount: 1, likedByMe: true }));
    });
  });

  describe('rating', () => {
    it('sends the chosen score', () => {
      build();
      component.rate(4);

      expect(recipeService.setRating).toHaveBeenCalledWith('r1', 4);
    });

    it('shows the new score straight away', () => {
      recipeService.setRating.mockReturnValue(of());
      build();

      component.rate(4);

      expect(component.myStars()).toBe(4);
    });

    it('clears the score with 0', () => {
      recipeService.setRating.mockReturnValue(of());
      build();
      fixture.componentRef.setInput('reactions', summary({ myStars: 3 }));
      fixture.detectChanges();

      component.rate(0);

      expect(recipeService.setRating).toHaveBeenCalledWith('r1', 0);
      expect(component.myStars()).toBeNull();
    });

    it('leaves the average alone until the server answers', () => {
      recipeService.setRating.mockReturnValue(of());
      build();
      fixture.componentRef.setInput('reactions', summary({ ratingAverage: 2, ratingCount: 4 }));
      fixture.detectChanges();

      component.rate(5);

      // The component has no idea what everyone else scored, so a guessed
      // average would only jump when the real one arrived.
      expect(component.current().ratingAverage).toBe(2);
    });

    it('rolls back when the request fails', () => {
      recipeService.setRating.mockReturnValue(throwError(() => new Error('offline')));
      build();
      fixture.componentRef.setInput('reactions', summary({ myStars: 3 }));
      fixture.detectChanges();

      component.rate(5);
      fixture.detectChanges();

      expect(component.myStars()).toBe(3);
    });
  });

  describe('a signed-out reader', () => {
    it('gets no controls to press', () => {
      build(false);

      expect(likeButton()).toBeNull();
      expect(el().querySelector('input[type="radio"]')).toBeNull();
    });

    it('still sees what everyone thought', () => {
      build(false);
      fixture.componentRef.setInput(
        'reactions',
        summary({ likeCount: 4, ratingCount: 2, ratingAverage: 4.5 }),
      );
      fixture.detectChanges();

      expect(el().textContent).toContain('4');
      expect(component.canReact()).toBe(false);
    });
  });

  it('reads as unreacted-to when the API sent nothing', () => {
    build();

    expect(component.likeCount()).toBe(0);
    expect(component.myStars()).toBeNull();
    expect(component.averageLabel()).toBeNull();
  });
});
