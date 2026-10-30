import { Injectable, Logger } from '@nestjs/common';
import {
  classifyGlassState,
  garnishShown,
  geminiContents,
  glassStatesPrompt,
  heroImagePrompt,
  parseGlassStates,
  referenceFilename,
  resolveGlassStates,
  stepImagePrompt,
  type GlassState,
  type ReferenceImage,
} from './image-prompts.js';
import { isDrink } from '../recipe/recipe-tags.js';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

/** Plain text model, for the small judgement calls around image generation. */
const TEXT_MODEL = 'gemini-2.5-flash';

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

    const prompt = heroImagePrompt(recipe);

    const buffer = await this.callGemini(apiKey, prompt);
    if (!buffer) return null;

    const filename = `${recipe.id}.png`;
    fs.writeFileSync(path.join(this.outputDir, filename), buffer);
    this.logger.log(
      `Hero image saved for ${recipe.name} (${(buffer.length / 1024).toFixed(0)} KB)`,
    );
    return `/api/recipe-manager/images/recipes/${filename}`;
  }

  /**
   * The hero photograph as a reference image, or undefined when there is none.
   *
   * Only files this service wrote are read — see `referenceFilename`.
   */
  private loadReference(heroUrl?: string): ReferenceImage | undefined {
    const filename = referenceFilename(heroUrl);
    if (!filename) return undefined;
    try {
      const data = fs
        .readFileSync(path.join(this.outputDir, filename))
        .toString('base64');
      return { mimeType: 'image/png', data };
    } catch {
      return undefined;
    }
  }

  /**
   * What the drink's glass holds at each step.
   *
   * Rules read what they can for free; the model is asked once, and only about
   * the steps the rules left open. If that call fails the rules and the carry-
   * over still give an answer, so image generation never waits on it.
   */
  private async glassStatesFor(
    apiKey: string,
    steps: readonly string[],
  ): Promise<GlassState[]> {
    const fromRules = steps.map(classifyGlassState);
    if (!fromRules.some((state) => state === undefined)) {
      return resolveGlassStates(fromRules);
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: glassStatesPrompt(steps),
      });
      const fromModel = parseGlassStates(response.text, steps.length);
      return resolveGlassStates(fromRules, fromModel);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Glass-state lookup failed: ${this.scrub(msg, apiKey).substring(0, 120)}`,
      );
      return resolveGlassStates(fromRules);
    }
  }

  async generateStepImages(
    recipe: {
      id: string;
      name: string;
      tags: string[];
      ingredients: Array<{ name: string }>;
      instructions: string[];
    },
    apiKey: string,
    heroUrl?: string,
  ): Promise<string[]> {
    this.ensureDirs();

    const reference = this.loadReference(heroUrl);
    const garnished = isDrink(recipe.tags)
      ? garnishShown(recipe.instructions)
      : [];
    const glassStates = isDrink(recipe.tags)
      ? await this.glassStatesFor(apiKey, recipe.instructions)
      : [];

    const images: string[] = [];

    for (let i = 0; i < recipe.instructions.length; i++) {
      const prompt = stepImagePrompt(recipe, {
        index: i,
        total: recipe.instructions.length,
        text: recipe.instructions[i],
        hasReference: reference !== undefined,
        glassState: glassStates[i],
        garnished: garnished[i],
      });

      const buffer = await this.callGemini(apiKey, prompt, reference);
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
    reference?: ReferenceImage,
    retries = 2,
  ): Promise<Buffer | null> {
    // Built here, not cached: a client cached on the service would outlive the
    // request and be reachable by the next caller, whose key it is not.
    const ai = new GoogleGenAI({ apiKey });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: geminiContents(prompt, reference),
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
