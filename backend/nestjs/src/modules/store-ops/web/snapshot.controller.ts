import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { SnapshotService } from "../application/snapshot.service";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { CreateSnapshotRunDto } from "./dto/create-snapshot-run.dto";
import { ListSnapshotRunOperationsQueryDto } from "./dto/list-snapshot-run-operations.query";

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
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Post("runs")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async createSnapshotRun(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Body() body: CreateSnapshotRunDto,
  ) {
    return this.snapshotService.enqueueSnapshotRun({
      ...body,
      actorUserId: request.user.userId,
      actorCompanyIds: this.getActorCompanyIds(request.user),
    });
  }

  @Get("lookups")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotLookups(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
  ) {
    return this.snapshotService.getSnapshotLookups({
      actorCompanyIds: this.getActorCompanyIds(request.user),
    });
  }

  @Get("runs")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async listSnapshotRuns(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Query() query: ListSnapshotRunOperationsQueryDto,
  ) {
    return this.snapshotService.listSnapshotRuns({
      runStatus: query.runStatus,
      snapshotType: query.snapshotType,
      actorCompanyIds: this.getActorCompanyIds(request.user),
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("runs/summary")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunSummary(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Query() query: ListSnapshotRunOperationsQueryDto,
  ) {
    return this.snapshotService.getSnapshotRunSummary({
      runStatus: query.runStatus,
      snapshotType: query.snapshotType,
      actorCompanyIds: this.getActorCompanyIds(request.user),
    });
  }

  @Get("runs/overview")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunOverview(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Query() query: ListSnapshotRunOperationsQueryDto,
  ) {
    return this.snapshotService.getSnapshotRunOverview({
      runStatus: query.runStatus,
      snapshotType: query.snapshotType,
      actorCompanyIds: this.getActorCompanyIds(request.user),
    });
  }

  @Get("runs/needs-action")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunNeedsAction(
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Query() query: ListSnapshotRunOperationsQueryDto,
  ) {
    return this.snapshotService.getSnapshotRunNeedsAction({
      runStatus: query.runStatus,
      snapshotType: query.snapshotType,
      actorCompanyIds: this.getActorCompanyIds(request.user),
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("runs/:snapshotRunId/audit")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunAudit(
    @Param("snapshotRunId") snapshotRunId: string,
    @Req()
    request: {
      user: SnapshotActorUser;
    },
  ) {
    return this.snapshotService.getSnapshotRunAudit(
      snapshotRunId,
      this.getActorCompanyIds(request.user),
    );
  }

  @Get("runs/:snapshotRunId/dependencies")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunDependencies(
    @Param("snapshotRunId") snapshotRunId: string,
    @Req()
    request: {
      user: SnapshotActorUser;
    },
  ) {
    return this.snapshotService.getSnapshotRunDependencies(
      snapshotRunId,
      this.getActorCompanyIds(request.user),
    );
  }

  @Get("runs/:snapshotRunId/lineage")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunLineage(
    @Param("snapshotRunId") snapshotRunId: string,
    @Req()
    request: {
      user: SnapshotActorUser;
    },
  ) {
    return this.snapshotService.getSnapshotRunLineage(
      snapshotRunId,
      this.getActorCompanyIds(request.user),
    );
  }

  @Post("runs/:snapshotRunId/rerun")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async rerunSnapshotRun(
    @Param("snapshotRunId") snapshotRunId: string,
    @Req()
    request: {
      user: SnapshotActorUser;
    },
  ) {
    return this.snapshotService.rerunSnapshotRun(
      snapshotRunId,
      request.user.userId,
      this.getActorCompanyIds(request.user),
    );
  }

  @Get("runs/:snapshotRunId")
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRun(
    @Param("snapshotRunId") snapshotRunId: string,
    @Req()
    request: {
      user: SnapshotActorUser;
    },
  ) {
    return this.snapshotService.getSnapshotRun(
      snapshotRunId,
      this.getActorCompanyIds(request.user),
    );
  }

  private getActorCompanyIds(user: SnapshotActorUser) {
    if (user.roleCodes.includes("SUPER_ADMIN")) {
      return undefined;
    }

    return user.readScope?.companyIds ?? user.scope.companyIds;
  }
}
