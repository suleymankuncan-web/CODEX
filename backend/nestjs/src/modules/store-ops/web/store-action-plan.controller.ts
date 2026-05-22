import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireActionScope, RequireScope } from "../../auth/decorators/scope.decorator";
import { StoreActionPlanService } from "../application/store-action-plan.service";
import { CancelStoreActionPlanDto } from "./dto/cancel-store-action-plan.dto";
import { CloseStoreActionPlanDto } from "./dto/close-store-action-plan.dto";
import { CreateStoreActionPlanDto } from "./dto/create-store-action-plan.dto";
import { ListStoreActionPlansQueryDto } from "./dto/list-store-action-plans.query";
import { UpdateStoreActionPlanStatusDto } from "./dto/update-store-action-plan-status.dto";

type StoreActionPlanRequest = {
  user: AuthenticatedUser;
};

@Controller("store-actions")
export class StoreActionPlanController {
  constructor(private readonly storeActionPlanService: StoreActionPlanService) {}

  @Get("plans")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async listPlans(
    @Req() request: StoreActionPlanRequest,
    @Query() query: ListStoreActionPlansQueryDto,
  ) {
    return this.storeActionPlanService.listPlans({
      actorActionScope: request.user.actionScope,
      storeId: query.storeId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("plans/:actionPlanId")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async getPlan(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
  ) {
    return this.storeActionPlanService.getPlan({
      actorActionScope: request.user.actionScope,
      actionPlanId,
    });
  }

  @Post("plans")
  @RequireScope("authenticated")
  @RequireActionScope("store")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async createPlan(
    @Req() request: StoreActionPlanRequest,
    @Body() body: CreateStoreActionPlanDto,
  ) {
    return this.storeActionPlanService.createPlan({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      ...body,
    });
  }

  @Patch("plans/:actionPlanId/status")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async updateStatus(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
    @Body() body: UpdateStoreActionPlanStatusDto,
  ) {
    return this.storeActionPlanService.updateStatus({
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      actionPlanId,
      status: body.status,
      note: body.note,
    });
  }

  @Patch("plans/:actionPlanId/close")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async closePlan(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
    @Body() body: CloseStoreActionPlanDto,
  ) {
    return this.storeActionPlanService.closePlan({
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      actionPlanId,
      resolutionNote: body.resolutionNote,
    });
  }

  @Patch("plans/:actionPlanId/cancel")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async cancelPlan(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
    @Body() body: CancelStoreActionPlanDto,
  ) {
    return this.storeActionPlanService.cancelPlan({
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      actionPlanId,
      cancelReason: body.cancelReason,
    });
  }
}
