import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_RECIPE_VIEW_MODE,
  RECIPE_VIEW_MODES,
  RECIPE_VIEW_MODE_STORAGE_KEY,
  isRecipeViewMode,
  readStoredViewMode,
  writeStoredViewMode,
} from './recipe-view-mode';

describe('recipe view mode', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to the existing card layout', () => {
    // The brief was explicit: adding choice must not change what people see today.
    expect(DEFAULT_RECIPE_VIEW_MODE).toBe('cards');
    expect(readStoredViewMode()).toBe('cards');
  });

  it('offers exactly the three intended layouts', () => {
    expect(RECIPE_VIEW_MODES.map((m) => m.value)).toEqual(['cards', 'list', 'gallery']);
    for (const m of RECIPE_VIEW_MODES) {
      expect(m.labelKey.startsWith('recipe.view.')).toBe(true);
    }
  });

  it('round-trips a choice through storage', () => {
    writeStoredViewMode('gallery');
    expect(localStorage.getItem(RECIPE_VIEW_MODE_STORAGE_KEY)).toBe('gallery');
    expect(readStoredViewMode()).toBe('gallery');
  });

  it('falls back to the default for a corrupt stored value', () => {
    localStorage.setItem(RECIPE_VIEW_MODE_STORAGE_KEY, 'mosaic');
    expect(readStoredViewMode()).toBe('cards');
  });

  it('survives localStorage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readStoredViewMode()).toBe('cards');
    expect(() => writeStoredViewMode('list')).not.toThrow();
  });

  it('rejects anything outside the three modes', () => {
    for (const bad of ['grid', 'CARDS', '', null, undefined, 7, {}]) {
      expect(isRecipeViewMode(bad)).toBe(false);
    }
  });
});
