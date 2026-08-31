import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiParam, ApiQuery } from "@nestjs/swagger";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { SnapshotService } from "../application/snapshot.service";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { CreateSnapshotRunDto } from "./dto/create-snapshot-run.dto";
import { ListSnapshotRunAuditQueryDto } from "./dto/list-snapshot-run-audit.query";
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
  @ApiParam({ name: "snapshotRunId", schema: { type: "string", format: "uuid" } })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  })
  @ApiQuery({
    name: "offset",
    required: false,
    schema: { type: "integer", minimum: 0, default: 0 },
  })
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunAudit(
    @Param("snapshotRunId", new ParseUUIDPipe({ version: "4" })) snapshotRunId: string,
    @Req()
    request: {
      user: SnapshotActorUser;
    },
    @Query() query: ListSnapshotRunAuditQueryDto,
  ) {
    return this.snapshotService.getSnapshotRunAudit(
      snapshotRunId,
      this.getActorCompanyIds(request.user),
      {
        limit: query.limit,
        offset: query.offset,
      },
    );
  }

  @Get("runs/:snapshotRunId/dependencies")
  @ApiParam({ name: "snapshotRunId", schema: { type: "string", format: "uuid" } })
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunDependencies(
    @Param("snapshotRunId", new ParseUUIDPipe({ version: "4" })) snapshotRunId: string,
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
  @ApiParam({ name: "snapshotRunId", schema: { type: "string", format: "uuid" } })
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRunLineage(
    @Param("snapshotRunId", new ParseUUIDPipe({ version: "4" })) snapshotRunId: string,
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
  @ApiParam({ name: "snapshotRunId", schema: { type: "string", format: "uuid" } })
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async rerunSnapshotRun(
    @Param("snapshotRunId", new ParseUUIDPipe({ version: "4" })) snapshotRunId: string,
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
  @ApiParam({ name: "snapshotRunId", schema: { type: "string", format: "uuid" } })
  @RequireScope("company")
  @RequireRoles("SNAPSHOT_OPERATOR")
  async getSnapshotRun(
    @Param("snapshotRunId", new ParseUUIDPipe({ version: "4" })) snapshotRunId: string,
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
