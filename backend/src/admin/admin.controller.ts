import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AdminService, type AdminUserView } from './admin.service.js';
import { SetContributorDto } from './dto/set-contributor.dto.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { OwnerGuard } from '../shared/auth/owner.guard.js';

/**
 * Access administration, for the app owner alone.
 *
 * Guard order matters: SsoAuthGuard first to establish who is calling, OwnerGuard
 * second to decide whether they may be here at all.
 */
@Controller('admin')
@UseGuards(SsoAuthGuard, OwnerGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  async listUsers(): Promise<AdminUserView[]> {
    return this.admin.listUsers();
  }

  @Put('users/:id/contributor')
  async setContributor(
    @Param('id') id: string,
    @Body() dto: SetContributorDto,
  ): Promise<AdminUserView> {
    return this.admin.setContributor(id, dto.granted);
  }
}
