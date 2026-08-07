import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReportsService, type ReportView } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { OwnerGuard } from '../shared/auth/owner.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/**
 * Reporting a fault or a wish.
 *
 * Guarded but NOT contribution-gated: telling the owner something is broken is
 * not writing to the shared recipe library, and gating it would mean the people
 * most likely to hit a wall — the ones who cannot contribute yet — are the ones
 * who cannot report it.
 */
@Controller('reports')
@UseGuards(SsoAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  async create(
    @CurrentUser() user: LocalUser,
    @Body() dto: CreateReportDto,
  ): Promise<ReportView> {
    return this.reports.create(user, dto);
  }

  /** What this person has reported, so they can see it landed. */
  @Get('mine')
  async mine(@CurrentUser() user: LocalUser): Promise<ReportView[]> {
    return this.reports.listMine(user.id);
  }

  @Get()
  @UseGuards(OwnerGuard)
  async all(): Promise<ReportView[]> {
    return this.reports.listAll();
  }

  /** Retry a mirror that failed — usually an expired token at the time. */
  @Post(':id/retry-mirror')
  @UseGuards(OwnerGuard)
  async retry(@Param('id') id: string): Promise<ReportView> {
    return this.reports.retryMirror(id);
  }
}
