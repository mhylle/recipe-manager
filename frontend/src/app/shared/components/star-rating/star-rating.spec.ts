import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StarRatingComponent } from './star-rating';

describe('StarRatingComponent', () => {
  let fixture: ComponentFixture<StarRatingComponent>;
  let component: StarRatingComponent;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const radios = (): HTMLInputElement[] =>
    Array.from(el().querySelectorAll('input[type="radio"]'));
  const filledStars = (): number => el().querySelectorAll('.star--on').length;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StarRatingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StarRatingComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('groupId', 'r1');
    fixture.detectChanges();
  });

  it('offers five stars as real radios, so the keyboard works', () => {
    // Buttons with role="radio" would need arrow-key handling written by hand;
    // this is the assertion that keeps the free version.
    expect(radios()).toHaveLength(5);
  });

  it('fills up to the score', () => {
    fixture.componentRef.setInput('value', 3);
    fixture.detectChanges();

    expect(filledStars()).toBe(3);
  });

  it('fills nothing when there is no score', () => {
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();

    expect(filledStars()).toBe(0);
  });

  it('rounds an average to whole stars', () => {
    fixture.componentRef.setInput('value', 4.2);
    fixture.detectChanges();

    expect(filledStars()).toBe(4);
  });

  it('emits the star that was picked', () => {
    let picked: number | null = null;
    component.rated.subscribe((v) => (picked = v));

    radios()[2].click();
    fixture.detectChanges();

    expect(picked).toBe(3);
  });

  it('emits 0 when the score is cleared', () => {
    fixture.componentRef.setInput('value', 3);
    fixture.detectChanges();

    let picked: number | null = null;
    component.rated.subscribe((v) => (picked = v));
    el().querySelector<HTMLButtonElement>('.stars__clear')!.click();

    expect(picked).toBe(0);
  });

  it('offers no way to clear a score that was never given', () => {
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();

    expect(el().querySelector('.stars__clear')).toBeNull();
  });

  it('renders no inputs at all when it is only reporting', () => {
    // A disabled radio is still a focus stop announcing "unavailable", which is
    // the wrong message on a card that is simply showing what others thought.
    fixture.componentRef.setInput('readonly', true);
    fixture.componentRef.setInput('value', 4);
    fixture.detectChanges();

    expect(radios()).toHaveLength(0);
    expect(filledStars()).toBe(4);
  });

  it('hides the decorative glyphs from a screen reader', () => {
    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();

    // Five star characters read out one at a time are noise; the number beside
    // them carries the meaning.
    expect(el().querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('names its radio group after the recipe, so two cards do not fight', () => {
    // Radios sharing a name are ONE group: without this, rating a recipe in a
    // gallery would visibly un-rate every other card on screen.
    fixture.componentRef.setInput('groupId', 'recipe-42');
    fixture.detectChanges();

    expect(radios()[0].name).toBe('stars-recipe-42');
  });
});
