import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  SalesTargetIncentiveParticipantProjection,
  SalesTargetIncentiveProjectionStore,
} from "../application/sales-target-incentive-read-model.service";
import {
  MANAGER_RATE_TABLE_VERSION,
  PERSONNEL_RATE_TABLE_VERSION,
  SALES_TARGET_INCENTIVE_RULE_VERSION,
  SALES_TARGET_INCENTIVE_TIMEZONE,
} from "../application/sales-target-incentive-calculator.service";

type CloseClient = Pick<PoolClient, "query">;

type RuleVersionLookup = {
  rule_version_id: string;
  rule_version_code: string;
};

type RateBracketSnapshotRow = {
  rate_table_version: string;
  audience: string;
  min_achievement_pct: string;
  max_achievement_pct: string | null;
  rate: string;
  sort_order: number;
};

type CloseRunDbRow = {
  close_run_id: string;
  company_id: string;
  period_key: string;
  period_start: string;
  period_end: string;
  close_cutoff_at: string;
  status: SalesTargetIncentiveCloseRunStatus;
  started_at: string | null;
  completed_at: string | null;
  failed_reason: string | null;
  source_import_batch_ids: string[];
  final_snapshot_count: string | number;
  final_row_count: string | number;
};

export type SalesTargetIncentiveCloseRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type SalesTargetIncentiveCloseRunSummary = {
  closeRunId: string;
  companyId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  closeCutoffAt: string;
  status: SalesTargetIncentiveCloseRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  failedReason: string | null;
  sourceImportBatchIds: string[];
  finalSnapshotCount: number;
  finalRowCount: number;
};

