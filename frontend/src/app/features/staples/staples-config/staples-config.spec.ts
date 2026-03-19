import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { StaplesConfigComponent } from './staples-config';
import { StaplesService } from '../staples.service';

describe('StaplesConfigComponent', () => {
  let fixture: ComponentFixture<StaplesConfigComponent>;
  let component: StaplesConfigComponent;
  let mockStaplesService: {
    getStaples: ReturnType<typeof vi.fn>;
    updateStaples: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockStaplesService = {
      getStaples: vi.fn().mockReturnValue(of({ items: ['salt', 'pepper'] })),
      updateStaples: vi.fn().mockReturnValue(of({ items: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [StaplesConfigComponent],
      providers: [
        { provide: StaplesService, useValue: mockStaplesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaplesConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load and display staples', () => {
    const items = fixture.nativeElement.querySelectorAll('.staples-config__item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('salt');
    expect(items[1].textContent).toContain('pepper');
  });

  it('should add a staple', () => {
    mockStaplesService.updateStaples.mockReturnValue(of({ items: ['salt', 'pepper', 'oil'] }));

    component.newStapleControl.setValue('oil');
    component.addStaple();

    expect(mockStaplesService.updateStaples).toHaveBeenCalledWith({
      items: ['salt', 'pepper', 'oil'],
    });
    expect(component.items()).toContain('oil');
  });

  it('should not add duplicate staple', () => {
    component.newStapleControl.setValue('salt');
    component.addStaple();

    expect(mockStaplesService.updateStaples).not.toHaveBeenCalled();
  });

  it('should remove a staple', () => {
    mockStaplesService.updateStaples.mockReturnValue(of({ items: ['pepper'] }));

    component.removeStaple('salt');

    expect(mockStaplesService.updateStaples).toHaveBeenCalledWith({
      items: ['pepper'],
    });
  });

  it('should show empty state when no staples', () => {
    mockStaplesService.getStaples.mockReturnValue(of({ items: [] }));
    component.ngOnInit();
    fixture.detectChanges();

    const emptyMessage = fixture.nativeElement.querySelector('.staples-config__empty');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toContain('No staples configured');
  });
});
