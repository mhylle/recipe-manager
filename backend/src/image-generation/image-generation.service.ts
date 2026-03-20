import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private readonly ai: GoogleGenAI | null;
  private readonly outputDir = path.join(process.cwd(), 'public', 'recipes');
  private readonly stepsDir = path.join(
    process.cwd(),
    'public',
    'recipes',
    'steps',
  );

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
      fs.mkdirSync(this.stepsDir, { recursive: true });
      this.logger.log('Gemini image generation enabled');
    } else {
      this.ai = null;
      this.logger.warn('GEMINI_API_KEY not set — image generation disabled');
    }
  }

  isEnabled(): boolean {
    return this.ai !== null;
  }

  async generateHeroImage(recipe: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    ingredients: Array<{ name: string }>;
  }): Promise<string | null> {
    if (!this.ai) return null;

    const ingredientNames = recipe.ingredients
      .slice(0, 5)
      .map((i) => i.name)
      .join(', ');
    const cuisine =
      recipe.tags.find((t) =>
        [
          'mexican',
          'italian',
          'thai',
          'japanese',
          'danish',
          'french',
        ].includes(t),
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

    const buffer = await this.callGemini(prompt);
    if (!buffer) return null;

    const filename = `${recipe.id}.png`;
    fs.writeFileSync(path.join(this.outputDir, filename), buffer);
    this.logger.log(
      `Hero image saved for ${recipe.name} (${(buffer.length / 1024).toFixed(0)} KB)`,
    );
    return `/api/recipe-manager/images/recipes/${filename}`;
  }

  async generateStepImages(recipe: {
    id: string;
    name: string;
    tags: string[];
    instructions: string[];
  }): Promise<string[]> {
    if (!this.ai) return [];

    const cuisine =
      recipe.tags.find((t) =>
        [
          'mexican',
          'italian',
          'thai',
          'japanese',
          'danish',
          'french',
        ].includes(t),
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

      const buffer = await this.callGemini(prompt);
      if (buffer) {
        const filename = `${recipe.id}_step${i + 1}.png`;
        fs.writeFileSync(path.join(this.stepsDir, filename), buffer);
        images.push(
          `/api/recipe-manager/images/recipes/steps/${filename}`,
        );
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
    prompt: string,
    retries = 2,
  ): Promise<Buffer | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.ai!.models.generateContent({
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
        const msg =
          error instanceof Error ? error.message : String(error);
        if (msg.includes('503') && attempt < retries) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        this.logger.error(`Gemini error: ${msg.substring(0, 120)}`);
        return null;
      }
    }
    return null;
  }
}
