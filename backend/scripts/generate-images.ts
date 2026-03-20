/**
 * Generate AI images for recipes using Google Gemini API.
 * Generates both hero images and step-by-step instruction illustrations.
 * Skips recipes/steps that already have images.
 *
 * Usage:
 *   npx tsx scripts/generate-images.ts [--steps-only] [--hero-only]
 *
 * Environment variables:
 *   GEMINI_API_KEY - Google Gemini API key
 *   API_URL - Recipe Manager API base URL (default: https://mhylle.com/api/recipe-manager/api)
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'https://mhylle.com/api/recipe-manager/api';
const API_KEY = process.env.GEMINI_API_KEY;
const STEPS_ONLY = process.argv.includes('--steps-only');
const HERO_ONLY = process.argv.includes('--hero-only');

if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable required');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'recipes');
const STEPS_DIR = path.join(OUTPUT_DIR, 'steps');

interface Recipe {
  id: string;
  name: string;
  description: string;
  tags: string[];
  instructions: string[];
  instructionImages?: string[];
  imageUrl?: string;
  ingredients: Array<{ name: string }>;
}

async function callGemini(prompt: string, retries = 2): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
        config: { responseModalities: ['IMAGE'] },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        if (attempt < retries) { await sleep(3000); continue; }
        return null;
      }

      for (const part of parts) {
        if (part.inlineData) {
          return Buffer.from(part.inlineData.data!, 'base64');
        }
      }
      return null;
    } catch (error: any) {
      const msg = error.message || String(error);
      if (msg.includes('503') && attempt < retries) {
        console.log(`    Retry ${attempt + 1}/${retries} (service unavailable)...`);
        await sleep(5000);
        continue;
      }
      console.error(`    Gemini error: ${msg.substring(0, 120)}`);
      return null;
    }
  }
  return null;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function buildHeroPrompt(recipe: Recipe): string {
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

function buildStepPrompt(recipe: Recipe, stepIndex: number, instruction: string): string {
  const cuisine = recipe.tags.find(t =>
    ['mexican', 'italian', 'thai', 'japanese', 'danish', 'french'].includes(t)
  ) || '';

  return `Cooking process illustration for "${recipe.name}" - Step ${stepIndex + 1}: ${instruction}. `
    + (cuisine ? `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} cuisine. ` : '')
    + `Show hands actively performing this cooking step in a home kitchen. `
    + `Warm natural lighting, close-up action shot, clean modern kitchen background. `
    + `Photorealistic cooking photography, no text or labels.`;
}

async function updateRecipe(recipeId: string, data: Record<string, unknown>): Promise<boolean> {
  const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.ok;
}

async function generateHeroImages(recipes: Recipe[]): Promise<void> {
  const needsHero = recipes.filter(r => !r.imageUrl);
  console.log(`\n=== HERO IMAGES: ${needsHero.length} needed ===\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (let i = 0; i < needsHero.length; i++) {
    const recipe = needsHero[i];
    console.log(`[${i + 1}/${needsHero.length}] ${recipe.name}`);

    const buf = await callGemini(buildHeroPrompt(recipe));
    if (!buf) { console.log('  FAILED\n'); continue; }

    const filename = `${recipe.id}.png`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), buf);
    console.log(`  Saved (${(buf.length / 1024).toFixed(0)} KB)`);

    const imageUrl = `/api/recipe-manager/images/recipes/${filename}`;
    const ok = await updateRecipe(recipe.id, { imageUrl });
    console.log(ok ? `  Updated: ${imageUrl}` : '  Update FAILED');

    if (i < needsHero.length - 1) await sleep(2000);
  }
}

async function generateStepImages(recipes: Recipe[]): Promise<void> {
  // Only process recipes that have missing step images
  const needsSteps = recipes.filter(r => {
    const images = r.instructionImages || [];
    return images.length < r.instructions.length || images.some(url => !url);
  });

  const totalSteps = needsSteps.reduce((sum, r) => {
    const existing = r.instructionImages || [];
    return sum + r.instructions.filter((_, i) => !existing[i]).length;
  }, 0);

  console.log(`\n=== STEP IMAGES: ${totalSteps} steps across ${needsSteps.length} recipes ===\n`);

  fs.mkdirSync(STEPS_DIR, { recursive: true });
  let done = 0;

  for (const recipe of needsSteps) {
    console.log(`\n--- ${recipe.name} (${recipe.instructions.length} steps) ---`);
    const existingImages = [...(recipe.instructionImages || [])];
    // Ensure array is long enough
    while (existingImages.length < recipe.instructions.length) {
      existingImages.push('');
    }

    let updated = false;

    for (let s = 0; s < recipe.instructions.length; s++) {
      if (existingImages[s]) {
        console.log(`  Step ${s + 1}: already has image, skipping`);
        continue;
      }

      done++;
      console.log(`  Step ${s + 1}/${recipe.instructions.length} [${done}/${totalSteps} total]`);
      console.log(`    "${recipe.instructions[s].substring(0, 80)}..."`);

      const buf = await callGemini(buildStepPrompt(recipe, s, recipe.instructions[s]));
      if (!buf) { console.log('    FAILED'); continue; }

      const filename = `${recipe.id}_step${s + 1}.png`;
      fs.writeFileSync(path.join(STEPS_DIR, filename), buf);
      console.log(`    Saved (${(buf.length / 1024).toFixed(0)} KB)`);

      existingImages[s] = `/api/recipe-manager/images/recipes/steps/${filename}`;
      updated = true;

      await sleep(2000);
    }

    if (updated) {
      const ok = await updateRecipe(recipe.id, { instructionImages: existingImages });
      console.log(ok ? `  Updated instructionImages for ${recipe.name}` : `  Update FAILED for ${recipe.name}`);
    }
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
  console.log(`Found ${recipes.length} recipes`);

  if (!STEPS_ONLY) await generateHeroImages(recipes);
  if (!HERO_ONLY) await generateStepImages(recipes);

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
