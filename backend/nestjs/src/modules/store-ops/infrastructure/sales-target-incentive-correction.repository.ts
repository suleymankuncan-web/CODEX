import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
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

type CorrectionClient = Pick<PoolClient, "query">;

export type SalesTargetIncentiveCorrectionPhase =
  | "pre_close"
  | "post_close";

export type SalesTargetIncentiveCorrectionResult = {
  adjustmentId: string;
  phase: SalesTargetIncentiveCorrectionPhase;
  adjustmentScope: "projection" | "final_snapshot";
  adjustmentType: "correction" | "manual_adjustment";
  periodKey: string;
  storeId: string;
  employeeId: string;
  participantType: "store_manager" | "personnel";
  beforeAmount: string;
  adjustmentAmount: string;
  afterAmount: string;
  status: "approved";
};

export type SalesTargetIncentiveAdjustmentSummaryRow = {
  store_id: string;
  employee_id: string;
  participant_type: "store_manager" | "personnel";
  correction_amount: string;
  adjustment_amount: string;
  final_amount: string | null;
};

type FinalRowLookup = {
  final_row_id: string;
  final_amount: string;
};

type CurrentAmountLookup = {
  current_amount: string;
};

@Injectable()
export class SalesTargetIncentiveCorrectionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async applyAdminCorrection(input: {
    periodKey: string;
    periodStart: string;
    periodEnd: string;
    store: SalesTargetIncentiveProjectionStore;
    participant: SalesTargetIncentiveParticipantProjection;
    adjustmentAmount: string;
    reasonCode: string;
    reasonNote: string;
    actorUserId: string;
  }): Promise<SalesTargetIncentiveCorrectionResult> {
    return this.databaseService.withTransaction(async (client) => {
      const ruleVersionId = await this.resolveRuleVersionId(client);
      const finalRow = await this.findFinalRow(client, {
        periodKey: input.periodKey,
        storeId: input.store.storeId,
        employeeId: input.participant.employeeId,
        participantType: input.participant.participantType,
      });

      const baseAmount = finalRow?.final_amount ?? input.participant.calculation.payableAmount;
      if (baseAmount === null) {
        throw new Error("Correction target is not payable");
      }

      const adjustmentScope = finalRow ? "final_snapshot" : "projection";
      const adjustmentType = finalRow ? "manual_adjustment" : "correction";
      const projectionRowId = finalRow
        ? null
        : await this.upsertProjectionRow(client, {
            periodKey: input.periodKey,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            ruleVersionId,
            store: input.store,
            participant: input.participant,
          });
      const currentAmount = await this.resolveCurrentAmount(client, {
        periodKey: input.periodKey,
        storeId: input.store.storeId,
        employeeId: input.participant.employeeId,
        participantType: input.participant.participantType,
        adjustmentScope,
        adjustmentType,
        baseAmount,
      });

      const adjustment = await this.insertApprovedAdjustment(client, {
        ruleVersionId,
        periodKey: input.periodKey,
        store: input.store,
        participant: input.participant,
        projectionRowId,
        finalRowId: finalRow?.final_row_id ?? null,
        adjustmentScope,
        adjustmentType,
        adjustmentAmount: input.adjustmentAmount,
        beforeAmount: currentAmount,
        reasonCode: input.reasonCode,
        reasonNote: input.reasonNote,
        actorUserId: input.actorUserId,
      });

      await this.insertAuditEvent(client, {
        actorUserId: input.actorUserId,
        adjustmentId: adjustment.adjustmentId,
        companyId: input.store.companyId,
        regionId: input.store.regionId,
        storeId: input.store.storeId,
        periodKey: input.periodKey,
        phase: adjustment.phase,
        participantType: input.participant.participantType,
        reasonCode: input.reasonCode,
      });

      return adjustment;
    });
  }

  async listApprovedAdjustmentSummaries(input: {
    periodKey: string;
    storeIds: string[];
  }) {
    if (input.storeIds.length === 0) {
      return [];
    }

    const result =
      await this.databaseService.query<SalesTargetIncentiveAdjustmentSummaryRow>(
        `
          SELECT
            adjustment.store_id::text AS store_id,
            adjustment.employee_id::text AS employee_id,
            COALESCE(projection_row.participant_type, final_row.participant_type) AS participant_type,
            COALESCE(SUM(adjustment.adjustment_amount) FILTER (
              WHERE adjustment.adjustment_scope = 'projection'
                AND adjustment.adjustment_type = 'correction'
            ), 0)::text AS correction_amount,
            COALESCE(SUM(adjustment.adjustment_amount) FILTER (
              WHERE adjustment.adjustment_scope = 'final_snapshot'
                AND adjustment.adjustment_type = 'manual_adjustment'
            ), 0)::text AS adjustment_amount,
            MAX(final_row.final_amount)::text AS final_amount
          FROM ops.sales_target_incentive_adjustment adjustment
          LEFT JOIN ops.sales_target_incentive_projection_row projection_row
            ON projection_row.sales_target_incentive_projection_row_id = adjustment.projection_row_id
          LEFT JOIN rpt.sales_target_incentive_final_row final_row
            ON final_row.sales_target_incentive_final_row_id = adjustment.final_row_id
          WHERE adjustment.period_key = $1
            AND adjustment.store_id = ANY($2::uuid[])
            AND adjustment.status = 'approved'
          GROUP BY adjustment.store_id, adjustment.employee_id, COALESCE(projection_row.participant_type, final_row.participant_type)
        `,
        [input.periodKey, input.storeIds],
      );

    return result.rows;
  }

  private async resolveRuleVersionId(client: CorrectionClient) {
    const result = await client.query<{ rule_version_id: string }>(
      `
        SELECT sales_target_incentive_rule_version_id::text AS rule_version_id
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

    return row.rule_version_id;
  }

  private async findFinalRow(
    client: CorrectionClient,
    input: {
      periodKey: string;
      storeId: string;
      employeeId: string;
      participantType: "store_manager" | "personnel";
    },
  ): Promise<FinalRowLookup | null> {
    const result = await client.query<FinalRowLookup>(
      `
        SELECT
          row.sales_target_incentive_final_row_id::text AS final_row_id,
          row.final_amount::text AS final_amount
        FROM rpt.sales_target_incentive_final_row row
        INNER JOIN rpt.sales_target_incentive_final_snapshot snapshot
          ON snapshot.sales_target_incentive_final_snapshot_id = row.final_snapshot_id
        WHERE snapshot.period_key = $1
          AND snapshot.store_id = $2::uuid
          AND row.employee_id = $3::uuid
          AND row.participant_type = $4
        ORDER BY snapshot.close_cutoff_at DESC, row.created_at DESC
        LIMIT 1
      `,
      [input.periodKey, input.storeId, input.employeeId, input.participantType],
    );

    return result.rows[0] ?? null;
  }

  private async resolveCurrentAmount(
    client: CorrectionClient,
    input: {
      periodKey: string;
      storeId: string;
      employeeId: string;
      participantType: "store_manager" | "personnel";
      adjustmentScope: "projection" | "final_snapshot";
      adjustmentType: "correction" | "manual_adjustment";
      baseAmount: string;
    },
  ) {
    const result = await client.query<CurrentAmountLookup>(
      `
        SELECT (
          $5::numeric + COALESCE(SUM(adjustment.adjustment_amount), 0)
        )::text AS current_amount
        FROM ops.sales_target_incentive_adjustment adjustment
        LEFT JOIN ops.sales_target_incentive_projection_row projection_row
          ON projection_row.sales_target_incentive_projection_row_id = adjustment.projection_row_id
        LEFT JOIN rpt.sales_target_incentive_final_row final_row
          ON final_row.sales_target_incentive_final_row_id = adjustment.final_row_id
        WHERE adjustment.period_key = $1
          AND adjustment.store_id = $2::uuid
          AND adjustment.employee_id = $3::uuid
          AND COALESCE(projection_row.participant_type, final_row.participant_type) = $4
          AND adjustment.adjustment_scope = $6
          AND adjustment.adjustment_type = $7
          AND adjustment.status = 'approved'
      `,
      [
        input.periodKey,
        input.storeId,
        input.employeeId,
        input.participantType,
        input.baseAmount,
        input.adjustmentScope,
        input.adjustmentType,
      ],
    );

    return result.rows[0]?.current_amount ?? input.baseAmount;
  }

  private async upsertProjectionRow(
    client: CorrectionClient,
    input: {
      periodKey: string;
      periodStart: string;
      periodEnd: string;
      ruleVersionId: string;
      store: SalesTargetIncentiveProjectionStore;
      participant: SalesTargetIncentiveParticipantProjection;
    },
  ) {
    const projectionResult = await client.query<{ projection_id: string }>(
      `
        INSERT INTO ops.sales_target_incentive_projection (
          company_id,
          region_id,
          store_id,
          period_key,
          period_start,
          period_end,
          period_timezone,
          store_type,
          rule_version_id,
          manager_rate_table_version,
          personnel_rate_table_version,
          calculation_status,
          blocked_reason,
          store_target_request_id,
          store_target_amount,
          store_net_sales_amount,
          store_achievement_pct,
          store_gate_passed,
          manager_rate,
          manager_raw_earned_amount,
          manager_payable_amount,
          source_import_batch_ids,
          source_evidence,
          projected_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5::date,
          $6::date,
          $7,
          'company',
          $8::uuid,
          $9,
          $10,
          $11,
          $12,
          $13::uuid,
          $14::numeric,
          $15::numeric,
          $16::numeric,
          $17,
          $18::numeric,
          $19::numeric,
          $20::numeric,
          $21::uuid[],
          $22::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (store_id, period_key)
        DO UPDATE SET
          rule_version_id = EXCLUDED.rule_version_id,
          manager_rate_table_version = EXCLUDED.manager_rate_table_version,
          personnel_rate_table_version = EXCLUDED.personnel_rate_table_version,
          calculation_status = EXCLUDED.calculation_status,
          blocked_reason = EXCLUDED.blocked_reason,
          store_target_request_id = EXCLUDED.store_target_request_id,
          store_target_amount = EXCLUDED.store_target_amount,
          store_net_sales_amount = EXCLUDED.store_net_sales_amount,
          store_achievement_pct = EXCLUDED.store_achievement_pct,
          store_gate_passed = EXCLUDED.store_gate_passed,
          manager_rate = EXCLUDED.manager_rate,
          manager_raw_earned_amount = EXCLUDED.manager_raw_earned_amount,
          manager_payable_amount = EXCLUDED.manager_payable_amount,
          source_import_batch_ids = EXCLUDED.source_import_batch_ids,
          source_evidence = EXCLUDED.source_evidence,
          projected_at = NOW(),
          updated_at = NOW()
        RETURNING sales_target_incentive_projection_id::text AS projection_id
      `,
      [
        input.store.companyId,
        input.store.regionId,
        input.store.storeId,
        input.periodKey,
        input.periodStart,
        input.periodEnd,
        SALES_TARGET_INCENTIVE_TIMEZONE,
        input.ruleVersionId,
        MANAGER_RATE_TABLE_VERSION,
        PERSONNEL_RATE_TABLE_VERSION,
        input.store.manager?.calculation.status ?? "no_source",
        input.store.manager?.calculation.blockedReason ?? null,
        input.store.storeTargetRequestId,
        input.store.storeTargetAmount,
        input.store.storeNetSalesAmount,
        input.store.manager?.calculation.achievementPct ?? input.participant.calculation.storeAchievementPct,
        input.store.personnel[0]?.calculation.storeGatePassed ?? false,
        input.store.manager?.calculation.rate,
        input.store.manager?.calculation.rawEarnedAmount,
        input.store.manager?.calculation.payableAmount,
        compactUuidArray([input.store.storeNetSalesSourceBatchId]),
        JSON.stringify({
          source: "current_projection",
          storeNetSalesSourceBatchId: input.store.storeNetSalesSourceBatchId,
        }),
      ],
    );

    const projectionId = projectionResult.rows[0]?.projection_id;
    if (!projectionId) {
      throw new Error("Unable to persist incentive projection");
    }

    const rowResult = await client.query<{ projection_row_id: string }>(
      `
        INSERT INTO ops.sales_target_incentive_projection_row (
          projection_id,
          employee_id,
          position_code,
          normalized_from_position_code,
          participant_type,
          calculation_status,
          blocked_reason,
          personnel_target_reference_id,
          personnel_target_amount,
          personnel_positive_sales_amount,
          personnel_achievement_pct,
          personal_rate_before_gate,
          applied_rate,
          raw_earned_amount,
          payable_amount,
          source_import_batch_ids,
          source_evidence,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::uuid,
          $9::numeric,
          $10::numeric,
          $11::numeric,
          $12::numeric,
          $13::numeric,
          COALESCE($14::numeric, 0),
          COALESCE($15::numeric, 0),
          $16::uuid[],
          $17::jsonb,
          NOW()
        )
        ON CONFLICT (projection_id, employee_id, participant_type)
        DO UPDATE SET
          position_code = EXCLUDED.position_code,
          normalized_from_position_code = EXCLUDED.normalized_from_position_code,
          calculation_status = EXCLUDED.calculation_status,
          blocked_reason = EXCLUDED.blocked_reason,
          personnel_target_reference_id = EXCLUDED.personnel_target_reference_id,
          personnel_target_amount = EXCLUDED.personnel_target_amount,
          personnel_positive_sales_amount = EXCLUDED.personnel_positive_sales_amount,
          personnel_achievement_pct = EXCLUDED.personnel_achievement_pct,
          personal_rate_before_gate = EXCLUDED.personal_rate_before_gate,
          applied_rate = EXCLUDED.applied_rate,
          raw_earned_amount = EXCLUDED.raw_earned_amount,
          payable_amount = EXCLUDED.payable_amount,
          source_import_batch_ids = EXCLUDED.source_import_batch_ids,
          source_evidence = EXCLUDED.source_evidence,
          updated_at = NOW()
        RETURNING sales_target_incentive_projection_row_id::text AS projection_row_id
      `,
      [
        projectionId,
        input.participant.employeeId,
        input.participant.positionCode,
        input.participant.normalizedFromPositionCode,
        input.participant.participantType,
        input.participant.calculation.status,
        input.participant.calculation.blockedReason,
        input.participant.targetReferenceId,
        input.participant.targetAmount,
        input.participant.participantType === "personnel" ? input.participant.actualAmount : null,
        input.participant.calculation.achievementPct,
        input.participant.calculation.personalRateBeforeGate,
        input.participant.calculation.rate,
        input.participant.calculation.rawEarnedAmount,
        input.participant.calculation.payableAmount,
        compactUuidArray([
          input.participant.source.storeNetSalesSourceBatchId,
          input.participant.source.personnelSalesSourceBatchId,
        ]),
        JSON.stringify({
          source: "current_projection",
          storeTargetRequestId: input.participant.source.storeTargetRequestId,
          storeNetSalesSourceBatchId: input.participant.source.storeNetSalesSourceBatchId,
          personnelSalesSourceBatchId: input.participant.source.personnelSalesSourceBatchId,
        }),
      ],
    );

    const projectionRowId = rowResult.rows[0]?.projection_row_id;
    if (!projectionRowId) {
      throw new Error("Unable to persist incentive projection row");
    }

    return projectionRowId;
  }

  private async insertApprovedAdjustment(
    client: CorrectionClient,
    input: {
      ruleVersionId: string;
      periodKey: string;
      store: SalesTargetIncentiveProjectionStore;
      participant: SalesTargetIncentiveParticipantProjection;
      projectionRowId: string | null;
      finalRowId: string | null;
      adjustmentScope: "projection" | "final_snapshot";
      adjustmentType: "correction" | "manual_adjustment";
      adjustmentAmount: string;
      beforeAmount: string;
      reasonCode: string;
      reasonNote: string;
      actorUserId: string;
    },
  ): Promise<SalesTargetIncentiveCorrectionResult> {
    const phase: SalesTargetIncentiveCorrectionPhase =
      input.adjustmentScope === "projection" ? "pre_close" : "post_close";
    const result = await client.query<{
      adjustment_id: string;
      before_amount: string;
      adjustment_amount: string;
      after_amount: string;
    }>(
      `
        INSERT INTO ops.sales_target_incentive_adjustment (
          company_id,
          region_id,
          store_id,
          employee_id,
          projection_row_id,
          final_row_id,
          rule_version_id,
          period_key,
          period_timezone,
          adjustment_scope,
          adjustment_type,
          adjustment_amount,
          before_amount,
          after_amount,
          reason_code,
          reason_note,
          status,
          created_by_user_id,
          approved_by_user_id,
          approved_at,
          evidence,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::uuid,
          $6::uuid,
          $7::uuid,
          $8,
          $9,
          $10,
          $11,
          $12::numeric,
          $13::numeric,
          ($13::numeric + $12::numeric),
          $14,
          $15,
          'approved',
          $16::uuid,
          $16::uuid,
          NOW(),
          $17::jsonb,
          NOW()
        )
        RETURNING
          sales_target_incentive_adjustment_id::text AS adjustment_id,
          before_amount::text AS before_amount,
          adjustment_amount::text AS adjustment_amount,
          after_amount::text AS after_amount
      `,
      [
        input.store.companyId,
        input.store.regionId,
        input.store.storeId,
        input.participant.employeeId,
        input.projectionRowId,
        input.finalRowId,
        input.ruleVersionId,
        input.periodKey,
        SALES_TARGET_INCENTIVE_TIMEZONE,
        input.adjustmentScope,
        input.adjustmentType,
        input.adjustmentAmount,
        input.beforeAmount,
        input.reasonCode,
        input.reasonNote,
        input.actorUserId,
        JSON.stringify({
          source: "admin_manual_correction_v1",
          phase,
          participantType: input.participant.participantType,
        }),
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Unable to persist incentive correction");
    }

    return {
      adjustmentId: row.adjustment_id,
      phase,
      adjustmentScope: input.adjustmentScope,
      adjustmentType: input.adjustmentType,
      periodKey: input.periodKey,
      storeId: input.store.storeId,
      employeeId: input.participant.employeeId,
      participantType: input.participant.participantType,
      beforeAmount: row.before_amount,
      adjustmentAmount: row.adjustment_amount,
      afterAmount: row.after_amount,
      status: "approved",
    };
  }

  private async insertAuditEvent(
    client: CorrectionClient,
    input: {
      actorUserId: string;
      adjustmentId: string;
      companyId: string;
      regionId: string;
      storeId: string;
      periodKey: string;
      phase: SalesTargetIncentiveCorrectionPhase;
      participantType: "store_manager" | "personnel";
      reasonCode: string;
    },
  ) {
    await client.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          metadata_json
        )
        VALUES (
          $1::uuid,
          'sales_target_incentive_adjustment.approved',
          'ops.sales_target_incentive_adjustment',
          $2::uuid,
          'store',
          $3::uuid,
          $4::uuid,
          $5::uuid,
          $6::jsonb
        )
      `,
      [
        input.actorUserId,
        input.adjustmentId,
        input.companyId,
        input.regionId,
        input.storeId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          actorUserId: input.actorUserId,
          periodKey: input.periodKey,
          phase: input.phase,
          participantType: input.participantType,
          reasonCode: input.reasonCode,
        }),
      ],
    );
  }
}

function compactUuidArray(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value));
}
