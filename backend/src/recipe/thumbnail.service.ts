import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/**
 * Widest a gallery card is ever rendered, doubled for high-density screens.
 *
 * Wider than this is bytes nobody sees; narrower and a retina card looks soft.
 */
const THUMB_WIDTH = 600;

/** WebP at this quality is visually indistinguishable at card size. */
const THUMB_QUALITY = 72;

/** Where thumbnails live, relative to the served images root. */
const THUMB_DIR = 'thumbs';

/**
 * The prefix every stored image URL carries, from the static asset mount in
 * main.ts (`useStaticAssets(public, { prefix: '/images' })`) behind the
 * deployment's `/api/recipe-manager` base.
 */
const SERVED_PREFIX = '/api/recipe-manager/images/recipes/';

/**
 * Makes gallery-sized copies of recipe photographs.
 *
 * The hero images are PNGs of around 2 MB each — measured, not guessed — so a
 * gallery of forty recipes asked the browser for roughly 80 MB. The waste is the
 * FORMAT more than the dimensions: the sources are only 1024×1024, but PNG is a
 * poor fit for photographs. The same picture as a 600px WebP is about 62 KB, a
 * thirty-fold reduction.
 *
 * Originals are never touched. The detail page still shows them, and a thumbnail
 * that replaced its source would be an irreversible quality loss for a saving
 * that only matters in a list.
 */
@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly imagesRoot = path.join(process.cwd(), 'public', 'recipes');

  /**
   * Turn a served image URL back into a filename on disk.
   *
   * Returns null for anything that is not one of our own image URLs, and reduces
   * whatever it gets to a bare basename. These strings come from our database
   * rather than a request, but a stored value is still a value, and the cost of
   * being wrong here is reading or writing outside the images directory.
   */
  private filenameFrom(url: string): string | null {
    if (!url.startsWith(SERVED_PREFIX)) return null;
    const candidate = path.basename(url.slice(SERVED_PREFIX.length));
    // Nothing but the characters our own filenames use.
    if (!/^[A-Za-z0-9._-]+$/.test(candidate)) return null;
    if (candidate.startsWith('.')) return null;
    return candidate;
  }

  /** Where a thumbnail for this original would be served from. */
  thumbUrlFor(filename: string): string {
    const base = filename.replace(/\.[^.]+$/, '');
    return `${SERVED_PREFIX}${THUMB_DIR}/${base}.webp`;
  }

  /**
   * Produce a thumbnail for an already-stored image.
   *
   * Returns the URL to serve, or null if it could not be made — a missing
   * original, an unreadable file, anything. Null means "use the full image",
   * which is exactly what happened before thumbnails existed, so a failure here
   * degrades to the old behaviour rather than to a broken card.
   */
  async generate(originalUrl: string): Promise<string | null> {
    const filename = this.filenameFrom(originalUrl);
    if (!filename) {
      this.logger.warn(`Not one of our image URLs, skipping: ${originalUrl}`);
      return null;
    }

    const source = path.join(this.imagesRoot, filename);
    if (!fs.existsSync(source)) {
      // Expected for a recipe whose image was generated on another deployment,
      // or removed by hand. Not worth an error.
      return null;
    }

    const thumbDir = path.join(this.imagesRoot, THUMB_DIR);
    const base = filename.replace(/\.[^.]+$/, '');
    const target = path.join(thumbDir, `${base}.webp`);

    try {
      fs.mkdirSync(thumbDir, { recursive: true });
      await sharp(source)
        // withoutEnlargement: a small original stays its own size rather than
        // being upscaled into a bigger file than it started as.
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(target);

      return this.thumbUrlFor(filename);
    } catch (error) {
      this.logger.warn(
        `Could not thumbnail ${filename}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Whether a thumbnail already exists for this original. */
  exists(originalUrl: string): boolean {
    const filename = this.filenameFrom(originalUrl);
    if (!filename) return false;
    const base = filename.replace(/\.[^.]+$/, '');
    return fs.existsSync(path.join(this.imagesRoot, THUMB_DIR, `${base}.webp`));
  }
}
