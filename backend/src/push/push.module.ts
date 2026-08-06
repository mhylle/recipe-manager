import { Module } from '@nestjs/common';
import { PushController } from './push.controller.js';
import { TimerController } from './timer.controller.js';
import { PushService } from './push.service.js';
import { ScheduledTimerService } from './scheduled-timer.service.js';
import { TimerSchedulerService } from './timer-scheduler.service.js';

/**
 * Cooking timers that ring on the phone.
 *
 * Three parts: PushService talks to the push services, ScheduledTimerService
 * owns the promises, and TimerSchedulerService is the loop that turns a due
 * promise into a notification.
 */
@Module({
  controllers: [PushController, TimerController],
  providers: [PushService, ScheduledTimerService, TimerSchedulerService],
  exports: [PushService, ScheduledTimerService],
})
export class PushModule {}
