import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WakeLockService } from './wake-lock.service';

/** Minimal stand-in for a WakeLockSentinel, so we can assert release behaviour. */
function fakeSentinel() {
  const listeners: Array<() => void> = [];
  return {
    released: false,
    release: vi.fn(async function (this: { released: boolean }) {
      this.released = true;
    }),
    addEventListener: (_: 'release', fn: () => void) => listeners.push(fn),
    fireRelease: () => listeners.forEach((fn) => fn()),
  };
}

function installWakeLock(request: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window.navigator, 'wakeLock', {
    value: { request },
    configurable: true,
  });
}

function removeWakeLock() {
  Reflect.deleteProperty(window.navigator as object, 'wakeLock');
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('WakeLockService', () => {
  afterEach(() => {
    removeWakeLock();
    vi.restoreAllMocks();
    setVisibility('visible');
  });

  describe('when the API is available', () => {
    let request: ReturnType<typeof vi.fn>;
    let sentinel: ReturnType<typeof fakeSentinel>;
    let service: WakeLockService;

    beforeEach(() => {
      sentinel = fakeSentinel();
      request = vi.fn().mockResolvedValue(sentinel);
      installWakeLock(request);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      service = TestBed.inject(WakeLockService);
    });

    it('reports the feature as supported', () => {
      expect(service.supported()).toBe(true);
    });

    it('starts inactive — never grabs the screen on load', () => {
      // request() must come from a user gesture; acquiring on construction would
      // both violate that and hold the screen on pages nobody is cooking from.
      expect(request).not.toHaveBeenCalled();
      expect(service.enabled()).toBe(false);
      expect(service.active()).toBe(false);
    });

    it('acquires a lock when enabled', async () => {
      await service.enable();
      expect(request).toHaveBeenCalledWith('screen');
      expect(service.enabled()).toBe(true);
      expect(service.active()).toBe(true);
    });

    it('releases the lock when disabled', async () => {
      await service.enable();
      await service.disable();
      expect(sentinel.release).toHaveBeenCalled();
      expect(service.enabled()).toBe(false);
      expect(service.active()).toBe(false);
    });

    it('RE-ACQUIRES after the tab is hidden and shown again', async () => {
      // The browser drops the lock whenever the tab hides. Without this the
      // toggle appears to work once and then silently stops after an app switch.
      await service.enable();
      expect(request).toHaveBeenCalledTimes(1);

      sentinel.released = true; // what the platform does on hide
      setVisibility('hidden');
      expect(service.active()).toBe(false);

      setVisibility('visible');
      await Promise.resolve();
      await Promise.resolve();
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('does NOT re-acquire after the user turned it off', async () => {
      await service.enable();
      await service.disable();
      request.mockClear();

      setVisibility('hidden');
      setVisibility('visible');
      await Promise.resolve();
      expect(request).not.toHaveBeenCalled();
    });

    it('reflects a lock the platform drops on its own', async () => {
      // Low battery, for one. Claiming the screen is still held would be a lie.
      await service.enable();
      sentinel.fireRelease();
      expect(service.active()).toBe(false);
    });

    it('survives the request being denied', async () => {
      request.mockRejectedValue(new Error('NotAllowedError'));
      await service.enable();
      expect(service.active()).toBe(false);
      expect(service.enabled()).toBe(true); // intent kept, so returning retries
    });
  });

  describe('when the API is missing', () => {
    let service: WakeLockService;

    beforeEach(() => {
      removeWakeLock();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      service = TestBed.inject(WakeLockService);
    });

    it('reports the feature as unsupported so the UI can hide the toggle', () => {
      expect(service.supported()).toBe(false);
    });

    it('does nothing and throws nothing when enabled anyway', async () => {
      await expect(service.enable()).resolves.toBeUndefined();
      expect(service.active()).toBe(false);
    });
  });
});
