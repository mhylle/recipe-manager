import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/** What an uploaded hero image may be. */
const ACCEPTED = [
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'webp', mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

/** 8 MB. Comfortably above a phone photo, far below a denial-of-service. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Stores a hero image a cook uploaded themselves.
 *
 * This is the other half of removing the shared Gemini key: not everyone has a
 * Gemini account, and a recipe with no picture at all would make the library
 * worse than it was. Uploading is the path that needs no API key from anybody.
 *
 * Files land beside the generated ones and are served by the same static route,
 * so the rest of the app cannot tell the difference and nothing downstream needs
 * to know which recipe's image came from where.
 */
@Injectable()
export class RecipeImageService {
  private readonly logger = new Logger(RecipeImageService.name);
  private readonly outputDir = path.join(process.cwd(), 'public', 'recipes');

  /**
   * Identify the format from the bytes themselves.
   *
   * The declared MIME type and the filename are both attacker-controlled — a
   * `.png` extension on an HTML file is the classic way to get a stored-XSS
   * payload served from your own origin. Sniffing the magic bytes is what makes
   * "this is an image" a fact rather than a claim.
   */
  private detect(buffer: Buffer): (typeof ACCEPTED)[number] {
    for (const format of ACCEPTED) {
      const matches = format.magic.every(
        (byte, index) => buffer[index] === byte,
      );
      if (!matches) continue;
      // RIFF also fronts .wav and .avi, so confirm the WEBP subtype.
      if (
        format.ext === 'webp' &&
        buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
      ) {
        continue;
      }
      return format;
    }
    throw new BadRequestException(
      'That file is not a PNG, JPEG or WebP image.',
    );
  }

  /**
   * Write the image and return the URL the recipe should point at.
   *
   * The filename carries the recipe id plus a timestamp: reusing a bare
   * `<id>.png` would leave browsers and the service worker showing the previous
   * picture from cache, which reads as "the upload silently failed".
   */
  store(recipeId: string, file: { buffer: Buffer; size: number }): string {
    if (file.size === 0) {
      throw new BadRequestException('That file is empty.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `Images must be ${String(MAX_IMAGE_BYTES / (1024 * 1024))} MB or smaller.`,
      );
    }

    const format = this.detect(file.buffer);
    fs.mkdirSync(this.outputDir, { recursive: true });

    const filename = `${recipeId}_upload${String(Date.now())}.${format.ext}`;
    fs.writeFileSync(path.join(this.outputDir, filename), file.buffer);
    this.logger.log(
      `Uploaded hero image for ${recipeId} (${(file.size / 1024).toFixed(0)} KB, ${format.mime})`,
    );

    return `/api/recipe-manager/images/recipes/${filename}`;
  }
}