@Injectable()
export class SalesTargetIncentiveCloseRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listCloseRuns(input: {
    periodKey: string;
    companyIds: string[];
  }): Promise<SalesTargetIncentiveCloseRunSummary[]> {
    const result = await this.databaseService.query<CloseRunDbRow>(
      `
        SELECT
          run.sales_target_incentive_close_run_id::text AS close_run_id,
          run.company_id::text AS company_id,
          run.period_key::text AS period_key,
          run.period_start::text AS period_start,
          run.period_end::text AS period_end,
          run.close_cutoff_at::text AS close_cutoff_at,
          run.status,
          run.started_at::text AS started_at,
          run.completed_at::text AS completed_at,
          run.failed_reason,
          ARRAY(
            SELECT source_batch_id::text
            FROM unnest(run.source_import_batch_ids) AS source_batch_id
          ) AS source_import_batch_ids,
          (
            SELECT COUNT(*)::int
            FROM rpt.sales_target_incentive_final_snapshot snapshot
            WHERE snapshot.close_run_id = run.sales_target_incentive_close_run_id
          ) AS final_snapshot_count,
          (
            SELECT COUNT(*)::int
            FROM rpt.sales_target_incentive_final_row row
            INNER JOIN rpt.sales_target_incentive_final_snapshot snapshot
              ON snapshot.sales_target_incentive_final_snapshot_id = row.final_snapshot_id
            WHERE snapshot.close_run_id = run.sales_target_incentive_close_run_id
          ) AS final_row_count
        FROM ops.sales_target_incentive_close_run run
        WHERE run.period_key = $1
          AND run.company_id = ANY($2::uuid[])
        ORDER BY run.close_cutoff_at DESC, run.created_at DESC
      `,
      [input.periodKey, input.companyIds],
    );

    return result.rows.map(mapCloseRunRow);
  }

  async createSucceededCloseRun(input: {
    companyId: string;
    periodKey: string;
    periodStart: string;
    periodEnd: string;
    closeCutoffAt: string;
    actorUserId: string;
    stores: SalesTargetIncentiveProjectionStore[];
  }): Promise<SalesTargetIncentiveCloseRunSummary> {
    return this.databaseService.withTransaction(async (client) => {
      const ruleVersion = await this.resolveRuleVersion(client);
      const rateBrackets = await this.listRateBrackets(client, ruleVersion.rule_version_id);
      const sourceImportBatchIds = uniqueStrings(
        input.stores.flatMap((store) => collectStoreSourceImportBatchIds(store)),
      );

      await this.lockCloseRun(client, {
        companyId: input.companyId,
        periodKey: input.periodKey,
      });
      const closeRunId = await this.insertCloseRun(client, {
        ...input,
        ruleVersionId: ruleVersion.rule_version_id,
        sourceImportBatchIds,
      });

      await this.insertRuleSnapshot(client, {
        closeRunId,
        ruleVersion,
        periodKey: input.periodKey,
        closeCutoffAt: input.closeCutoffAt,
        rateBrackets,
      });

      let finalSnapshotCount = 0;
      let finalRowCount = 0;
      for (const store of input.stores) {
        const finalSnapshotId = await this.insertFinalSnapshot(client, {
          closeRunId,
          ruleVersionId: ruleVersion.rule_version_id,
          ruleVersionCode: ruleVersion.rule_version_code,
          periodKey: input.periodKey,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          closeCutoffAt: input.closeCutoffAt,
          store,
        });
        finalSnapshotCount += 1;

        const participants = [
          ...(store.manager ? [store.manager] : []),
          ...store.personnel,
        ];
        for (const participant of participants) {
          assertFinalizableParticipant(participant);
          const assignmentSnapshotId = await this.insertAssignmentSnapshot(client, {
            closeRunId,
            periodKey: input.periodKey,
            store,
            participant,
          });
          await this.insertFinalRow(client, {
            finalSnapshotId,
            assignmentSnapshotId,
            participant,
          });
          finalRowCount += 1;
        }
      }

      return this.markCloseRunSucceeded(client, {
        closeRunId,
        finalSnapshotCount,
        finalRowCount,
      });
    });
  }

  private async resolveRuleVersion(client: CloseClient): Promise<RuleVersionLookup> {
    const result = await client.query<RuleVersionLookup>(
      `
        SELECT
          sales_target_incentive_rule_version_id::text AS rule_version_id,
          rule_version_code
        FROM ops.sales_target_incentive_rule_version
        WHERE rule_version_code = $1
          AND status = 'active'
        ORDER BY effective_from DESC, sales_target_incentive_rule_version_id DESC
        LIMIT 1
      `,
      [SALES_TARGET_INCENTIVE_RULE_VERSION],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Active incentive rule version is not configured");
    }

    return row;
  }

  private async listRateBrackets(
    client: CloseClient,
    ruleVersionId: string,
  ): Promise<RateBracketSnapshotRow[]> {
    const result = await client.query<RateBracketSnapshotRow>(
      `
        SELECT
          rate_table_version,
          audience,
          min_achievement_pct::text AS min_achievement_pct,
          max_achievement_pct::text AS max_achievement_pct,
          rate::text AS rate,
          sort_order
        FROM ops.sales_target_incentive_rate_bracket
        WHERE rule_version_id = $1::uuid
        ORDER BY audience, sort_order
      `,
      [ruleVersionId],
    );

    return result.rows;
  }

  private async lockCloseRun(
    client: CloseClient,
    input: { companyId: string; periodKey: string },
  ) {
    await client.query(
      `
        SELECT pg_advisory_xact_lock(hashtext($1)::bigint)
      `,
      [
        [
          "sales_target_incentive_close",
          input.companyId,
          input.periodKey,
        ].join(":"),
      ],
    );
  }

  private async insertCloseRun(
    client: CloseClient,
    input: {
      companyId: string;
      periodKey: string;
      periodStart: string;
      periodEnd: string;
      closeCutoffAt: string;
      actorUserId: string;
      ruleVersionId: string;
      sourceImportBatchIds: string[];
      stores: SalesTargetIncentiveProjectionStore[];
    },
  ) {
    const result = await client.query<{ close_run_id: string }>(
      `
        INSERT INTO ops.sales_target_incentive_close_run (
          company_id,
          period_key,
          period_start,
          period_end,
          period_timezone,
          close_cutoff_at,
          rule_version_id,
          status,
          started_at,
          created_by_user_id,
          source_import_batch_ids,
          source_evidence
        )
        VALUES (
          $1::uuid,
          $2,
          $3::date,
          $4::date,
          $5,
          $6::timestamptz,
          $7::uuid,
          'running',
          NOW(),
          $8::uuid,
          $9::uuid[],
          $10::jsonb
        )
        RETURNING sales_target_incentive_close_run_id::text AS close_run_id
      `,
      [
        input.companyId,
        input.periodKey,
        input.periodStart,
        input.periodEnd,
        SALES_TARGET_INCENTIVE_TIMEZONE,
        input.closeCutoffAt,
        input.ruleVersionId,
        input.actorUserId,
        input.sourceImportBatchIds,
        toJson({
          storeIds: input.stores.map((store) => store.storeId),
          sourceImportBatchIds: input.sourceImportBatchIds,
        }),
      ],
    );

    return result.rows[0].close_run_id;
  }

  private async insertRuleSnapshot(
    client: CloseClient,
    input: {
      closeRunId: string;
      ruleVersion: RuleVersionLookup;
      periodKey: string;
      closeCutoffAt: string;
      rateBrackets: RateBracketSnapshotRow[];
    },
  ) {
    await client.query(
      `
        INSERT INTO rpt.sales_target_incentive_rule_snapshot (
          close_run_id,
          rule_version_id,
          rule_version_code,
          rate_table_versions,
          period_key,
          period_timezone,
          close_cutoff_at,
          rate_brackets_json
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4::text[],
          $5,
          $6,
          $7::timestamptz,
          $8::jsonb
        )
      `,
      [
        input.closeRunId,
        input.ruleVersion.rule_version_id,
        input.ruleVersion.rule_version_code,
        [MANAGER_RATE_TABLE_VERSION, PERSONNEL_RATE_TABLE_VERSION],
        input.periodKey,
        SALES_TARGET_INCENTIVE_TIMEZONE,
        input.closeCutoffAt,
        toJson(input.rateBrackets),
      ],
    );
  }

  private async insertFinalSnapshot(
    client: CloseClient,
    input: {
      closeRunId: string;
      ruleVersionId: string;
      ruleVersionCode: string;
      periodKey: string;
      periodStart: string;
      periodEnd: string;
      closeCutoffAt: string;
      store: SalesTargetIncentiveProjectionStore;
    },
  ) {
    const sourceImportBatchIds = uniqueStrings(
      collectStoreSourceImportBatchIds(input.store),
    );
    const storeAchievementPct =
      input.store.manager?.calculation.achievementPct ??
      input.store.personnel[0]?.calculation.storeAchievementPct ??
      null;
    const storeGatePassed = input.store.personnel.some(
      (participant) => participant.calculation.storeGatePassed === true,
    );
    const result = await client.query<{ final_snapshot_id: string }>(
      `
        INSERT INTO rpt.sales_target_incentive_final_snapshot (
          close_run_id,
          company_id,
          region_id,
          store_id,
          period_key,
          period_start,
          period_end,
          period_timezone,
          close_cutoff_at,
          store_type,
          rule_version_id,
          rule_version_code,
          manager_rate_table_version,
          personnel_rate_table_version,
          store_target_request_id,
          store_target_amount,
          store_net_sales_amount,
          store_achievement_pct,
          store_gate_passed,
          source_import_batch_ids,
          source_evidence
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5,
          $6::date,
          $7::date,
          $8,
          $9::timestamptz,
          'company',
          $10::uuid,
          $11,
          $12,
          $13,
          $14::uuid,
          $15::numeric,
          $16::numeric,
          $17::numeric,
          $18::boolean,
          $19::uuid[],
          $20::jsonb
        )
        RETURNING sales_target_incentive_final_snapshot_id::text AS final_snapshot_id
      `,
      [
        input.closeRunId,
        input.store.companyId,
        input.store.regionId,
        input.store.storeId,
        input.periodKey,
        input.periodStart,
        input.periodEnd,
        SALES_TARGET_INCENTIVE_TIMEZONE,
        input.closeCutoffAt,
        input.ruleVersionId,
        input.ruleVersionCode,
        MANAGER_RATE_TABLE_VERSION,
        PERSONNEL_RATE_TABLE_VERSION,
        input.store.storeTargetRequestId,
        input.store.storeTargetAmount,
        input.store.storeNetSalesAmount,
        storeAchievementPct,
        storeGatePassed,
        sourceImportBatchIds,
        toJson({
          storeTargetRequestId: input.store.storeTargetRequestId,
          storeNetSalesSourceBatchId: input.store.storeNetSalesSourceBatchId,
          storeNetSalesImportBatchId: input.store.storeNetSalesImportBatchId,
          storeNetSalesLastSyncedAt: input.store.storeNetSalesLastSyncedAt,
        }),
      ],
    );

    return result.rows[0].final_snapshot_id;
  }

  private async insertAssignmentSnapshot(
    client: CloseClient,
    input: {
      closeRunId: string;
      periodKey: string;
      store: SalesTargetIncentiveProjectionStore;
      participant: SalesTargetIncentiveParticipantProjection;
    },
  ) {
    const result = await client.query<{ assignment_snapshot_id: string }>(
      `
        INSERT INTO rpt.sales_target_incentive_assignment_snapshot (
          close_run_id,
          company_id,
          region_id,
          store_id,
          employee_id,
          user_id,
          source_assignment_id,
          position_id,
          position_code,
          normalized_from_position_code,
          period_key,
          period_timezone,
          assignment_started_on,
          assignment_ended_on,
          source_evidence
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::uuid,
          $6::uuid,
          $7::uuid,
          $8::uuid,
          $9,
          $10,
          $11,
          $12,
          $13::date,
          $14::date,
          $15::jsonb
        )
        RETURNING sales_target_incentive_assignment_snapshot_id::text AS assignment_snapshot_id
      `,
      [
        input.closeRunId,
        input.store.companyId,
        input.store.regionId,
        input.store.storeId,
        input.participant.employeeId,
        input.participant.userId,
        input.participant.assignmentId,
        input.participant.positionId,
        input.participant.positionCode,
        input.participant.normalizedFromPositionCode,
        input.periodKey,
        SALES_TARGET_INCENTIVE_TIMEZONE,
        input.participant.assignmentStartedOn,
        input.participant.assignmentEndedOn,
        toJson({
          assignmentId: input.participant.assignmentId,
          participantType: input.participant.participantType,
          positionCode: input.participant.positionCode,
        }),
      ],
    );

    return result.rows[0].assignment_snapshot_id;
  }

  private async insertFinalRow(
    client: CloseClient,
    input: {
      finalSnapshotId: string;
      assignmentSnapshotId: string;
      participant: SalesTargetIncentiveParticipantProjection;
    },
  ) {
    const calculation = input.participant.calculation;
    const sourceImportBatchIds = uniqueStrings([
      input.participant.source.storeNetSalesImportBatchId,
      input.participant.source.personnelSalesImportBatchId,
    ]);
    await client.query(
      `
        INSERT INTO rpt.sales_target_incentive_final_row (
          final_snapshot_id,
          assignment_snapshot_id,
          employee_id,
          user_id,
          participant_type,
          position_code,
          normalized_from_position_code,
          rate_table_version,
          target_reference_id,
          target_amount,
          actual_sales_amount,
          achievement_pct,
          applied_rate_bracket_id,
          applied_rate,
          raw_earned_amount,
          payable_amount,
          correction_amount,
          adjustment_amount,
          final_amount,
          calculation_status,
          source_import_batch_ids,
          source_evidence
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5,
          $6,
          $7,
          $8,
          $9::uuid,
          $10::numeric,
          $11::numeric,
          $12::numeric,
          NULL,
          $13::numeric,
          $14::numeric,
          $15::numeric,
          0,
          0,
          $16::numeric,
          'finalized',
          $17::uuid[],
          $18::jsonb
        )
      `,
      [
        input.finalSnapshotId,
        input.assignmentSnapshotId,
        input.participant.employeeId,
        input.participant.userId,
        input.participant.participantType,
        input.participant.positionCode,
        input.participant.normalizedFromPositionCode,
        calculation.rateTableVersion,
        input.participant.targetReferenceId,
        input.participant.targetAmount,
        input.participant.actualAmount,
        calculation.achievementPct,
        calculation.rate,
        calculation.rawEarnedAmount,
        calculation.payableAmount,
        calculation.payableAmount,
        sourceImportBatchIds,
        toJson({
          storeTargetRequestId: input.participant.source.storeTargetRequestId,
          storeNetSalesSourceBatchId: input.participant.source.storeNetSalesSourceBatchId,
          storeNetSalesImportBatchId: input.participant.source.storeNetSalesImportBatchId,
          personnelSalesSourceBatchId: input.participant.source.personnelSalesSourceBatchId,
          personnelSalesImportBatchId: input.participant.source.personnelSalesImportBatchId,
        }),
      ],
    );
  }

  private async markCloseRunSucceeded(
    client: CloseClient,
    input: {
      closeRunId: string;
      finalSnapshotCount: number;
      finalRowCount: number;
    },
  ) {
    const result = await client.query<CloseRunDbRow>(
      `
        UPDATE ops.sales_target_incentive_close_run run
        SET status = 'succeeded',
            completed_at = NOW()
        WHERE run.sales_target_incentive_close_run_id = $1::uuid
        RETURNING
          run.sales_target_incentive_close_run_id::text AS close_run_id,
          run.company_id::text AS company_id,
          run.period_key::text AS period_key,
          run.period_start::text AS period_start,
          run.period_end::text AS period_end,
          run.close_cutoff_at::text AS close_cutoff_at,
          run.status,
          run.started_at::text AS started_at,
          run.completed_at::text AS completed_at,
          run.failed_reason,
          ARRAY(
            SELECT source_batch_id::text
            FROM unnest(run.source_import_batch_ids) AS source_batch_id
          ) AS source_import_batch_ids,
          $2::int AS final_snapshot_count,
          $3::int AS final_row_count
      `,
      [input.closeRunId, input.finalSnapshotCount, input.finalRowCount],
    );

    return mapCloseRunRow(result.rows[0]);
  }
}

