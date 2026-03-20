import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { BilkaToGoLoginDialogComponent } from './bilkatogo-login-dialog';
import { BilkaToGoService } from './bilkatogo.service';

describe('BilkaToGoLoginDialogComponent', () => {
  let fixture: ComponentFixture<BilkaToGoLoginDialogComponent>;
  let component: BilkaToGoLoginDialogComponent;
  let mockService: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockService = {
      login: vi.fn().mockReturnValue(of({ sessionId: 'sess-abc' })),
    };

    await TestBed.configureTestingModule({
      imports: [BilkaToGoLoginDialogComponent],
      providers: [
        { provide: BilkaToGoService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BilkaToGoLoginDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render login form with email and password fields', () => {
    const email = fixture.nativeElement.querySelector('#bilka-email');
    const password = fixture.nativeElement.querySelector('#bilka-password');
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();
    expect(password.type).toBe('password');
  });

  it('should render dialog title', () => {
    const title = fixture.nativeElement.querySelector('h3');
    expect(title.textContent).toContain('Log in to BilkaToGo');
  });

  it('should have aria attributes on dialog', () => {
    const backdrop = fixture.nativeElement.querySelector('.dialog-backdrop');
    expect(backdrop.getAttribute('role')).toBe('dialog');
    expect(backdrop.getAttribute('aria-label')).toBe('Log in to BilkaToGo');
    expect(backdrop.getAttribute('aria-modal')).toBe('true');
  });

  it('should call login service on form submit', () => {
    component.form.setValue({ email: 'user@example.com', password: 'pass123' });
    component.onSubmit();
    expect(mockService.login).toHaveBeenCalledWith('user@example.com', 'pass123');
  });

  it('should emit loginSuccess with sessionId on successful login', () => {
    const spy = vi.fn();
    component.loginSuccess.subscribe(spy);

    component.form.setValue({ email: 'user@example.com', password: 'pass123' });
    component.onSubmit();

    expect(spy).toHaveBeenCalledWith('sess-abc');
  });

  it('should show error message on 401 response', () => {
    mockService.login.mockReturnValue(throwError(() => ({ status: 401 })));

    component.form.setValue({ email: 'bad@example.com', password: 'wrong' });
    component.onSubmit();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('.dialog__error');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('Invalid credentials. Please try again.');
  });

  it('should show connection error on non-401 response', () => {
    mockService.login.mockReturnValue(throwError(() => ({ status: 500 })));

    component.form.setValue({ email: 'user@example.com', password: 'pass123' });
    component.onSubmit();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('.dialog__error');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('Connection error. Please try again.');
  });

  it('should not call login when email is empty', () => {
    component.form.setValue({ email: '', password: 'pass123' });
    component.onSubmit();
    expect(mockService.login).not.toHaveBeenCalled();
  });

  it('should emit closed when cancel button is clicked', () => {
    const spy = vi.fn();
    component.closed.subscribe(spy);

    const cancelBtn = fixture.nativeElement.querySelector('.btn--ghost');
    cancelBtn.click();

    expect(spy).toHaveBeenCalled();
  });
});
