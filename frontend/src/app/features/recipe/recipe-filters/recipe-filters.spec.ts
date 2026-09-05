import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecipeFiltersComponent } from './recipe-filters';
import { provideTestVocabulary } from '../recipe-tags.testing';

describe('RecipeFiltersComponent', () => {
  let fixture: ComponentFixture<RecipeFiltersComponent>;
  let component: RecipeFiltersComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeFiltersComponent],
      providers: [provideTestVocabulary()],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render filter inputs', () => {
    const inputs = fixture.nativeElement.querySelectorAll('input, select');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('should have difficulty dropdown', () => {
    const select = fixture.nativeElement.querySelector('#difficulty');
    expect(select).toBeTruthy();
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(4); // All + easy + medium + hard
  });

  it('offers an Asian cuisine chip that the template can actually reach', () => {
    // Adding the tag to the vocabulary is only half of it — the chip has to
    // render and its click has to arrive as a filter.
    const chip = [...fixture.nativeElement.querySelectorAll('.chip')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Asian',
    ) as HTMLButtonElement | undefined;
    expect(chip).toBeTruthy();

    let emitted: string[] | undefined;
    component.filtersChanged.subscribe((filters) => {
      emitted = filters.cuisines;
    });
    chip!.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['asian']);
  });

  it('should reset all fields', () => {
    component.searchControl.setValue('pasta');
    component.difficultyControl.setValue('easy');

    component.resetFilters();

    expect(component.searchControl.value).toBe('');
    expect(component.difficultyControl.value).toBe('');
  });
});
