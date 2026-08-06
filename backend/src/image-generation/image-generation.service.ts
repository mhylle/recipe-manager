import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates recipe photography with Gemini, using the CALLER'S key.
 *
 * There is deliberately no server-held credential. A single shared
 * GEMINI_API_KEY meant every contributor spent the owner's money, which became
 * unbounded the moment anyone could register — so the key was removed outright
 * rather than kept as a fallback. Never reintroduce one, however convenient: a
 * user without a key gets no generated images and uploads their own instead.
 *
 * The consequence is that this service is stateless about credentials. Each call
 * builds its own client from the key it was handed and discards it, so nothing
 * holds a key between requests and no two users can ever share one.
 */
@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private readonly outputDir = path.join(process.cwd(), 'public', 'recipes');
  private readonly stepsDir = path.join(
    process.cwd(),
    'public',
    'recipes',
    'steps',
  );

  /**
   * Made on demand rather than in the constructor.
   *
   * The directories used to be created only when a shared key was configured.
   * With no key to check at boot, the first write would otherwise land in a
   * directory that may not exist.
   */
  private ensureDirs(): void {
    fs.mkdirSync(this.stepsDir, { recursive: true });
  }

  /**
   * Keep a caller's key out of the logs.
   *
   * Google's errors can quote the request, and an API key echoed into a log line
   * outlives the request that leaked it — the one failure this whole feature
   * exists to prevent.
   */
  private scrub(message: string, apiKey: string): string {
    return apiKey.length > 0
      ? message.split(apiKey).join('[REDACTED]')
      : message;
  }

  async generateHeroImage(
    recipe: {
      id: string;
      name: string;
      description: string;
      tags: string[];
      ingredients: Array<{ name: string }>;
    },
    apiKey: string,
  ): Promise<string | null> {
    this.ensureDirs();

    const ingredientNames = recipe.ingredients
      .slice(0, 5)
      .map((i) => i.name)
      .join(', ');
    const cuisine =
      recipe.tags.find((t) =>
        ['mexican', 'italian', 'thai', 'japanese', 'danish', 'french'].includes(
          t,
        ),
      ) || '';

    const prompt =
      `Professional food photography of ${recipe.name}. ${recipe.description}. ` +
      `Key ingredients visible: ${ingredientNames}. ` +
      (cuisine
        ? `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} cuisine style. `
        : '') +
      `Shot from above at 45 degrees, natural warm lighting, beautiful plating on a rustic wooden table, ` +
      `shallow depth of field, appetizing and vibrant colors. High-end restaurant presentation. ` +
      `Photorealistic, no text or watermarks.`;

    const buffer = await this.callGemini(apiKey, prompt);
    if (!buffer) return null;

    const filename = `${recipe.id}.png`;
    fs.writeFileSync(path.join(this.outputDir, filename), buffer);
    this.logger.log(
      `Hero image saved for ${recipe.name} (${(buffer.length / 1024).toFixed(0)} KB)`,
    );
    return `/api/recipe-manager/images/recipes/${filename}`;
  }

  async generateStepImages(
    recipe: {
      id: string;
      name: string;
      tags: string[];
      instructions: string[];
    },
    apiKey: string,
  ): Promise<string[]> {
    this.ensureDirs();

    const cuisine =
      recipe.tags.find((t) =>
        ['mexican', 'italian', 'thai', 'japanese', 'danish', 'french'].includes(
          t,
        ),
      ) || '';

    const images: string[] = [];

    for (let i = 0; i < recipe.instructions.length; i++) {
      const prompt =
        `Cooking process illustration for "${recipe.name}" - Step ${i + 1}: ${recipe.instructions[i]}. ` +
        (cuisine
          ? `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} cuisine. `
          : '') +
        `Show hands actively performing this cooking step in a home kitchen. ` +
        `Warm natural lighting, close-up action shot, clean modern kitchen background. ` +
        `Photorealistic cooking photography, no text or labels.`;

      const buffer = await this.callGemini(apiKey, prompt);
      if (buffer) {
        const filename = `${recipe.id}_step${i + 1}.png`;
        fs.writeFileSync(path.join(this.stepsDir, filename), buffer);
        images.push(`/api/recipe-manager/images/recipes/steps/${filename}`);
        this.logger.log(`Step ${i + 1} image saved for ${recipe.name}`);
      } else {
        images.push('');
        this.logger.warn(`Step ${i + 1} image FAILED for ${recipe.name}`);
      }

      // Rate limiting
      if (i < recipe.instructions.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    return images;
  }

  private async callGemini(
    apiKey: string,
    prompt: string,
    retries = 2,
  ): Promise<Buffer | null> {
    // Built here, not cached: a client cached on the service would outlive the
    // request and be reachable by the next caller, whose key it is not.
    const ai = new GoogleGenAI({ apiKey });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: prompt,
          config: { responseModalities: ['IMAGE'] },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          return null;
        }

        for (const part of parts) {
          if (part.inlineData) {
            return Buffer.from(part.inlineData.data!, 'base64');
          }
        }
        return null;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('503') && attempt < retries) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        this.logger.error(
          `Gemini error: ${this.scrub(msg, apiKey).substring(0, 120)}`,
        );
        return null;
      }
    }
    return null;
  }
}
