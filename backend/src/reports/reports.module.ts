import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { GithubIssueService } from './github-issue.service.js';

/** Defect and improvement reports, mirrored to GitHub. */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService, GithubIssueService],
  exports: [ReportsService],
})
export class ReportsModule {}
