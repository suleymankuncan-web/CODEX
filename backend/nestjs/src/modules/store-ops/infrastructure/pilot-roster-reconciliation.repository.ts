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

export type PilotRosterApplyResult = {
  activeAssignmentsTouched: number;
  targetReferencesTouched: number;
  turnoverEventsTouched: number;
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
    snapshotPeriodsToRefresh: string[];
  }): Promise<PilotRosterApplyResult> {
    return this.databaseService.withTransaction(async (client) => {
      let activeAssignmentsTouched = 0;
      let targetReferencesTouched = 0;
      let turnoverEventsTouched = 0;

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

      return {
        activeAssignmentsTouched,
        targetReferencesTouched,
        turnoverEventsTouched,
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
}
