import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  CompetitionStagePackagePlan,
  CompetitionStagePackagePlanAuditEvent,
} from "../application/competition.contract";
import {
  mapStagePackagePlan,
  mapStagePackagePlanAuditEvent,
  type CompetitionStagePackagePlanAuditRow,
  type CompetitionStagePackagePlanRow,
} from "./competition.repository.mapper";

@Injectable()
export class CompetitionStagePackagePlanReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listStagePackagePlans(input: {
    competitionId: string;
  }): Promise<CompetitionStagePackagePlan[]> {
    const result = await this.databaseService.query<CompetitionStagePackagePlanRow>(
      `
        SELECT
          plan.competition_stage_package_plan_id,
          plan.competition_id,
          plan.package_code,
          plan.plan_name,
          plan.plan_status,
          plan.stage_drafts_json,
          plan.created_stage_ids,
          plan.submitted_by_user_id,
          plan.submitted_at,
          plan.reviewed_by_user_id,
          plan.reviewed_at,
          plan.review_note,
          plan.created_at,
          plan.updated_at,
          plan.executed_at,
          source_audit.metadata_json ->> 'sourcePlanId' AS source_plan_id,
          source_audit.metadata_json ->> 'sourcePlanName' AS source_plan_name
        FROM ops.competition_stage_package_plan plan
        LEFT JOIN LATERAL (
          SELECT metadata_json
          FROM audit.event_log
          WHERE entity_name = 'ops.competition_stage_package_plan'
            AND entity_id = plan.competition_stage_package_plan_id
            AND event_type = 'competition_stage_package_plan.cloned_from_returned'
          ORDER BY occurred_at ASC, event_log_id ASC
          LIMIT 1
        ) source_audit ON TRUE
        WHERE plan.competition_id = $1::uuid
        ORDER BY plan.updated_at DESC, plan.created_at DESC
      `,
      [input.competitionId],
    );

    return result.rows.map(mapStagePackagePlan);
  }

  async listStagePackagePlanAudit(input: {
    planId: string;
  }): Promise<CompetitionStagePackagePlanAuditEvent[]> {
    const result = await this.databaseService.query<CompetitionStagePackagePlanAuditRow>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'ops.competition_stage_package_plan'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
      `,
      [input.planId],
    );

    return result.rows.map(mapStagePackagePlanAuditEvent);
  }
}
