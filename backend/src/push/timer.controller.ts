import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ScheduledTimerService,
  type ScheduledTimerView,
} from './scheduled-timer.service.js';
import { CreateTimerDto } from './dto/create-timer.dto.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';

/**
 * Cooking timers that outlive the page.
 *
 * Guarded throughout: a timer is addressed to a person's devices, so there is no
 * anonymous version of it. Signed-out cooks keep the in-page countdown, which
 * needs no server at all.
 */
@Controller('timers')
@UseGuards(SsoAuthGuard)
export class TimerController {
  constructor(private readonly timers: ScheduledTimerService) {}

  @Post()
  async create(
    @CurrentUser() user: LocalUser,
    @Body() dto: CreateTimerDto,
  ): Promise<ScheduledTimerView> {
    return this.timers.schedule(user.id, dto);
  }

  /** Outstanding timers, so a reopened app can rebuild its countdowns. */
  @Get()
  async pending(@CurrentUser() user: LocalUser): Promise<ScheduledTimerView[]> {
    return this.timers.listPending(user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async cancel(
    @CurrentUser() user: LocalUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.timers.cancel(user.id, id);
  }
}
