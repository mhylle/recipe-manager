import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ThumbnailService } from './thumbnail.service.js';

/** Paused between images so a boot-time sweep never starves live requests. */
const PAUSE_MS = 150;

/**
 * Bounded so a runaway sweep cannot spin forever. Comfortably above the size of
 * the collection this was written for, and a second boot picks up any remainder.
 */
const MAX_PER_RUN = 500;

/**
 * Gives existing recipes a thumbnail.
 *
 * Every photograph predating the thumbnail column would otherwise load at full
 * size in the gallery forever, and the whole point was the ones already there.
 *
 * A boot-time sweep rather than a migration, because generating images is not
 * something a schema migration should do: a slow or failing conversion would
 * block the deploy, and `prisma migrate deploy` runs before the app starts. Here
 * the app is already serving — the gallery simply falls back to full images for
 * the few seconds it takes.
 *
 * Idempotent: it only looks at recipes with an image and no thumbnail, so a
 * restart does no work once the sweep has finished.
 */
@Injectable()
export class ThumbnailBackfillService implements OnModuleInit {
  private readonly logger = new Logger(ThumbnailBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly thumbnails: ThumbnailService,
  ) {}

  onModuleInit(): void {
    // Deliberately not awaited: boot must not wait on image conversion, and
    // nothing depends on the result.
    void this.run().catch((error: unknown) =>
      this.logger.error(
        `Thumbnail backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  async run(): Promise<{ made: number; skipped: number }> {
    const pending = await this.prisma.recipe.findMany({
      where: { imageUrl: { not: null }, thumbnailUrl: null },
      select: { id: true, imageUrl: true },
      take: MAX_PER_RUN,
    });
    if (pending.length === 0) {
      return { made: 0, skipped: 0 };
    }

    this.logger.log(
      `Thumbnailing ${String(pending.length)} existing image(s)…`,
    );
    let made = 0;
    let skipped = 0;

    for (const recipe of pending) {
      if (!recipe.imageUrl) continue;
      const thumbnailUrl = await this.thumbnails.generate(recipe.imageUrl);
      if (thumbnailUrl) {
        await this.prisma.recipe.update({
          where: { id: recipe.id },
          data: { thumbnailUrl },
        });
        made += 1;
      } else {
        // Left null on purpose: the gallery falls back to the full image, and a
        // later run will try again if the original turns up.
        skipped += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }

    this.logger.log(
      `Thumbnails: ${String(made)} made, ${String(skipped)} skipped.`,
    );
    return { made, skipped };
  }
}
