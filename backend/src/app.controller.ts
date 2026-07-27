import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Liveness probe.
   *
   * Both the deploy workflow and the container's HEALTHCHECK have always polled
   * `/api/health`, but the route was never implemented — so every deploy since
   * 2026-04-26 failed its health gate and the container has been reporting
   * `unhealthy` while serving traffic normally.
   *
   * Deliberately shallow: it answers "is this process up and routing?", not "is
   * the database reachable?". A liveness probe that fails on a transient DB blip
   * would have the orchestrator restart a healthy app and make an outage worse.
   */
  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
