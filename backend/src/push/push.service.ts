import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service.js';

/** What a delivered timer says on the lock screen. */
export interface PushPayload {
  title: string;
  body: string;
}

/** The shape the browser hands back from `PushManager.subscribe()`. */
export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Outcome of one send, so the caller can prune what is permanently gone. */
export type SendResult = 'sent' | 'gone' | 'failed';

/**
 * Web Push transport.
 *
 * Push is the only mechanism that can ring a timer after the page is gone —
 * the API built for doing it client-side (Notification Triggers) was abandoned
 * by Chrome in 2021 for being unreliable across platforms, so there is no
 * offline alternative to a server that holds the promise and sends at the due
 * instant.
 *
 * VAPID keys are optional at boot. An estate without them still runs, just with
 * timers that ring only while the page is open — the pre-existing behaviour.
 * Throwing here instead would take the whole API down over a feature nobody has
 * configured yet.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  /** Public — the client needs it to subscribe, and it is a public key. */
  readonly publicKey: string;
  private readonly privateKey: string;

  constructor(private readonly prisma: PrismaService) {
    // .trim() for the same reason SsoAuthGuard trims JWT_SECRET: a trailing
    // newline in a deployment secret is a documented mhylle infra bug, and an
    // untrimmed VAPID key fails signing with an error that names nothing useful.
    this.publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? '';
    this.privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? '';
    const subject =
      process.env.VAPID_SUBJECT?.trim() ?? 'mailto:mhylle@yahoo.com';

    if (this.configured) {
      webpush.setVapidDetails(subject, this.publicKey, this.privateKey);
    } else {
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set — cooking timers will ring only while the app is open.',
      );
    }
  }

  /** Whether push can actually be sent. Every write path checks this first. */
  get configured(): boolean {
    return this.publicKey.length > 0 && this.privateKey.length > 0;
  }

  /**
   * Remember a device.
   *
   * Upsert on `endpoint`, not on user: one person cooks from a phone and a
   * tablet and expects both to ring. The browser also rotates the endpoint
   * without warning, and an insert-only path would leave the old one behind to
   * fail forever.
   *
   * A re-subscribe can arrive for an endpoint another account already owns —
   * two people sharing a tablet, one signing out and the other in. `userId` is
   * therefore part of the update, so the row follows whoever subscribed last.
   */
  async saveSubscription(
    userId: string,
    keys: PushSubscriptionKeys,
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: keys.endpoint },
      create: {
        userId,
        endpoint: keys.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Forget a device.
   *
   * Scoped to the caller so one account cannot unsubscribe another's phone by
   * guessing an endpoint. deleteMany rather than delete: an already-removed
   * endpoint is the expected result of the client retrying, not an error.
   */
  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async subscriptionsFor(userIds: string[]): Promise<
    {
      id: string;
      userId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }[]
  > {
    if (userIds.length === 0) return [];
    return this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: {
        id: true,
        userId: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });
  }

  /**
   * Deliver one notification.
   *
   * The payload carries a `notification` key because that is what Angular's
   * ngsw-worker looks for: with it the service worker shows the notification
   * itself, which is the whole point — no page is running when a timer fires on
   * a locked phone. Without that key ngsw forwards the message to `SwPush.messages`
   * instead, and a closed app has nobody listening.
   */
  async send(
    subscription: PushSubscriptionKeys,
    payload: PushPayload,
  ): Promise<SendResult> {
    if (!this.configured) return 'failed';

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          notification: {
            title: payload.title,
            body: payload.body,
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-96.png',
            // Distinct per timer, so two timers finishing together show as two
            // notifications rather than one replacing the other.
            tag: `cooking-timer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            // A cooking alarm that auto-dismisses is a burnt dish. Where the
            // platform honours this, it stays until acknowledged.
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 400],
            data: {
              // ngsw's click contract. Re-focus the open tab if there is one
              // rather than stacking up new ones.
              onActionClick: {
                default: {
                  operation: 'navigateLastFocusedOrOpen',
                  url: '/recipe-manager/',
                },
              },
            },
          },
        }),
        // Tell the push service how long to keep trying. Past the timer's own
        // relevance a late alarm is worse than none — it sends you to check a
        // dish you already took out.
        { TTL: 300, urgency: 'high' },
      );
      return 'sent';
    } catch (error) {
      // 404/410 mean the endpoint is permanently dead — the browser was
      // uninstalled or the subscription revoked. Checking the property rather
      // than `instanceof WebPushError` keeps this working when the error comes
      // from a wrapped or re-thrown source.
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        return 'gone';
      }
      this.logger.warn(
        `Push send failed (status ${statusCode ?? 'unknown'}): ${(error as Error).message}`,
      );
      return 'failed';
    }
  }

  /** Drop endpoints the push service has told us are dead. */
  async pruneSubscriptions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.pushSubscription.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
