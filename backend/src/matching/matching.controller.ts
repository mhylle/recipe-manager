import { Controller, Get, Query } from '@nestjs/common';
import { MatchingService, MatchResult } from './matching.service.js';

@Controller('recipes/match')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get()
  async matchRecipes(
    @Query('servings') servings?: string,
  ): Promise<MatchResult> {
    const servingsNum = servings ? parseInt(servings, 10) : undefined;
    return this.matchingService.matchRecipes(servingsNum);
  }
}
