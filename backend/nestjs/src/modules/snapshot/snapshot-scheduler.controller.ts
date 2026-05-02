import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../auth/decorators/roles.decorator";
import { RequireScope } from "../auth/decorators/scope.decorator";
import { SnapshotSchedulerService } from "./snapshot-scheduler.service";
import { GetDailyClosureStatusQueryDto } from "./dto/get-daily-closure-status.query";
import { RunDailyClosureDto } from "./dto/run-daily-closure.dto";

@Controller("snapshots")
export class SnapshotSchedulerController {
  constructor(private readonly snapshotSchedulerService: SnapshotSchedulerService) {}

  @Get("daily-closure")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getDailyClosureStatus(@Query() query: GetDailyClosureStatusQueryDto) {
    return this.snapshotSchedulerService.getDailyClosureStatus(query.referenceAt);
  }

  @Post("daily-closure/run")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async runDailyClosure(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: RunDailyClosureDto,
  ) {
    return this.snapshotSchedulerService.scheduleDailySnapshot({
      actorUserId: request.user.userId,
      closureDate: body.closureDate,
      referenceAt: body.referenceAt,
    });
  }
}
