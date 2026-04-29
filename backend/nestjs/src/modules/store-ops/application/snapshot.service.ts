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
import { KpiConfigRepository } from "../infrastructure/kpi-config.repository";
import {
  KpiScoreProfile,
  personnelKpiScoreProfile,
} from "./kpi-config.contract";
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";

type SnapshotClient = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: T[] }>;
};

@Injectable()
export class SnapshotService {
  private static readonly SNAPSHOT_STUCK_THRESHOLD_MINUTES = 60;
  private readonly logger = new Logger(SnapshotService.name);
  private readonly kpiBenchmarkScoringService = new KpiBenchmarkScoringService();

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(JOB_DISPATCHER)
    private readonly jobDispatcher: JobDispatcher,
    private readonly snapshotOperationsRepository: SnapshotOperationsRepository,
    private readonly kpiConfigRepository: KpiConfigRepository,
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

      const latestKpiConfigVersion = await this.getLatestKpiConfigVersion(client);
      const run = await this.snapshotOperationsRepository.createSnapshotRun(
        {
          snapshotType: input.snapshotType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          actorUserId: input.actorUserId,
          idempotencyKey,
          kpiConfigVersionId: latestKpiConfigVersion?.kpi_config_version_id ?? null,
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
            kpiConfigVersionId: latestKpiConfigVersion?.kpi_config_version_id ?? null,
            versionNo: latestKpiConfigVersion?.version_no ?? null,
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
      const latestKpiConfigVersion = existing.kpi_config_version_id
        ? null
        : await this.getLatestKpiConfigVersion(client);
      const kpiConfigVersionId =
        existing.kpi_config_version_id ?? latestKpiConfigVersion?.kpi_config_version_id ?? null;
      const versionNo =
        existing.kpi_config_version_no ?? latestKpiConfigVersion?.version_no ?? null;
      const newRun = await this.snapshotOperationsRepository.createSnapshotRun(
        {
          snapshotType: existing.snapshot_type,
          periodStart: existing.period_start,
          periodEnd: existing.period_end,
          actorUserId,
          idempotencyKey: `${snapshotRunId}:rerun:${new Date().toISOString()}`,
          rerunOfSnapshotRunId: snapshotRunId,
          kpiConfigVersionId,
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
            kpiConfigVersionId,
            versionNo,
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
            kpiConfigVersionId,
            versionNo,
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
      const snapshotRun =
        await this.snapshotOperationsRepository.findSnapshotRunById(snapshotRunId);
      const personnelProfile = snapshotRun?.snapshot_type === "daily"
        ? await this.getPersonnelProfileForSnapshotRun(snapshotRun)
        : null;

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
        if (personnelProfile) {
          await this.materializeEmployeePerformanceSnapshot(
            client,
            snapshotRunId,
            periodStart,
            periodEnd,
            personnelProfile,
          );
        }
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
    kpi_config_version_id?: string | null;
    kpi_config_version_no?: number | null;
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
      kpiConfigVersion: {
        kpiConfigVersionId: item.kpi_config_version_id ?? null,
        versionNo: item.kpi_config_version_no ?? null,
        state: item.kpi_config_version_id ? "versioned" : "pre_governance",
      },
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

  private async getLatestKpiConfigVersion(client?: SnapshotClient) {
    try {
      return await this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(client);
    } catch {
      return null;
    }
  }

  private async getPersonnelProfileForSnapshotRun(snapshotRun: {
    kpi_config_version_id?: string | null;
  }) {
    try {
      if (snapshotRun.kpi_config_version_id) {
        const version = await this.kpiConfigRepository.getKpiConfigVersionById(
          snapshotRun.kpi_config_version_id,
        );
        const profile = version?.config_payload?.personnelProfile;
        if (profile) {
          return profile as KpiScoreProfile;
        }
      }

      const rows = await this.kpiConfigRepository.getKpiConfigRows();
      const profileRow = rows.find((row) => row.config_key === "personnel_profile");
      if (profileRow) {
        return profileRow.config_payload as KpiScoreProfile;
      }
    } catch {
      // Fall back to in-code defaults for local or partially configured environments.
    }

    return personnelKpiScoreProfile;
  }

  private async materializeEmployeePerformanceSnapshot(
    client: SnapshotClient,
    snapshotRunId: string,
    periodStart: string,
    periodEnd: string,
    profile: KpiScoreProfile,
  ) {
    const metricCodes = profile.metrics.map((metric) => metric.code);
    if (metricCodes.length === 0) {
      return;
    }

    const rows = await client.query<{
      employee_id: string;
      store_id: string | null;
      kpi_id: string;
      kpi_code: string;
      actual_value: string;
    }>(
      `
        SELECT
          ka.employee_id,
          ka.store_id,
          kd.kpi_id,
          kd.kpi_code,
          SUM(ka.actual_value)::text AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ka.scope_type = 'employee'
          AND kd.kpi_code = ANY($1::text[])
          AND ka.period_start >= $2::date
          AND ka.period_end <= $3::date
        GROUP BY ka.employee_id, ka.store_id, kd.kpi_id, kd.kpi_code
      `,
      [metricCodes, periodStart, periodEnd],
    );

    await client.query(
      `DELETE FROM rpt.employee_kpi_snapshot WHERE snapshot_run_id = $1::uuid`,
      [snapshotRunId],
    );
    await client.query(
      `DELETE FROM rpt.employee_performance_snapshot WHERE snapshot_run_id = $1::uuid`,
      [snapshotRunId],
    );

    if (rows.rows.length === 0) {
      return;
    }

    const benchmarkRows = await client.query<{
      kpi_code: string;
      benchmark_value: string | null;
    }>(
      `
        WITH scoped_actual AS (
          SELECT
            ka.employee_id,
            kd.kpi_code,
            SUM(ka.actual_value) AS actual_value
          FROM ops.kpi_actual ka
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = ka.kpi_id
          WHERE ka.scope_type = 'employee'
            AND ka.period_start >= $1::date
            AND ka.period_end <= $2::date
          GROUP BY ka.employee_id, kd.kpi_code
        )
        SELECT 'ATV' AS kpi_code,
               (SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual net_sales
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.employee_id = net_sales.employee_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE net_sales.kpi_code = 'NET_SALES'
        UNION ALL
        SELECT 'UPT' AS kpi_code,
               (SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual item_count
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.employee_id = item_count.employee_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE item_count.kpi_code = 'ITEM_COUNT'
      `,
      [periodStart, periodEnd],
    );
    const benchmarkLookup = new Map(
      benchmarkRows.rows.map((row) => [
        row.kpi_code,
        row.benchmark_value !== null ? Number(row.benchmark_value) : null,
      ]),
    );

    for (const row of rows.rows) {
      await client.query(
        `
          INSERT INTO rpt.employee_kpi_snapshot (
            snapshot_run_id,
            employee_id,
            store_id,
            kpi_id,
            period_start,
            period_end,
            actual_value
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, $6::date, $7::numeric)
        `,
        [
          snapshotRunId,
          row.employee_id,
          row.store_id,
          row.kpi_id,
          periodStart,
          periodEnd,
          row.actual_value,
        ],
      );
    }

    const metricLookupByEmployee = new Map<
      string,
      {
        storeId: string | null;
        values: Record<string, number>;
      }
    >();

    rows.rows.forEach((row) => {
      const current = metricLookupByEmployee.get(row.employee_id) ?? {
        storeId: row.store_id,
        values: {},
      };
      current.storeId = current.storeId ?? row.store_id;
      current.values[row.kpi_code] = Number(row.actual_value);
      metricLookupByEmployee.set(row.employee_id, current);
    });

    const scoreRows = [...metricLookupByEmployee.entries()].map(([employeeId, value]) => {
      const score = profile.metrics.reduce((sum, metric) => {
        const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
        const matchedCode = matchingCodes.find(
          (code) => typeof value.values[code] === "number",
        );
        const actualValue = matchedCode ? value.values[matchedCode] : null;
        const benchmarkSource =
          metric.benchmarkSource ??
          (metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : "TURKEY_AVERAGE");
        const benchmarkValue =
          benchmarkSource === "TURKEY_AVERAGE" && matchedCode
            ? benchmarkLookup.get(matchedCode) ?? null
            : null;
        const metricScore = this.kpiBenchmarkScoringService.scoreMetric({
          metricCode: metric.code,
          actualValue,
          benchmarkValue,
          targetValue: null,
          weightPercent: metric.weightPercent,
          direction: metric.direction ?? "HIGHER_IS_BETTER",
          benchmarkSource,
          capRatio: metric.capRatio ?? 1.2,
        });

        return sum + (metricScore.scoreContribution ?? 0);
      }, 0);

      const matchedMetrics = profile.metrics.filter((metric) => {
        const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
        const matchedCode = matchingCodes.find(
          (code) => typeof value.values[code] === "number",
        );
        const actualValue = matchedCode ? value.values[matchedCode] : null;
        const benchmarkSource =
          metric.benchmarkSource ??
          (metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : "TURKEY_AVERAGE");
        const benchmarkValue =
          benchmarkSource === "TURKEY_AVERAGE" && matchedCode
            ? benchmarkLookup.get(matchedCode) ?? null
            : null;

        return (
          this.kpiBenchmarkScoringService.scoreMetric({
            metricCode: metric.code,
            actualValue,
            benchmarkValue,
            targetValue: null,
            weightPercent: metric.weightPercent,
            direction: metric.direction ?? "HIGHER_IS_BETTER",
            benchmarkSource,
            capRatio: metric.capRatio ?? 1.2,
          }).scoreStatus === "scored"
        );
      }).length;

      return {
        employeeId,
        storeId: value.storeId,
        scoreValue: Number(score.toFixed(4)),
        matchedMetrics,
      };
    });

    const turkeyPopulation = scoreRows.length;
    const turkeyRanks = [...scoreRows]
      .sort((left, right) => right.scoreValue - left.scoreValue)
      .map((row, index) => ({
        employeeId: row.employeeId,
        rank: index + 1,
      }));
    const turkeyRankLookup = new Map(turkeyRanks.map((row) => [row.employeeId, row.rank]));

    const storeRankLookup = new Map<string, { rank: number; population: number }>();
    const byStore = new Map<string, typeof scoreRows>();
    scoreRows.forEach((row) => {
      const key = row.storeId ?? "unassigned";
      const current = byStore.get(key) ?? [];
      current.push(row);
      byStore.set(key, current);
    });
    byStore.forEach((rowsForStore) => {
      const ranked = [...rowsForStore].sort((left, right) => right.scoreValue - left.scoreValue);
      ranked.forEach((row, index) => {
        storeRankLookup.set(row.employeeId, {
          rank: index + 1,
          population: ranked.length,
        });
      });
    });

    for (const row of scoreRows) {
      const storeRank = storeRankLookup.get(row.employeeId);
      await client.query(
        `
          INSERT INTO rpt.employee_performance_snapshot (
            snapshot_run_id,
            employee_id,
            store_id,
            period_start,
            period_end,
            score_value,
            matched_metrics,
            total_metrics,
            turkey_rank,
            turkey_population,
            store_rank,
            store_population
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::date,
            $5::date,
            $6::numeric,
            $7::integer,
            $8::integer,
            $9::integer,
            $10::integer,
            $11::integer,
            $12::integer
          )
        `,
        [
          snapshotRunId,
          row.employeeId,
          row.storeId,
          periodStart,
          periodEnd,
          row.scoreValue,
          row.matchedMetrics,
          profile.metrics.length,
          turkeyRankLookup.get(row.employeeId) ?? null,
          turkeyPopulation,
          storeRank?.rank ?? null,
          storeRank?.population ?? 0,
        ],
      );
    }
  }
}
