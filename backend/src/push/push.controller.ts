import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PushService } from './push.service.js';
import {
  DeletePushSubscriptionDto,
  SavePushSubscriptionDto,
} from './dto/push-subscription.dto.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /**
   * The VAPID public key, and by its absence whether the feature exists at all.
   *
   * Unguarded on purpose: it is a public key, the client needs it before it can
   * subscribe, and `null` is how the UI knows to keep the whole notification
   * offer hidden rather than showing a switch that cannot work.
   */
  @Get('key')
  key(): { publicKey: string | null } {
    return { publicKey: this.push.configured ? this.push.publicKey : null };
  }

  @UseGuards(SsoAuthGuard)
  @Post('subscriptions')
  @HttpCode(204)
  async subscribe(
    @CurrentUser() user: LocalUser,
    @Body() dto: SavePushSubscriptionDto,
  ): Promise<void> {
    await this.push.saveSubscription(user.id, {
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    });
  }

  @UseGuards(SsoAuthGuard)
  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(
    @CurrentUser() user: LocalUser,
    @Body() dto: DeletePushSubscriptionDto,
  ): Promise<void> {
    await this.push.removeSubscription(user.id, dto.endpoint);
  }
}
