import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Recipe } from '../shared/interfaces/recipe.interface.js';

@Injectable()
export class RecipeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Omit<Recipe, 'id'>): Promise<Recipe> {
    const result = await this.prisma.recipe.create({
      data: {
        name: data.name,
        description: data.description,
        servings: data.servings,
        instructions: data.instructions,
        instructionImages: data.instructionImages ?? [],
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        difficulty: data.difficulty,
        tags: data.tags,
        imageUrl: data.imageUrl,
        ingredients: {
          create: data.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            pantryCategory: ing.pantryCategory,
          })),
        },
      },
      include: { ingredients: true },
    });
    return this.toInterface(result);
  }

  async findAll(): Promise<Recipe[]> {
    const results = await this.prisma.recipe.findMany({
      include: { ingredients: true },
    });
    return results.map((r) => this.toInterface(r));
  }

  async findById(id: string): Promise<Recipe> {
    const result = await this.prisma.recipe.findUnique({
      where: { id },
      include: { ingredients: true },
    });
    if (!result) {
      throw new NotFoundException(`recipes with id ${id} not found`);
    }
    return this.toInterface(result);
  }

  async update(id: string, data: Partial<Recipe>): Promise<Recipe> {
    await this.findById(id);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.servings !== undefined) updateData.servings = data.servings;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.instructionImages !== undefined) updateData.instructionImages = data.instructionImages;
    if (data.prepTime !== undefined) updateData.prepTime = data.prepTime;
    if (data.cookTime !== undefined) updateData.cookTime = data.cookTime;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;

    if (data.ingredients !== undefined) {
      updateData.ingredients = {
        deleteMany: {},
        create: data.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          pantryCategory: ing.pantryCategory,
        })),
      };
    }

    const result = await this.prisma.recipe.update({
      where: { id },
      data: updateData,
      include: { ingredients: true },
    });
    return this.toInterface(result);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.recipe.delete({ where: { id } });
  }

  private toInterface(result: Record<string, unknown>): Recipe {
    const r = result as Record<string, unknown> & {
      ingredients: Array<Record<string, unknown>>;
    };
    return {
      id: r.id as string,
      name: r.name as string,
      description: r.description as string,
      servings: r.servings as number,
      instructions: r.instructions as string[],
      instructionImages: r.instructionImages as string[] | undefined,
      prepTime: r.prepTime as number,
      cookTime: r.cookTime as number,
      difficulty: r.difficulty as Recipe['difficulty'],
      tags: r.tags as string[],
      imageUrl: r.imageUrl as string | undefined,
      ingredients: r.ingredients.map((ing) => ({
        name: ing.name as string,
        quantity: ing.quantity as number,
        unit: ing.unit as Recipe['ingredients'][0]['unit'],
        pantryCategory: ing.pantryCategory as Recipe['ingredients'][0]['pantryCategory'],
      })),
    };
  }
}
