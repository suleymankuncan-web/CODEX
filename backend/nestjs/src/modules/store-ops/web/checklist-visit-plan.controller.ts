import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/auth-context.service';
import { RequireRoles } from '../../auth/decorators/roles.decorator';
import { RequireScope } from '../../auth/decorators/scope.decorator';
import { ChecklistVisitPlanService } from '../application/checklist-visit-plan.service';
import { GetChecklistVisitPlanQueryDto } from './dto/get-checklist-visit-plan.query';
import { SaveChecklistVisitPlanDto } from './dto/save-checklist-visit-plan.dto';
import { ListChecklistVisitPlanCandidatesQueryDto } from './dto/list-checklist-visit-plan-candidates.query';
import { ListChecklistVisitPlanPeriodQueryDto } from './dto/list-checklist-visit-plan-period.query';
import { ListChecklistVisitPlanRegionsQueryDto } from './dto/list-checklist-visit-plan-regions.query';
import { CompleteChecklistVisitPlanItemDto } from './dto/complete-checklist-visit-plan-item.dto';

@Controller('checklists/command-canvas/visit-plans')
export class ChecklistVisitPlanController {
  constructor(private readonly service: ChecklistVisitPlanService) {}

  @Get('regions')
  @RequireScope('authenticated')
  @RequireRoles('REGION_MANAGER')
  async listRegionOptions(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: ListChecklistVisitPlanRegionsQueryDto,
  ) {
    return {
      data: await this.service.listRegionOptions({
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        query: query.query,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }

  @Get('period')
  @RequireScope('authenticated')
  @RequireRoles('REGION_MANAGER')
  async listPeriod(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: ListChecklistVisitPlanPeriodQueryDto,
  ) {
    return {
      data: await this.service.listPeriod({
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        regionId: query.regionId,
        period: query.period,
        query: query.query,
        risk: query.risk,
        reason: query.reason,
        planStatus: query.planStatus,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }

  @Get('candidates')
  @RequireScope('authenticated')
  @RequireRoles('REGION_MANAGER')
  async listCandidates(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: ListChecklistVisitPlanCandidatesQueryDto,
  ) {
    return {
      data: await this.service.listCandidates({
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        regionId: query.regionId,
        query: query.query,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }

  @Get()
  @RequireScope('authenticated')
  @RequireRoles('REPORT_VIEWER', 'REGION_MANAGER', 'STORE_MANAGER')
  async getWeeklyPlan(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: GetChecklistVisitPlanQueryDto,
  ) {
    return {
      data: await this.service.getWeeklyPlan({
        actorUserId: request.user.userId,
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        regionId: query.regionId,
        managerUserId: query.managerUserId,
        weekStart: query.weekStart,
      }),
    };
  }

  @Put(':regionId/:weekStart')
  @RequireScope('authenticated')
  @RequireRoles('REGION_MANAGER')
  async saveWeeklyPlan(
    @Req() request: { user: AuthenticatedUser },
    @Param('regionId', new ParseUUIDPipe()) regionId: string,
    @Param('weekStart') weekStart: string,
    @Body() body: SaveChecklistVisitPlanDto,
  ) {
    return {
      data: await this.service.saveWeeklyPlan({
        actorUserId: request.user.userId,
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        regionId,
        weekStart,
        expectedRevision: body.expectedRevision,
        idempotencyKey: body.idempotencyKey,
        items: body.items,
      }),
    };
  }

  @Post('items/:planItemId/complete')
  @RequireScope('authenticated')
  @RequireRoles('REGION_MANAGER')
  async completeVisit(
    @Req() request: { user: AuthenticatedUser },
    @Param('planItemId', new ParseUUIDPipe()) planItemId: string,
    @Body() body: CompleteChecklistVisitPlanItemDto,
  ) {
    return {
      data: await this.service.completeVisit({
        actorUserId: request.user.userId,
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        planItemId,
        idempotencyKey: body.idempotencyKey,
      }),
    };
  }
}
