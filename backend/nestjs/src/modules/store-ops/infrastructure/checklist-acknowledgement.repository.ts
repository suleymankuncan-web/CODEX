import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

type ChecklistAcknowledgementRow = {
  checklist_instance_id: string;
  checklist_template_id: string;
  template_name: string;
  category: string;
  store_id: string;
  store_name: string;
  completed_at: string | null;
  status: string;
  total_score: string | null;
  compliance_rate: string | null;
  checklist_acknowledgement_id: string | null;
  acknowledged_by_user_id: string | null;
  acknowledgement_note: string | null;
  acknowledged_at: string | null;
};

@Injectable()
export class ChecklistAcknowledgementRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private hasStoreAccessScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    return (
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0
    );
  }

  async getChecklistInstanceScope(checklistInstanceId: string) {
    const result = await this.databaseService.query<{
      checklist_instance_id: string;
      store_id: string;
    }>(
      `
        SELECT checklist_instance_id, store_id
        FROM ops.checklist_instance
        WHERE checklist_instance_id = $1::uuid
      `,
      [checklistInstanceId],
    );

    const row = result.rows[0];
    return row
      ? {
          checklistInstanceId: row.checklist_instance_id,
          storeId: row.store_id,
        }
      : null;
  }

  async listChecklistAcknowledgements(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return [];
    }

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`ci.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`s.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
    }

    clauses.push(`ci.status = 'completed'`);
    const whereClause = `WHERE ${clauses.join(" AND ")}`;

    const result = await this.databaseService.query<ChecklistAcknowledgementRow>(
      `
        SELECT
          ci.checklist_instance_id,
          ci.checklist_template_id,
          ct.template_name,
          ct.category,
          ci.store_id,
          s.store_name,
          ci.completed_at,
          ci.status,
          ci.total_score,
          ci.compliance_rate,
          ca.checklist_acknowledgement_id,
          ca.acknowledged_by_user_id,
          ca.acknowledgement_note,
          ca.acknowledged_at
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        INNER JOIN ops.store s
          ON s.store_id = ci.store_id
        LEFT JOIN ops.checklist_acknowledgement ca
          ON ca.checklist_instance_id = ci.checklist_instance_id
        ${whereClause}
        ORDER BY ci.completed_at DESC NULLS LAST, ci.created_at DESC
      `,
      params,
    );

    return result.rows.map((row) => ({
      checklistInstanceId: row.checklist_instance_id,
      checklistTemplateId: row.checklist_template_id,
      templateName: row.template_name,
      category: row.category,
      storeId: row.store_id,
      storeName: row.store_name,
      completedAt: row.completed_at,
      status: row.status,
      totalScore: row.total_score ? Number(row.total_score) : null,
      complianceRate: row.compliance_rate ? Number(row.compliance_rate) : null,
      acknowledgement: row.checklist_acknowledgement_id
        ? {
            checklistAcknowledgementId: row.checklist_acknowledgement_id,
            acknowledgedByUserId: row.acknowledged_by_user_id,
            acknowledgementNote: row.acknowledgement_note,
            acknowledgedAt: row.acknowledged_at,
          }
        : null,
    }));
  }

  async acknowledgeChecklist(input: {
    checklistInstanceId: string;
    actorUserId: string;
    acknowledgementNote?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const instanceResult = await client.query<{
        checklist_instance_id: string;
        store_id: string;
      }>(
        `
          SELECT checklist_instance_id, store_id
          FROM ops.checklist_instance
          WHERE checklist_instance_id = $1::uuid
        `,
        [input.checklistInstanceId],
      );

      const instance = instanceResult.rows[0];

      const result = await client.query<{
        checklist_acknowledgement_id: string;
        acknowledged_by_user_id: string;
        acknowledgement_note: string | null;
        acknowledged_at: string;
      }>(
        `
          INSERT INTO ops.checklist_acknowledgement (
            checklist_instance_id,
            store_id,
            acknowledged_by_user_id,
            acknowledgement_note
          )
          VALUES ($1::uuid, $2::uuid, $3, $4)
          ON CONFLICT (checklist_instance_id) DO UPDATE
          SET
            acknowledged_by_user_id = EXCLUDED.acknowledged_by_user_id,
            acknowledgement_note = EXCLUDED.acknowledgement_note,
            acknowledged_at = NOW()
          RETURNING
            checklist_acknowledgement_id,
            acknowledged_by_user_id,
            acknowledgement_note,
            acknowledged_at
        `,
        [
          input.checklistInstanceId,
          instance.store_id,
          input.actorUserId,
          input.acknowledgementNote ?? null,
        ],
      );

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            store_id,
            metadata_json
          )
          VALUES (
            $1::uuid,
            'checklist_instance.acknowledged',
            'ops.checklist_instance',
            $2::uuid,
            'store',
            $3::uuid,
            $4::jsonb
          )
        `,
        [
          input.actorUserId,
          input.checklistInstanceId,
          instance.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            acknowledgementNote: input.acknowledgementNote ?? null,
          }),
        ],
      );

      return {
        checklistAcknowledgementId: result.rows[0].checklist_acknowledgement_id,
        acknowledgedByUserId: result.rows[0].acknowledged_by_user_id,
        acknowledgementNote: result.rows[0].acknowledgement_note,
        acknowledgedAt: result.rows[0].acknowledged_at,
      };
    });
  }
}
