/**
 * Generate AI images for recipes using Google Gemini API.
 * Skips recipes that already have an imageUrl set.
 *
 * Usage:
 *   npx tsx scripts/generate-images.ts [--api-url URL] [--api-key KEY]
 *
 * Environment variables:
 *   GEMINI_API_KEY - Google Gemini API key
 *   API_URL - Recipe Manager API base URL (default: https://mhylle.com/api/recipe-manager/api)
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || process.argv.find(a => a.startsWith('--api-url='))?.split('=')[1] || 'https://mhylle.com/api/recipe-manager/api';
const API_KEY = process.env.GEMINI_API_KEY || process.argv.find(a => a.startsWith('--api-key='))?.split('=')[1];

if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable or --api-key= argument required');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'recipes');

interface Recipe {
  id: string;
  name: string;
  description: string;
  tags: string[];
  imageUrl?: string;
  ingredients: Array<{ name: string }>;
}

function buildPrompt(recipe: Recipe): string {
  const ingredientNames = recipe.ingredients.slice(0, 5).map(i => i.name).join(', ');
  const cuisine = recipe.tags.find(t =>
    ['mexican', 'italian', 'thai', 'japanese', 'danish', 'french'].includes(t)
  ) || '';

  return `Professional food photography of ${recipe.name}. ${recipe.description}. `
    + `Key ingredients visible: ${ingredientNames}. `
    + (cuisine ? `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} cuisine style. ` : '')
    + `Shot from above at 45 degrees, natural warm lighting, beautiful plating on a rustic wooden table, `
    + `shallow depth of field, appetizing and vibrant colors. High-end restaurant presentation. `
    + `Photorealistic, no text or watermarks.`;
}

async function generateImage(recipe: Recipe): Promise<Buffer | null> {
  const prompt = buildPrompt(recipe);
  console.log(`  Prompt: ${prompt.substring(0, 100)}...`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.error(`  No parts in response`);
      return null;
    }

    for (const part of parts) {
      if (part.inlineData) {
        return Buffer.from(part.inlineData.data!, 'base64');
      }
    }

    console.error(`  No image data in response`);
    return null;
  } catch (error: any) {
    console.error(`  Gemini API error: ${error.message || error}`);
    return null;
  }
}

async function updateRecipeImageUrl(recipeId: string, imageUrl: string): Promise<void> {
  const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update recipe ${recipeId}: ${response.status} ${response.statusText}`);
  }
}

async function main() {
  console.log(`Fetching recipes from ${API_URL}...`);
  const response = await fetch(`${API_URL}/recipes`);
  if (!response.ok) {
    console.error(`Failed to fetch recipes: ${response.status}`);
    process.exit(1);
  }

  const recipes: Recipe[] = await response.json() as Recipe[];
  const needsImage = recipes.filter(r => !r.imageUrl);

  console.log(`Found ${recipes.length} recipes, ${needsImage.length} need images\n`);

  if (needsImage.length === 0) {
    console.log('All recipes already have images. Nothing to do.');
    return;
  }

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let generated = 0;
  let failed = 0;

  for (const recipe of needsImage) {
    console.log(`[${generated + failed + 1}/${needsImage.length}] Generating image for: ${recipe.name}`);

    const imageBuffer = await generateImage(recipe);
    if (!imageBuffer) {
      failed++;
      console.log(`  FAILED\n`);
      continue;
    }

    // Save locally
    const filename = `${recipe.id}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, imageBuffer);
    console.log(`  Saved: ${filepath} (${(imageBuffer.length / 1024).toFixed(0)} KB)`);

    // Update recipe imageUrl - path through nginx: /api/recipe-manager/images/recipes/{id}.png
    const imageUrl = `/api/recipe-manager/images/recipes/${filename}`;
    try {
      await updateRecipeImageUrl(recipe.id, imageUrl);
      console.log(`  Updated imageUrl: ${imageUrl}`);
      generated++;
    } catch (err: any) {
      console.error(`  Failed to update: ${err.message}`);
      failed++;
    }

    // Rate limiting - be gentle with the API
    if (generated + failed < needsImage.length) {
      console.log(`  Waiting 2s...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\nDone! Generated: ${generated}, Failed: ${failed}`);
}

main().catch(console.error);
