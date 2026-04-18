import { ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { JobDispatcher } from "../../../shared/jobs/job-dispatcher.interface";
import { SnapshotRunJobPayload } from "../../../shared/jobs/job-payloads";
import { JOB_DISPATCHER } from "../../../shared/jobs/jobs.constants";
import {
  buildCommandResponse,
  buildListResponse,
} from "../../../shared/http/response-builders";
import { mapAuditEvent } from "../../../shared/audit/audit-event.mapper";
import { SnapshotOperationsRepository } from "../infrastructure/snapshot-operations.repository";
import { logStructuredError, logStructuredMessage } from "../../../shared/structured-log";

@Injectable()
export class SnapshotService {
  private static readonly SNAPSHOT_STUCK_THRESHOLD_MINUTES = 60;
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(JOB_DISPATCHER)
    private readonly jobDispatcher: JobDispatcher,
    private readonly snapshotOperationsRepository: SnapshotOperationsRepository,
  ) {}

  async enqueueSnapshotRun(input: {
    snapshotType: string;
    periodStart: string;
    periodEnd: string;
    actorUserId: string;
  }) {
    const idempotencyKey = `${input.snapshotType}:${input.periodStart}:${input.periodEnd}`;

    const snapshotRun = await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{
        snapshot_run_id: string;
        snapshot_date: string;
        generated_at: string;
        run_status: string;
      }>(
        `
          SELECT snapshot_run_id, snapshot_date, generated_at, run_status
          FROM rpt.snapshot_run
          WHERE idempotency_key = $1
          LIMIT 1
        `,
        [idempotencyKey],
      );

      if (existing.rowCount && existing.rows[0]) {
        return {
          ...existing.rows[0],
          reused: true,
        };
      }

      const run = await this.snapshotOperationsRepository.createSnapshotRun(
        {
          snapshotType: input.snapshotType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          actorUserId: input.actorUserId,
          idempotencyKey,
        },
        client,
      );

      await this.snapshotOperationsRepository.recordSnapshotAuditEvent(
        {
          actorUserId: input.actorUserId,
          eventType: "snapshot_run.created",
          snapshotRunId: run.snapshot_run_id,
          metadata: {
            snapshotType: input.snapshotType,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          },
        },
        client,
      );

      return run;
    });

    const reused = "reused" in snapshotRun && snapshotRun.reused === true;

    const job = reused
      ? { status: "queued" as const, jobType: "snapshot-run" as const, backend: "reused" }
      : await this.jobDispatcher.dispatch(
          "snapshot-run",
          {
            snapshotRunId: snapshotRun.snapshot_run_id,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          } satisfies SnapshotRunJobPayload,
          async (payload: SnapshotRunJobPayload) => {
            await this.executeSnapshotRun(payload.snapshotRunId, payload.periodStart, payload.periodEnd);
          },
        );

    logStructuredMessage(this.logger, "snapshot_run.command.accepted", {
      actorUserId: input.actorUserId,
      snapshotRunId: snapshotRun.snapshot_run_id,
      jobId: job.jobId ?? null,
      snapshotType: input.snapshotType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      queueBackend: job.backend,
      queueName: job.queueName ?? null,
      reused,
    });

    return buildCommandResponse({
      status: job.status,
      message: reused
        ? "Existing snapshot run reused via idempotency key"
        : "Immutable snapshot generation has been queued",
      data: {
        snapshotRun,
      },
      job: {
        jobType: job.jobType,
        backend: job.backend,
        jobId: job.jobId ?? null,
        queueName: job.queueName ?? null,
      },
    });
  }

  async getSnapshotLookups() {
    const rerunnableRuns = await this.snapshotOperationsRepository.listFailedSnapshotRunsForLookup();
    const snapshotTypes = ["daily", "weekly", "monthly", "custom"];
    let blockedCount = 0;

    const rerunnableLookupItems = await Promise.all(
      rerunnableRuns.map(async (item) => {
        const activeRerunCount = await this.snapshotOperationsRepository.countActiveReruns(
          item.snapshot_run_id,
        );
        const rerunAllowed = activeRerunCount === 0;
        if (!rerunAllowed) {
          blockedCount += 1;
        }

        return {
          snapshotRunId: item.snapshot_run_id,
          snapshotType: item.snapshot_type,
          periodStart: item.period_start,
          periodEnd: item.period_end,
          rerunAllowed,
          rerunBlockedReason:
            activeRerunCount > 0
              ? "An active rerun already exists for this snapshot run"
              : null,
        };
      }),
    );

    return {
      snapshotTypes,
      governanceSummary: {
        rerunnableCount: rerunnableLookupItems.filter((item) => item.rerunAllowed).length,
        blockedCount,
      },
      rerunnableRuns: rerunnableLookupItems,
      optionGroups: {
        snapshotTypes: snapshotTypes.map((snapshotType) => ({
          value: snapshotType,
          label: snapshotType,
        })),
        rerunnableRuns: rerunnableLookupItems.map((item) => ({
          value: item.snapshotRunId,
          label: `${item.snapshotType} ${item.periodStart}..${item.periodEnd}`,
          rerunAllowed: item.rerunAllowed,
        })),
      },
      meta: {
        totalSnapshotTypes: snapshotTypes.length,
        totalRerunnableRuns: rerunnableLookupItems.length,
      },
    };
  }

  async listSnapshotRuns(input: {
    runStatus?: string;
    snapshotType?: string;
    limit?: number;
    offset?: number;
  }) {
    const result = await this.snapshotOperationsRepository.listSnapshotRuns(input);

    return buildListResponse(
      result.rows.map((item) => this.mapSnapshotRun(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getSnapshotRunSummary(input: { runStatus?: string; snapshotType?: string }) {
    const summary = await this.snapshotOperationsRepository.getSnapshotRunSummary(input);
    const [completedSnapshotRunId, failedSnapshotRunId, inProgressSnapshotRunId] =
      await Promise.all([
        this.snapshotOperationsRepository.getLatestSnapshotRunIdByStatus({
          snapshotType: input.snapshotType,
          runStatus: "completed",
        }),
        this.snapshotOperationsRepository.getLatestSnapshotRunIdByStatus({
          snapshotType: input.snapshotType,
          runStatus: "failed",
        }),
        this.snapshotOperationsRepository.getLatestSnapshotRunIdByStatus({
          snapshotType: input.snapshotType,
          runStatus: "running",
        }),
      ]);
    const statusTotals = {
      all: summary.total,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of summary.rows) {
      if (row.run_status === "queued") statusTotals.queued = Number(row.run_count);
      if (row.run_status === "running") statusTotals.running = Number(row.run_count);
      if (row.run_status === "completed") statusTotals.completed = Number(row.run_count);
      if (row.run_status === "failed") statusTotals.failed = Number(row.run_count);
    }

    return {
      totals: statusTotals,
      healthTotals: {
        healthy: statusTotals.completed,
        inProgress: statusTotals.queued + statusTotals.running,
        retryReady: statusTotals.failed,
        needsAction: 0,
      },
      latest: {
        completedSnapshotRunId,
        failedSnapshotRunId,
        inProgressSnapshotRunId,
      },
    };
  }

  async getSnapshotRunOverview(input: { runStatus?: string; snapshotType?: string }) {
    const stuckBefore = this.getSnapshotStuckBeforeIso();
    const [
      summary,
      actionCounts,
      completedSnapshotRunId,
      failedSnapshotRunId,
      inProgressSnapshotRunId,
      stuckSnapshotRunId,
    ] = await Promise.all([
      this.snapshotOperationsRepository.getSnapshotRunSummary(input),
      this.snapshotOperationsRepository.getSnapshotRunActionCounts({
        ...input,
        stuckBefore,
      }),
      this.snapshotOperationsRepository.getLatestSnapshotRunIdByStatus({
        snapshotType: input.snapshotType,
        runStatus: "completed",
      }),
      this.snapshotOperationsRepository.getLatestSnapshotRunIdByStatus({
        snapshotType: input.snapshotType,
        runStatus: "failed",
      }),
      this.snapshotOperationsRepository.getLatestSnapshotRunIdByStatus({
        snapshotType: input.snapshotType,
        runStatus: "running",
      }),
      this.snapshotOperationsRepository.getLatestStuckSnapshotRunId({
        ...input,
        stuckBefore,
      }),
    ]);

    const statusTotals = {
      all: summary.total,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of summary.rows) {
      if (row.run_status === "queued") statusTotals.queued = Number(row.run_count);
      if (row.run_status === "running") statusTotals.running = Number(row.run_count);
      if (row.run_status === "completed") statusTotals.completed = Number(row.run_count);
      if (row.run_status === "failed") statusTotals.failed = Number(row.run_count);
    }

    return {
      totals: statusTotals,
      healthTotals: {
        healthy: statusTotals.completed,
        inProgress: Math.max(statusTotals.queued + statusTotals.running - actionCounts.stuck, 0),
        retryReady: actionCounts.retryReady,
        needsAction: 0,
        stuck: actionCounts.stuck,
      },
      actionTotals: actionCounts,
      latest: {
        completedSnapshotRunId,
        failedSnapshotRunId,
        inProgressSnapshotRunId,
        stuckSnapshotRunId,
      },
    };
  }

  async getSnapshotRunNeedsAction(input: {
    runStatus?: string;
    snapshotType?: string;
    limit?: number;
    offset?: number;
  }) {
    const result = await this.snapshotOperationsRepository.listSnapshotRunsNeedingAction({
      ...input,
      stuckBefore: this.getSnapshotStuckBeforeIso(),
    });

    const items = await Promise.all(
      result.rows.map(async (item) => ({
        ...this.mapSnapshotRun(item),
        actionReason: item.action_reason,
        recommendedAction: item.recommended_action,
        canRerun: item.run_status === "failed",
        rerunCount: await this.snapshotOperationsRepository.countReruns(item.snapshot_run_id),
        latestRerunSnapshotRunId:
          await this.snapshotOperationsRepository.getLatestRerunSnapshotRunId(item.snapshot_run_id),
        isStuck: item.is_stuck,
      })),
    );

    return buildListResponse(items, {
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async getSnapshotRun(snapshotRunId: string) {
    const snapshotRun = await this.snapshotOperationsRepository.findSnapshotRunById(snapshotRunId);

    if (!snapshotRun) {
      throw new NotFoundException(`Snapshot run not found: ${snapshotRunId}`);
    }

    const cards = await this.snapshotOperationsRepository.getSnapshotRowCounts(snapshotRunId);
    const rerunCount = await this.snapshotOperationsRepository.countReruns(snapshotRunId);
    const latestRerunSnapshotRunId =
      await this.snapshotOperationsRepository.getLatestRerunSnapshotRunId(snapshotRunId);
    const activeRerunCount = await this.snapshotOperationsRepository.countActiveReruns(snapshotRunId);
    const rerunAllowed = snapshotRun.run_status === "failed" && activeRerunCount === 0;
    const rerunBlockedReason =
      snapshotRun.run_status === "failed" && activeRerunCount > 0
        ? "An active rerun already exists for this snapshot run"
        : null;

    return {
      snapshotRun: this.mapSnapshotRun(snapshotRun),
      cards,
      canRerun: snapshotRun.run_status === "failed",
      rerunAllowed,
      rerunBlockedReason,
      rerunCount,
      latestRerunSnapshotRunId,
      failureReason: snapshotRun.failure_reason,
    };
  }

  async getSnapshotRunAudit(snapshotRunId: string) {
    const snapshotRun = await this.snapshotOperationsRepository.findSnapshotRunById(snapshotRunId);

    if (!snapshotRun) {
      throw new NotFoundException(`Snapshot run not found: ${snapshotRunId}`);
    }

    const events = await this.snapshotOperationsRepository.getSnapshotRunAudit(snapshotRunId);

    return buildListResponse(
      events.map((event) => mapAuditEvent(event)),
      { total: events.length },
    );
  }

  async getSnapshotRunDependencies(snapshotRunId: string) {
    const snapshotRun = await this.snapshotOperationsRepository.findSnapshotRunById(snapshotRunId);

    if (!snapshotRun) {
      throw new NotFoundException(`Snapshot run not found: ${snapshotRunId}`);
    }

    const activeRerunCount = await this.snapshotOperationsRepository.countActiveReruns(snapshotRunId);
    const rerunAllowed = snapshotRun.run_status === "failed" && activeRerunCount === 0;
    const rerunBlockedReason =
      snapshotRun.run_status === "failed" && activeRerunCount > 0
        ? "An active rerun already exists for this snapshot run"
        : null;

    return {
      snapshotRunId: snapshotRun.snapshot_run_id,
      runStatus: snapshotRun.run_status,
      rerunAllowed,
      rerunBlockedReason,
      checks: [
        {
          code: "run_failed",
          status: snapshotRun.run_status === "failed" ? "pass" : "fail",
          message:
            snapshotRun.run_status === "failed"
              ? "Snapshot run is in failed status"
              : "Snapshot run must be failed before rerun",
        },
        {
          code: "active_rerun_absent",
          status: activeRerunCount === 0 ? "pass" : "fail",
          message:
            activeRerunCount === 0
              ? "No active rerun exists for this snapshot run"
              : "An active rerun already exists for this snapshot run",
        },
      ],
    };
  }

  async getSnapshotRunLineage(snapshotRunId: string) {
    const snapshotRun = await this.snapshotOperationsRepository.findSnapshotRunById(snapshotRunId);

    if (!snapshotRun) {
      throw new NotFoundException(`Snapshot run not found: ${snapshotRunId}`);
    }

    const [parent, children] = await Promise.all([
      snapshotRun.rerun_of_snapshot_run_id
        ? this.snapshotOperationsRepository.findSnapshotRunById(snapshotRun.rerun_of_snapshot_run_id)
        : Promise.resolve(null),
      this.snapshotOperationsRepository.listRerunChildren(snapshotRunId),
    ]);

    return {
      snapshotRunId,
      parent: parent
        ? {
            snapshotRunId: parent.snapshot_run_id,
            runStatus: parent.run_status,
            snapshotType: parent.snapshot_type,
          }
        : null,
      children: children.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        runStatus: item.run_status,
        snapshotType: item.snapshot_type,
      })),
    };
  }

  async rerunSnapshotRun(snapshotRunId: string, actorUserId: string) {
    const existing = await this.snapshotOperationsRepository.findSnapshotRunById(snapshotRunId);

    if (!existing) {
      throw new NotFoundException(`Snapshot run not found: ${snapshotRunId}`);
    }

    if (existing.run_status !== "failed") {
      throw new ConflictException(`Snapshot run ${snapshotRunId} is not rerunnable`);
    }

    const activeRerunCount = await this.snapshotOperationsRepository.countActiveReruns(snapshotRunId);
    if (activeRerunCount > 0) {
      throw new ConflictException(
        `An active rerun already exists for snapshot run ${snapshotRunId}`,
      );
    }

    const rerun = await this.databaseService.withTransaction(async (client) => {
      const newRun = await this.snapshotOperationsRepository.createSnapshotRun(
        {
          snapshotType: existing.snapshot_type,
          periodStart: existing.period_start,
          periodEnd: existing.period_end,
          actorUserId,
          idempotencyKey: `${snapshotRunId}:rerun:${new Date().toISOString()}`,
          rerunOfSnapshotRunId: snapshotRunId,
        },
        client,
      );

      await this.snapshotOperationsRepository.recordSnapshotAuditEvent(
        {
          actorUserId,
          eventType: "snapshot_run.created",
          snapshotRunId: newRun.snapshot_run_id,
          metadata: {
            snapshotType: existing.snapshot_type,
            periodStart: existing.period_start,
            periodEnd: existing.period_end,
            rerunOfSnapshotRunId: snapshotRunId,
          },
        },
        client,
      );

      await this.snapshotOperationsRepository.recordSnapshotAuditEvent(
        {
          actorUserId,
          eventType: "snapshot_run.rerun_requested",
          snapshotRunId,
          metadata: {
            newSnapshotRunId: newRun.snapshot_run_id,
          },
        },
        client,
      );

      return newRun;
    });

    const job = await this.jobDispatcher.dispatch(
      "snapshot-run",
      {
        snapshotRunId: rerun.snapshot_run_id,
        periodStart: existing.period_start,
        periodEnd: existing.period_end,
      } satisfies SnapshotRunJobPayload,
      async (payload: SnapshotRunJobPayload) => {
        await this.executeSnapshotRun(payload.snapshotRunId, payload.periodStart, payload.periodEnd);
      },
    );

    logStructuredMessage(this.logger, "snapshot_run.rerun.accepted", {
      actorUserId,
      snapshotRunId: rerun.snapshot_run_id,
      jobId: job.jobId ?? null,
      parentSnapshotRunId: snapshotRunId,
      snapshotType: existing.snapshot_type,
      periodStart: existing.period_start,
      periodEnd: existing.period_end,
      queueBackend: job.backend,
      queueName: job.queueName ?? null,
    });

    return buildCommandResponse({
      status: job.status,
      message: "Snapshot run rerun has been queued",
      data: {
        snapshotRun: rerun,
      },
      job: {
        jobType: job.jobType,
        backend: job.backend,
        jobId: job.jobId ?? null,
        queueName: job.queueName ?? null,
      },
    });
  }

  async executeSnapshotRun(
    snapshotRunId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<void> {
    try {
      logStructuredMessage(this.logger, "snapshot_run.execution.started", {
        snapshotRunId,
        periodStart,
        periodEnd,
      });

      await this.snapshotOperationsRepository.markSnapshotRunStarted(snapshotRunId);

      await this.databaseService.withTransaction(async (client) => {
        await client.query(
          `SELECT rpt.generate_store_workforce_snapshot($1::uuid, $2::date, $3::date)`,
          [snapshotRunId, periodStart, periodEnd],
        );

        await client.query(
          `SELECT rpt.generate_store_kpi_snapshot($1::uuid, $2::date, $3::date)`,
          [snapshotRunId, periodStart, periodEnd],
        );

        await client.query(
          `SELECT rpt.generate_store_checklist_snapshot($1::uuid, $2::date, $3::date)`,
          [snapshotRunId, periodStart, periodEnd],
        );

        await client.query(
          `SELECT rpt.generate_turnover_snapshot($1::uuid, $2::date, $3::date)`,
          [snapshotRunId, periodStart, periodEnd],
        );

      });

      await this.snapshotOperationsRepository.markSnapshotRunCompleted(snapshotRunId);
      logStructuredMessage(this.logger, "snapshot_run.execution.completed", {
        snapshotRunId,
        periodStart,
        periodEnd,
      });
    } catch (error) {
      await this.snapshotOperationsRepository.markSnapshotRunFailed(
        snapshotRunId,
        error instanceof Error ? error.message : "Unknown snapshot generation failure",
      );

      logStructuredError(this.logger, "snapshot_run.execution.failed", error, {
        snapshotRunId,
        periodStart,
        periodEnd,
      });

      throw error;
    }
  }

  private mapSnapshotRun(item: {
    snapshot_run_id: string;
    snapshot_date: string;
    snapshot_type: string;
    period_start: string;
    period_end: string;
    run_status: string;
    generated_at: string;
    generated_by: string;
    started_at: string | null;
    finished_at: string | null;
    failure_reason: string | null;
    rerun_of_snapshot_run_id: string | null;
  }) {
    return {
      snapshotRunId: item.snapshot_run_id,
      snapshotDate: item.snapshot_date,
      snapshotType: item.snapshot_type,
      periodStart: item.period_start,
      periodEnd: item.period_end,
      runStatus: item.run_status,
      healthState: this.getSnapshotHealthState(item.run_status, item.generated_at),
      generatedAt: item.generated_at,
      generatedBy: item.generated_by,
      startedAt: item.started_at,
      finishedAt: item.finished_at,
      failureReason: item.failure_reason,
      rerunOfSnapshotRunId: item.rerun_of_snapshot_run_id,
    };
  }

  private getSnapshotHealthState(runStatus: string, generatedAt: string) {
    if (runStatus === "completed") return "healthy";
    if (["queued", "running"].includes(runStatus) && this.isSnapshotStuck(generatedAt)) {
      return "stuck";
    }
    if (runStatus === "queued" || runStatus === "running") return "in_progress";
    if (runStatus === "failed") return "retry_ready";
    return "needs_action";
  }

  private getSnapshotStuckBeforeIso() {
    return new Date(
      Date.now() - SnapshotService.SNAPSHOT_STUCK_THRESHOLD_MINUTES * 60 * 1000,
    ).toISOString();
  }

  private isSnapshotStuck(generatedAt: string) {
    const generatedAtMs = Date.parse(generatedAt);
    if (Number.isNaN(generatedAtMs)) {
      return false;
    }

    return Date.now() - generatedAtMs >= SnapshotService.SNAPSHOT_STUCK_THRESHOLD_MINUTES * 60 * 1000;
  }
}
