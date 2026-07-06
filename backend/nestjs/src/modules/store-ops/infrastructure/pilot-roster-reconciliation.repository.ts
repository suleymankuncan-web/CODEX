import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";

export type ResolvedPilotRosterActiveAssignment = {
  companyId: string;
  regionId: string;
  storeId: string;
  employeeId: string;
  positionId: string;
  startDate: string;
  assignmentStatus?: "active" | "inactive";
};

export type ResolvedPilotRosterTargetReference = {
  companyId: string;
  regionId: string;
  storeId: string;
  employeeId: string;
  periodStart: string;
  targetValue: number;
};

export type ResolvedPilotRosterTurnoverEvent = {
  companyId: string;
  regionId: string;
  storeId: string;
  employeeId: string;
  eventDate: string;
  sourceAssignmentId?: string | null;
};

export type ResolvedPilotRosterKpiActual = {
  companyId: string;
  regionId: string;
  storeId: string;
  employeeId?: string | null;
  periodStart: string;
  scopeType: "store" | "employee";
  kpiCode: string;
  actualValue: number;
  sourceBatchId: string;
  sourcePayloadHash?: string | null;
};

export type PilotRosterApplyResult = {
  activeAssignmentsTouched: number;
  targetReferencesTouched: number;
  turnoverEventsTouched: number;
  kpiActualsTouched: number;
  snapshotPeriodsToRefresh: string[];
};

