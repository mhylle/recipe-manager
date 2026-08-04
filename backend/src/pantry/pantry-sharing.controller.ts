import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { PantryAccessService } from './pantry-access.service.js';
import { SsoAuthGuard } from '../shared/auth/sso-auth.guard.js';
import { CurrentUser } from '../shared/auth/current-user.decorator.js';
import type { LocalUser } from '../shared/auth/user.service.js';

export class CreatePantryDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;
}

export interface MemberView {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  isYou: boolean;
}

/**
 * Managing who is in a kitchen.
 *
 * Inviting can only reach someone who already has an mhylle.com account — this
 * app borrows identities and does not create them. An unknown address says so
 * plainly rather than appearing to succeed and leaving the inviter waiting for
 * someone who was never told.
 */
@Controller('pantries')
@UseGuards(SsoAuthGuard)
export class PantrySharingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PantryAccessService,
  ) {}

  @Post()
  async createPantry(
    @CurrentUser() user: LocalUser,
    @Body() dto: CreatePantryDto,
  ): Promise<{ id: string }> {
    return { id: await this.access.createFor(user, dto.name) };
  }

  @Get(':id/members')
  async members(
    @CurrentUser() user: LocalUser,
    @Param('id') pantryId: string,
  ): Promise<MemberView[]> {
    // resolve() enforces membership: you cannot enumerate a household you are
    // not part of.
    await this.access.resolve(user, pantryId);

    const rows = await this.prisma.pantryMember.findMany({
      where: { pantryId },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return rows.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role,
      isYou: m.user.id === user.id,
    }));
  }

  @Post(':id/members')
  async invite(
    @CurrentUser() user: LocalUser,
    @Param('id') pantryId: string,
    @Body() dto: InviteMemberDto,
  ): Promise<MemberView> {
    await this.requireOwner(user, pantryId);

    const invitee = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (!invitee) {
      throw new NotFoundException(
        `No mhylle.com account uses ${dto.email}. They need to sign in once before a kitchen can be shared with them.`,
      );
    }

    const existing = await this.prisma.pantryMember.findUnique({
      where: { pantryId_userId: { pantryId, userId: invitee.id } },
    });
    if (existing) {
      throw new BadRequestException(`${invitee.displayName} is already in this kitchen.`);
    }

    const created = await this.prisma.pantryMember.create({
      data: { pantryId, userId: invitee.id, role: 'member' },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });

    return {
      userId: created.user.id,
      displayName: created.user.displayName,
      email: created.user.email,
      role: created.role,
      isYou: false,
    };
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @CurrentUser() user: LocalUser,
    @Param('id') pantryId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.access.resolve(user, pantryId);

    const target = await this.prisma.pantryMember.findUnique({
      where: { pantryId_userId: { pantryId, userId } },
    });
    if (!target) {
      throw new NotFoundException('That person is not in this kitchen.');
    }

    // Anyone may leave; only the owner may remove someone else.
    const leavingSelf = userId === user.id;
    if (!leavingSelf) {
      await this.requireOwner(user, pantryId);
    }

    if (target.role === 'owner') {
      const others = await this.prisma.pantryMember.count({
        where: { pantryId, userId: { not: userId } },
      });
      if (others > 0) {
        // A kitchen with members but no owner is a support problem: nobody can
        // invite, and nobody can remove.
        throw new BadRequestException(
          'Hand the kitchen to someone else before leaving it — it cannot be left without an owner.',
        );
      }
    }

    await this.prisma.pantryMember.delete({
      where: { pantryId_userId: { pantryId, userId } },
    });
  }

  private async requireOwner(user: LocalUser, pantryId: string): Promise<void> {
    await this.access.resolve(user, pantryId);
    const me = await this.prisma.pantryMember.findUnique({
      where: { pantryId_userId: { pantryId, userId: user.id } },
    });
    if (me?.role !== 'owner') {
      throw new ForbiddenException('Only the kitchen owner can do that.');
    }
  }
}
