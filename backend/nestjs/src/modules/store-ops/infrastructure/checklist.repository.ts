import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { MobileChecklistToday } from "../application/checklist.contract";

@Injectable()
export class ChecklistRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMobileChecklistToday(input: {
    actorUserId: string;
    assignedStoreIds: string[];
    readStoreIds: string[];
  }): Promise<MobileChecklistToday> {
    const storeIds = input.assignedStoreIds.length > 0 ? input.assignedStoreIds : input.readStoreIds;

    if (storeIds.length === 0) {
      return {
        stores: [],
        templates: [],
        activeInstances: [],
        completedThisMonth: [],
        pendingAcknowledgements: [],
        monthlySummaries: [],
      };
    }

    const stores = await this.databaseService.query<{ store_id: string; store_name: string }>(
      `
        SELECT s.store_id, s.store_name
        FROM ops.store s
        WHERE s.store_id = ANY($1::uuid[])
        ORDER BY s.store_name ASC
      `,
      [storeIds],
    );

    const templates = await this.databaseService.query<{
      checklist_template_id: string;
      template_code: string;
      template_type: string;
      template_name: string;
      version_no: number;
    }>(
      `
        SELECT ct.checklist_template_id, ct.template_code, ct.template_type, ct.template_name, ct.version_no
        FROM ops.checklist_template ct
        WHERE ct.company_id IN (
          SELECT DISTINCT s.company_id
          FROM ops.store s
          WHERE s.store_id = ANY($1::uuid[])
        )
          AND ct.status = 'published'
          AND ct.effective_from <= CURRENT_DATE
          AND (ct.effective_to IS NULL OR ct.effective_to >= CURRENT_DATE)
        ORDER BY ct.template_type ASC, ct.template_name ASC, ct.version_no DESC
      `,
      [storeIds],
    );

    const activeInstances = await this.databaseService.query<{
      checklist_instance_id: string;
      checklist_template_id: string;
      store_id: string;
      status: "planned" | "in_progress";
      started_at: string | null;
      updated_at: string | null;
    }>(
      `
        SELECT checklist_instance_id, checklist_template_id, store_id, status, started_at, created_at AS updated_at
        FROM ops.checklist_instance
        WHERE store_id = ANY($1::uuid[])
          AND status IN ('planned', 'in_progress')
        ORDER BY created_at DESC
      `,
      [storeIds],
    );

    const completedThisMonth = await this.databaseService.query<{
      checklist_instance_id: string;
      checklist_template_id: string;
      store_id: string;
      completed_at: string;
      total_score: string;
      acknowledged_at: string | null;
    }>(
      `
        SELECT ci.checklist_instance_id, ci.checklist_template_id, ci.store_id, ci.completed_at, ci.total_score, ca.acknowledged_at
        FROM ops.checklist_instance ci
        LEFT JOIN ops.checklist_acknowledgement ca
          ON ca.checklist_instance_id = ci.checklist_instance_id
        WHERE ci.store_id = ANY($1::uuid[])
          AND ci.status = 'completed'
          AND ci.total_score IS NOT NULL
          AND ci.completed_at >= date_trunc('month', CURRENT_DATE)
          AND ci.completed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        ORDER BY ci.completed_at DESC
      `,
      [storeIds],
    );

    const monthlySummaries = await this.databaseService.query<{
      store_id: string;
      checklist_template_id: string;
      month_start: string;
      completed_count: string;
      average_score: string | null;
    }>(
      `
        SELECT
          ci.store_id,
          ci.checklist_template_id,
          date_trunc('month', ci.completed_at)::date AS month_start,
          COUNT(*)::text AS completed_count,
          AVG(ci.total_score)::numeric(12,2)::text AS average_score
        FROM ops.checklist_instance ci
        WHERE ci.store_id = ANY($1::uuid[])
          AND ci.status = 'completed'
          AND ci.total_score IS NOT NULL
          AND ci.completed_at >= date_trunc('month', CURRENT_DATE)
          AND ci.completed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY ci.store_id, ci.checklist_template_id, date_trunc('month', ci.completed_at)::date
      `,
      [storeIds],
    );

    return {
      stores: stores.rows.map((row) => ({ storeId: row.store_id, storeName: row.store_name })),
      templates: templates.rows.map((row) => ({
        checklistTemplateId: row.checklist_template_id,
        templateCode: row.template_code,
        templateType: row.template_type,
        templateName: row.template_name,
        versionNo: Number(row.version_no),
      })),
      activeInstances: activeInstances.rows.map((row) => ({
        checklistInstanceId: row.checklist_instance_id,
        checklistTemplateId: row.checklist_template_id,
        storeId: row.store_id,
        status: row.status,
        startedAt: row.started_at,
        updatedAt: row.updated_at,
      })),
      completedThisMonth: completedThisMonth.rows.map((row) => ({
        checklistInstanceId: row.checklist_instance_id,
        checklistTemplateId: row.checklist_template_id,
        storeId: row.store_id,
        completedAt: row.completed_at,
        totalScore: Number(row.total_score),
        acknowledgedAt: row.acknowledged_at,
      })),
      pendingAcknowledgements: completedThisMonth.rows
        .filter((row) => row.acknowledged_at === null)
        .map((row) => ({
          checklistInstanceId: row.checklist_instance_id,
          checklistTemplateId: row.checklist_template_id,
          storeId: row.store_id,
          completedAt: row.completed_at,
          totalScore: Number(row.total_score),
        })),
      monthlySummaries: monthlySummaries.rows.map((row) => ({
        storeId: row.store_id,
        checklistTemplateId: row.checklist_template_id,
        monthStart: row.month_start,
        completedCount: Number(row.completed_count),
        averageScore: row.average_score === null ? null : Number(row.average_score),
      })),
    };
  }
}