@Injectable()
export class PilotRosterReconciliationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async applyResolvedPlan(input: {
    actorUserId: string;
    activeAssignments: ResolvedPilotRosterActiveAssignment[];
    targetReferences: ResolvedPilotRosterTargetReference[];
    turnoverEvents: ResolvedPilotRosterTurnoverEvent[];
    kpiActuals?: ResolvedPilotRosterKpiActual[];
    snapshotPeriodsToRefresh: string[];
  }): Promise<PilotRosterApplyResult> {
    return this.databaseService.withTransaction(async (client) => {
      let activeAssignmentsTouched = 0;
      let targetReferencesTouched = 0;
      let turnoverEventsTouched = 0;
      let kpiActualsTouched = 0;

      for (const assignment of input.activeAssignments) {
        activeAssignmentsTouched += await this.upsertActiveAssignment(client, assignment);
      }

      for (const target of input.targetReferences) {
        targetReferencesTouched += await this.upsertTargetReference(
          client,
          input.actorUserId,
          target,
        );
      }

      for (const turnoverEvent of input.turnoverEvents) {
        turnoverEventsTouched += await this.upsertTurnoverEvent(client, turnoverEvent);
      }

      for (const kpiActual of input.kpiActuals ?? []) {
        kpiActualsTouched += await this.upsertKpiActual(client, kpiActual);
      }

      return {
        activeAssignmentsTouched,
        targetReferencesTouched,
        turnoverEventsTouched,
        kpiActualsTouched,
        snapshotPeriodsToRefresh: Array.from(
          new Set(input.snapshotPeriodsToRefresh),
        ).sort(),
      };
    });
  }

  private async upsertActiveAssignment(
    client: PoolClient,
    assignment: ResolvedPilotRosterActiveAssignment,
  ) {
    await client.query(
      `
        UPDATE ops.employee
        SET
          employment_status = 'active',
          termination_date = NULL,
          updated_at = NOW()
        WHERE employee_id = $1::uuid
          AND company_id = $2::uuid
      `,
      [assignment.employeeId, assignment.companyId],
    );

    const result = await client.query(
      `
        INSERT INTO ops.employee_assignment_history (
          employee_id,
          store_id,
          region_id,
          position_id,
          start_date,
          end_date,
          assignment_status,
          is_primary_assignment,
          fte_ratio
        )
        SELECT
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::date,
          NULL,
          COALESCE($6, 'active'),
          TRUE,
          1.00
        WHERE NOT EXISTS (
          SELECT 1
          FROM ops.employee_assignment_history existing
          WHERE existing.employee_id = $1::uuid
            AND existing.store_id = $2::uuid
            AND existing.position_id = $4::uuid
            AND existing.assignment_status = 'active'
            AND existing.end_date IS NULL
        )
      `,
      [
        assignment.employeeId,
        assignment.storeId,
        assignment.regionId,
        assignment.positionId,
        assignment.startDate,
        assignment.assignmentStatus ?? "active",
      ],
    );

    return result.rowCount ?? 0;
  }

  private async upsertTargetReference(
    client: PoolClient,
    actorUserId: string,
    target: ResolvedPilotRosterTargetReference,
  ) {
    const requestResult = await client.query<{ target_distribution_request_id: string }>(
      `
        WITH existing AS (
          SELECT target_distribution_request_id
          FROM ops.target_distribution_request
          WHERE company_id = $1::uuid
            AND region_id = $2::uuid
            AND store_id = $3::uuid
            AND request_month = $4::date
            AND target_label = 'pilot_imported_personnel_targets'
          ORDER BY created_at DESC
          LIMIT 1
        ),
        inserted AS (
          INSERT INTO ops.target_distribution_request (
            company_id,
            region_id,
            store_id,
            request_month,
            target_label,
            total_target_value,
            allocation_count,
            request_status,
            request_reason,
            allocation_json,
            submitted_by_user_id,
            approved_by_user_id,
            approved_at,
            approval_note
          )
          SELECT
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::date,
            'pilot_imported_personnel_targets',
            0,
            0,
            'approved',
            'pilot roster reconciliation import',
            '[]'::jsonb,
            $5,
            $5,
            NOW(),
            'Pilot imported target reference'
          WHERE NOT EXISTS (SELECT 1 FROM existing)
          RETURNING target_distribution_request_id
        )
        SELECT target_distribution_request_id FROM inserted
        UNION ALL
        SELECT target_distribution_request_id FROM existing
        LIMIT 1
      `,
      [
        target.companyId,
        target.regionId,
        target.storeId,
        target.periodStart,
        actorUserId,
      ],
    );
    const requestId = requestResult.rows[0]?.target_distribution_request_id;
    if (!requestId) {
      throw new Error("Pilot roster target request could not be created or reused");
    }

    const result = await client.query(
      `
        INSERT INTO ops.personnel_target_reference (
          source_request_id,
          company_id,
          region_id,
          store_id,
          employee_id,
          period_start,
          period_end,
          target_value,
          target_type,
          status,
          approved_by_user_id,
          approved_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::uuid,
          $6::date,
          ($6::date + INTERVAL '1 month' - INTERVAL '1 day')::date,
          $7::numeric,
          'monthly_sales_target',
          'approved',
          $8,
          NOW()
        )
        ON CONFLICT (employee_id, period_start, period_end, target_type)
        WHERE status = 'approved'
        DO UPDATE SET
          source_request_id = EXCLUDED.source_request_id,
          company_id = EXCLUDED.company_id,
          region_id = EXCLUDED.region_id,
          store_id = EXCLUDED.store_id,
          target_value = EXCLUDED.target_value,
          approved_by_user_id = EXCLUDED.approved_by_user_id,
          approved_at = EXCLUDED.approved_at
      `,
      [
        requestId,
        target.companyId,
        target.regionId,
        target.storeId,
        target.employeeId,
        target.periodStart,
        target.targetValue,
        actorUserId,
      ],
    );

    await client.query(
      `
        UPDATE ops.target_distribution_request request
        SET
          total_target_value = totals.total_target_value,
          allocation_count = totals.allocation_count,
          updated_at = NOW()
        FROM (
          SELECT
            source_request_id,
            COALESCE(SUM(target_value), 0)::numeric AS total_target_value,
            COUNT(*)::integer AS allocation_count
          FROM ops.personnel_target_reference
          WHERE source_request_id = $1::uuid
            AND target_type = 'monthly_sales_target'
            AND status = 'approved'
          GROUP BY source_request_id
        ) totals
        WHERE request.target_distribution_request_id = totals.source_request_id
      `,
      [requestId],
    );

    return result.rowCount ?? 0;
  }

  private async upsertTurnoverEvent(
    client: PoolClient,
    turnoverEvent: ResolvedPilotRosterTurnoverEvent,
  ) {
    const result = await client.query(
      `
        INSERT INTO ops.turnover_event (
          employee_id,
          store_id,
          region_id,
          company_id,
          event_date,
          event_type,
          is_regrettable,
          termination_reason_code,
          source_assignment_id
        )
        SELECT
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::date,
          'termination',
          FALSE,
          'pilot_monthly_snapshot_absence',
          $6::uuid
        WHERE NOT EXISTS (
          SELECT 1
          FROM ops.turnover_event existing
          WHERE existing.employee_id = $1::uuid
            AND existing.store_id = $2::uuid
            AND existing.event_date = $5::date
            AND existing.event_type = 'termination'
            AND existing.termination_reason_code = 'pilot_monthly_snapshot_absence'
        )
      `,
      [
        turnoverEvent.employeeId,
        turnoverEvent.storeId,
        turnoverEvent.regionId,
        turnoverEvent.companyId,
        turnoverEvent.eventDate,
        turnoverEvent.sourceAssignmentId ?? null,
      ],
    );

    return result.rowCount ?? 0;
  }

  private async upsertKpiActual(
    client: PoolClient,
    actual: ResolvedPilotRosterKpiActual,
  ) {
    await this.upsertPilotKpiImportBatch(client, actual);

    const employeeId =
      actual.scopeType === "employee" ? actual.employeeId ?? null : null;
    if (actual.scopeType === "employee" && !employeeId) {
      throw new Error("Employee KPI actual requires an employee id");
    }

    if (actual.scopeType === "store") {
      const result = await client.query(
        `
          INSERT INTO ops.kpi_actual (
            kpi_actual_id,
            kpi_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            employee_id,
            period_type,
            period_start,
            period_end,
            actual_value,
            achievement_rate,
            calculated_at,
            source_batch_id,
            source_payload_hash,
            last_synced_at,
            source_type
          )
          SELECT
            gen_random_uuid(),
            definition.kpi_id,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            NULL,
            'monthly',
            $5::date,
            ($5::date + INTERVAL '1 month' - INTERVAL '1 day')::date,
            $6::numeric,
            NULL,
            NOW(),
            $7,
            $8,
            NOW(),
            'integration'
          FROM ops.kpi_definition definition
          WHERE definition.kpi_code = $1
            AND definition.is_active = TRUE
          ON CONFLICT (kpi_id, store_id, period_type, period_start, period_end)
          WHERE scope_type = 'store' AND store_id IS NOT NULL
          DO UPDATE SET
            company_id = EXCLUDED.company_id,
            region_id = EXCLUDED.region_id,
            actual_value = EXCLUDED.actual_value,
            achievement_rate = EXCLUDED.achievement_rate,
            calculated_at = NOW(),
            source_batch_id = EXCLUDED.source_batch_id,
            source_payload_hash = EXCLUDED.source_payload_hash,
            last_synced_at = EXCLUDED.last_synced_at,
            source_type = EXCLUDED.source_type
        `,
        [
          actual.kpiCode,
          actual.companyId,
          actual.regionId,
          actual.storeId,
          actual.periodStart,
          actual.actualValue,
          actual.sourceBatchId,
          actual.sourcePayloadHash ?? null,
        ],
      );

      return result.rowCount ?? 0;
    }

    const employeeResult = await client.query(
      `
        INSERT INTO ops.kpi_actual (
          kpi_actual_id,
          kpi_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          employee_id,
          period_type,
          period_start,
          period_end,
          actual_value,
          achievement_rate,
          calculated_at,
          source_batch_id,
          source_payload_hash,
          last_synced_at,
          source_type
        )
        SELECT
          gen_random_uuid(),
          definition.kpi_id,
          'employee',
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::uuid,
          'monthly',
          $6::date,
          ($6::date + INTERVAL '1 month' - INTERVAL '1 day')::date,
          $7::numeric,
          NULL,
          NOW(),
          $8,
          $9,
          NOW(),
          'integration'
        FROM ops.kpi_definition definition
        WHERE definition.kpi_code = $1
          AND definition.is_active = TRUE
        ON CONFLICT (kpi_id, employee_id, period_type, period_start, period_end)
        WHERE scope_type = 'employee' AND employee_id IS NOT NULL
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          region_id = EXCLUDED.region_id,
          store_id = EXCLUDED.store_id,
          actual_value = EXCLUDED.actual_value,
          achievement_rate = EXCLUDED.achievement_rate,
          calculated_at = NOW(),
          source_batch_id = EXCLUDED.source_batch_id,
          source_payload_hash = EXCLUDED.source_payload_hash,
          last_synced_at = EXCLUDED.last_synced_at,
          source_type = EXCLUDED.source_type
      `,
      [
        actual.kpiCode,
        actual.companyId,
        actual.regionId,
        actual.storeId,
        employeeId,
        actual.periodStart,
        actual.actualValue,
        actual.sourceBatchId,
        actual.sourcePayloadHash ?? null,
      ],
    );

    return employeeResult.rowCount ?? 0;
  }

  private async upsertPilotKpiImportBatch(
    client: PoolClient,
    actual: ResolvedPilotRosterKpiActual,
  ) {
    await client.query(
      `
        WITH source AS (
          INSERT INTO stg.integration_source (
            source_code,
            source_name,
            entity_type,
            source_system,
            is_active
          )
          VALUES (
            'pilot_roster_reconciliation',
            'Pilot roster reconciliation',
            'kpi',
            'manual',
            TRUE
          )
          ON CONFLICT (source_code, entity_type)
          DO UPDATE SET is_active = TRUE
          RETURNING integration_source_id
        )
        INSERT INTO stg.import_batch (
          integration_source_id,
          company_ids,
          entity_type,
          idempotency_key,
          source_batch_id,
          source_payload_hash,
          source_captured_at,
          source_window_started_at,
          source_window_ended_at,
          finished_at,
          status,
          raw_file_name,
          record_count,
          error_count
        )
        SELECT
          source.integration_source_id,
          ARRAY[$1::uuid],
          'kpi',
          $2,
          $2,
          $3,
          NOW(),
          $4::date,
          ($4::date + INTERVAL '1 month' - INTERVAL '1 day')::date,
          NOW(),
          'completed',
          'pilot-personnel-sales-kpi',
          0,
          0
        FROM source
        ON CONFLICT (integration_source_id, entity_type, source_batch_id, company_ids)
        WHERE source_batch_id IS NOT NULL
        DO UPDATE SET
          source_payload_hash = EXCLUDED.source_payload_hash,
          source_captured_at = EXCLUDED.source_captured_at,
          source_window_started_at = EXCLUDED.source_window_started_at,
          source_window_ended_at = EXCLUDED.source_window_ended_at,
          finished_at = EXCLUDED.finished_at,
          status = EXCLUDED.status,
          raw_file_name = EXCLUDED.raw_file_name
      `,
      [
        actual.companyId,
        actual.sourceBatchId,
        actual.sourcePayloadHash ?? null,
        actual.periodStart,
      ],
    );
  }
}
