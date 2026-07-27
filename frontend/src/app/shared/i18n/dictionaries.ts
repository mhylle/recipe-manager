import type { Dictionary } from './en';
import type { Locale } from './locale';
import { en } from './en';
import { da } from './da';

/**
 * Every locale in the registry must have a dictionary. `Record<Locale, ...>` means
 * adding a language to LOCALES without adding its dictionary here fails the build.
 */
export const DICTIONARIES: Record<Locale, Dictionary> = { en, da };
