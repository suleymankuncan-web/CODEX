import { Injectable, Logger } from "@nestjs/common";
import { SnapshotService } from "../store-ops/application/snapshot.service";

@Injectable()
export class SnapshotSchedulerService {
  private readonly logger = new Logger(SnapshotSchedulerService.name);

  constructor(private readonly snapshotService: SnapshotService) {}

  async scheduleMonthlySnapshot(input: {
    periodStart: string;
    periodEnd: string;
    actorUserId: string;
  }) {
    this.logger.log(
      `Scheduling monthly snapshot for ${input.periodStart} - ${input.periodEnd}`,
    );

    return this.snapshotService.enqueueSnapshotRun({
      snapshotType: "monthly",
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      actorUserId: input.actorUserId,
    });
  }
}
