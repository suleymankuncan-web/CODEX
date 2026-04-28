import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  ChecklistTemplateDraftForPublish,
  ChecklistTemplateResponseType,
  ChecklistTemplateSummary,
  CreateChecklistTemplateInput,
  MobileChecklistToday,
  PublishChecklistTemplateInput,
} from "../application/checklist.contract";

@Injectable()
export class ChecklistRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createTemplate(input: CreateChecklistTemplateInput): Promise<ChecklistTemplateSummary> {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          SELECT pg_advisory_xact_lock(hashtext($1)::bigint)
        `,
        [input.templateCode],
      );

      const versionResult = await client.query<{ version_no: number }>(
        `
          SELECT COALESCE(MAX(version_no), 0) + 1 AS version_no
          FROM ops.checklist_template
          WHERE template_code = $1
        `,
        [input.templateCode],
      );
      const versionNo = Number(versionResult.rows[0]?.version_no ?? 1);

      const templateResult = await client.query<{
        checklist_template_id: string;
        company_id: string;
        template_code: string;
        template_type: string;
        template_name: string;
        category: string;
        version_no: number;
        status: string;
        effective_from: string;
        effective_to: string | null;
      }>(
        `
          INSERT INTO ops.checklist_template (
            company_id,
            template_code,
            template_type,
            template_name,
            category,
            version_no,
            status,
            effective_from,
            effective_to,
            created_by
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6,
            'draft',
            $7::date,
            $8::date,
            $9::uuid
          )
          RETURNING
            checklist_template_id,
            company_id,
            template_code,
            template_type,
            template_name,
            category,
            version_no,
            status,
            effective_from,
            effective_to
        `,
        [
          input.companyId,
          input.templateCode,
          input.templateType,
          input.templateName,
          input.category,
          versionNo,
          input.effectiveFrom,
          input.effectiveTo ?? null,
          input.actorUserId,
        ],
      );
      const template = templateResult.rows[0];

      const items = [];
      for (const item of input.items) {
        const itemResult = await client.query<{
          template_item_id: string;
          section_name: string;
          item_no: number;
          item_text: string;
          response_type: string;
          weight: string;
          max_score: string;
          expected_value: string | null;
        }>(
          `
            INSERT INTO ops.checklist_template_item (
              checklist_template_id,
              section_name,
              item_no,
              item_text,
              response_type,
              weight,
              max_score,
              expected_value
            )
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
              template_item_id,
              section_name,
              item_no,
              item_text,
              response_type,
              weight,
              max_score,
              expected_value
          `,
          [
            template.checklist_template_id,
            item.sectionName,
            item.itemNo,
            item.itemText,
            item.responseType,
            item.weight,
            item.maxScore,
            item.expectedValue ?? null,
          ],
        );
        const row = itemResult.rows[0];
        items.push({
          templateItemId: row.template_item_id,
          sectionName: row.section_name,
          itemNo: Number(row.item_no),
          itemText: row.item_text,
          responseType: row.response_type as ChecklistTemplateResponseType,
          weight: Number(row.weight),
          maxScore: Number(row.max_score),
          expectedValue: row.expected_value ?? undefined,
        });
      }

      return {
        checklistTemplateId: template.checklist_template_id,
        companyId: template.company_id,
        templateCode: template.template_code,
        templateType: template.template_type,
        templateName: template.template_name,
        category: template.category,
        versionNo: Number(template.version_no),
        status: template.status,
        effectiveFrom: template.effective_from,
        effectiveTo: template.effective_to,
        items,
      };
    });
  }

  async getDraftTemplateForPublish(
    checklistTemplateId: string,
  ): Promise<ChecklistTemplateDraftForPublish> {
    const templateResult = await this.databaseService.query<{
      checklist_template_id: string;
      company_id: string;
      effective_from: string;
      effective_to: string | null;
    }>(
      `
        SELECT checklist_template_id, company_id, effective_from, effective_to
        FROM ops.checklist_template
        WHERE checklist_template_id = $1::uuid
          AND status = 'draft'
      `,
      [checklistTemplateId],
    );

    if (!templateResult.rows[0]) {
      throw new NotFoundException("Draft checklist template not found");
    }

    const result = await this.databaseService.query<{
      template_item_id: string;
      weight: string;
    }>(
      `
        SELECT cti.template_item_id, cti.weight
        FROM ops.checklist_template_item cti
        WHERE cti.checklist_template_id = $1::uuid
        ORDER BY cti.item_no ASC
      `,
      [checklistTemplateId],
    );

    return {
      checklistTemplateId: templateResult.rows[0].checklist_template_id,
      companyId: templateResult.rows[0].company_id,
      effectiveFrom: templateResult.rows[0].effective_from,
      effectiveTo: templateResult.rows[0].effective_to,
      items: result.rows.map((row) => ({
        templateItemId: row.template_item_id,
        weight: Number(row.weight),
      })),
    };
  }

  async publishTemplate(input: PublishChecklistTemplateInput): Promise<ChecklistTemplateSummary> {
    const result = await this.databaseService.query<{
      checklist_template_id: string;
      company_id: string;
      status: string;
      effective_from: string;
      effective_to: string | null;
    }>(
      `
        UPDATE ops.checklist_template
        SET
          status = 'published',
          effective_from = COALESCE($2::date, effective_from),
          effective_to = COALESCE($3::date, effective_to)
        WHERE checklist_template_id = $1::uuid
          AND status = 'draft'
        RETURNING checklist_template_id, company_id, status, effective_from, effective_to
      `,
      [input.checklistTemplateId, input.effectiveFrom ?? null, input.effectiveTo ?? null],
    );

    const template = result.rows[0];
    if (!template) {
      throw new NotFoundException("Draft checklist template not found");
    }

    return {
      checklistTemplateId: template.checklist_template_id,
      companyId: template.company_id,
      status: template.status,
      effectiveFrom: template.effective_from,
      effectiveTo: template.effective_to,
    };
  }

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
