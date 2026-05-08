import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../auth/decorators/roles.decorator";
import { RequireScope } from "../auth/decorators/scope.decorator";
import { SnapshotSchedulerService } from "./snapshot-scheduler.service";
import { GetDailyClosureStatusQueryDto } from "./dto/get-daily-closure-status.query";
import { RunDailyClosureDto } from "./dto/run-daily-closure.dto";

type SnapshotActorUser = {
  userId: string;
  roleCodes: string[];
  scope: {
    companyIds: string[];
  };
  readScope?: {
    companyIds: string[];
  };
};

@Controller("snapshots")
export class SnapshotSchedulerController {
  constructor(private readonly snapshotSchedulerService: SnapshotSchedulerService) {}

  @Get("daily-closure")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getDailyClosureStatus(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Query() query: GetDailyClosureStatusQueryDto,
  ) {
    return this.snapshotSchedulerService.getDailyClosureStatus({
      referenceAt: query.referenceAt,
      actorCompanyIds: this.getActorCompanyIds(request.user),
    });
  }

  @Post("daily-closure/run")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async runDailyClosure(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Body() body: RunDailyClosureDto,
  ) {
    return this.snapshotSchedulerService.scheduleDailySnapshot({
      actorUserId: request.user.userId,
      closureDate: body.closureDate,
      referenceAt: body.referenceAt,
      actorCompanyIds: this.getActorCompanyIds(request.user),
    });
  }

  private getActorCompanyIds(user: SnapshotActorUser) {
    if (user.roleCodes.includes("SUPER_ADMIN")) {
      return undefined;
    }

    return user.readScope?.companyIds ?? user.scope.companyIds;
  }
}