function assertFinalizableParticipant(participant: SalesTargetIncentiveParticipantProjection) {
  if (
    participant.calculation.status !== "projected" ||
    participant.calculation.payableAmount === null ||
    participant.assignmentStartedOn === null
  ) {
    throw new Error("Incentive participant is not finalizable");
  }
}

function collectStoreSourceImportBatchIds(store: SalesTargetIncentiveProjectionStore) {
  return [
    store.storeNetSalesImportBatchId,
    ...(store.manager ? collectParticipantSourceImportBatchIds(store.manager) : []),
    ...store.personnel.flatMap((participant) =>
      collectParticipantSourceImportBatchIds(participant),
    ),
  ];
}

function collectParticipantSourceImportBatchIds(
  participant: SalesTargetIncentiveParticipantProjection,
) {
  return [
    participant.source.storeNetSalesImportBatchId,
    participant.source.personnelSalesImportBatchId,
  ];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function mapCloseRunRow(row: CloseRunDbRow): SalesTargetIncentiveCloseRunSummary {
  return {
    closeRunId: row.close_run_id,
    companyId: row.company_id,
    periodKey: row.period_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    closeCutoffAt: row.close_cutoff_at,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedReason: row.failed_reason,
    sourceImportBatchIds: row.source_import_batch_ids ?? [],
    finalSnapshotCount: Number(row.final_snapshot_count),
    finalRowCount: Number(row.final_row_count),
  };
}

function toJson(value: unknown) {
  return JSON.stringify(value);
}
