import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecipeFiltersComponent } from './recipe-filters';

describe('RecipeFiltersComponent', () => {
  let fixture: ComponentFixture<RecipeFiltersComponent>;
  let component: RecipeFiltersComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeFiltersComponent],
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

  it('should reset all fields', () => {
    component.searchControl.setValue('pasta');
    component.difficultyControl.setValue('easy');

    component.resetFilters();

    expect(component.searchControl.value).toBe('');
    expect(component.difficultyControl.value).toBe('');
  });
});
