import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import { isChecklistScoreNonCompliant } from "../application/checklist-low-score-policy";

type ChecklistAcknowledgementRow = {
  checklist_instance_id: string;
  checklist_template_id: string;
  template_name: string;
  template_type: string;
  category: string;
  store_id: string;
  store_name: string;
  completed_by_user_id: string | null;
  completed_by_display_name: string | null;
  completed_at: string | null;
  status: string;
  total_score: string | null;
  compliance_rate: string | null;
  checklist_acknowledgement_id: string | null;
  acknowledged_by_user_id: string | null;
  acknowledgement_note: string | null;
  acknowledged_at: string | null;
  responses_json: unknown;
  region_manager_names?: string[];
  store_manager_names?: string[];
  total_count: string | number;
};

type ChecklistAcknowledgementResponseRow = {
  templateItemId?: string | null;
  sectionName?: string | null;
  itemNo?: string | number | null;
  itemText?: string | null;
  responseType?: string | null;
  weight?: string | number | null;
  maxScore?: string | number | null;
  responseValue?: string | null;
  scoreValue?: string | number | null;
  commentText?: string | null;
};

type ChecklistRemediationSourceRow = {
  checklist_instance_id: string;
  checklist_template_id: string;
  template_name: string;
  template_type: string;
  category: string;
  store_id: string;
  store_name: string;
  completed_at: string | null;
  responses_json: unknown;
};

type ChecklistRemediationResponseRow = ChecklistAcknowledgementResponseRow & {
  isNonCompliant?: boolean | string | null;
  expectedValue?: unknown;
  createsRemediationTask?: boolean | null;
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
    allowedTemplateTypes?: string[];
    checklistInstanceId?: string;
    includeResponses?: boolean;
    limit?: number;
    offset?: number;
    period?: string;
    status?: "pending_acknowledgement" | "acknowledged";
    storeId?: string;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return { items: [], total: 0 };
    }

    if (input.allowedTemplateTypes && input.allowedTemplateTypes.length === 0) {
      return { items: [], total: 0 };
    }

    const clauses: string[] = [];
    const params: unknown[] = [];
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);

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

    if (input.allowedTemplateTypes) {
      params.push(input.allowedTemplateTypes);
      clauses.push(`ct.template_type = ANY($${params.length}::text[])`);
    }

    if (input.checklistInstanceId) {
      params.push(input.checklistInstanceId);
      clauses.push(`ci.checklist_instance_id = $${params.length}::uuid`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`ci.store_id = $${params.length}::uuid`);
    }

    if (input.period) {
      params.push(input.period);
      clauses.push(
        `ci.completed_at >= ($${params.length}::text || '-01')::date AND ci.completed_at < (($${params.length}::text || '-01')::date + INTERVAL '1 month')`,
      );
    }

    if (input.status === "pending_acknowledgement") {
      clauses.push(`ca.checklist_acknowledgement_id IS NULL`);
    } else if (input.status === "acknowledged") {
      clauses.push(`ca.checklist_acknowledgement_id IS NOT NULL`);
    }

    clauses.push(`ci.status = 'completed'`);
    const whereClause = `WHERE ${clauses.join(" AND ")}`;
    const includeResponses = input.includeResponses === true;
    const responsesSelect = includeResponses
      ? `
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'templateItemId', cti.template_item_id,
                'sectionName', cti.section_name,
                'itemNo', cti.item_no,
                'itemText', cti.item_text,
                'responseType', cti.response_type,
                'weight', cti.weight,
                'maxScore', cti.max_score,
                'responseValue', cr.response_value,
                'scoreValue', cr.score_value,
                'commentText', cr.comment_text
              )
              ORDER BY cti.item_no ASC, cti.template_item_id ASC
            ) FILTER (WHERE cti.template_item_id IS NOT NULL),
            '[]'::jsonb
          ) AS responses_json,
        `
      : `'[]'::jsonb AS responses_json,`;
    const responseJoins = includeResponses
      ? `
        LEFT JOIN ops.checklist_template_item cti
          ON cti.checklist_template_id = ci.checklist_template_id
        LEFT JOIN ops.checklist_response cr
          ON cr.checklist_instance_id = ci.checklist_instance_id
         AND cr.template_item_id = cti.template_item_id
        `
      : "";
    const groupByClause = includeResponses
      ? `
        GROUP BY
          ci.checklist_instance_id,
          ci.checklist_template_id,
          ct.template_name,
          ct.template_type,
          ct.category,
          ci.store_id,
          s.store_name,
          ci.completed_by_user_id,
          completed_identity.completed_by_display_name,
          signatories.region_manager_names,
          signatories.store_manager_names,
          ci.completed_at,
          ci.status,
          ci.total_score,
          ci.compliance_rate,
          ci.created_at,
          ca.checklist_acknowledgement_id,
          ca.acknowledged_by_user_id,
          ca.acknowledgement_note,
          ca.acknowledged_at
        `
      : "";

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const result = await this.databaseService.query<ChecklistAcknowledgementRow>(
      `
        SELECT
          ci.checklist_instance_id,
          ci.checklist_template_id,
          ct.template_name,
          ct.template_type,
          ct.category,
          ci.store_id,
          s.store_name,
          ci.completed_by_user_id,
          completed_identity.completed_by_display_name,
          ci.completed_at,
          ci.status,
          ci.total_score,
          ci.compliance_rate,
          ca.checklist_acknowledgement_id,
          ca.acknowledged_by_user_id,
          ca.acknowledgement_note,
          ca.acknowledged_at,
          ${responsesSelect}
          ${includeResponses ? "signatories.region_manager_names, signatories.store_manager_names," : ""}
          COUNT(*) OVER() AS total_count
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        INNER JOIN ops.store s
          ON s.store_id = ci.store_id
        LEFT JOIN ops.checklist_acknowledgement ca
          ON ca.checklist_instance_id = ci.checklist_instance_id
        LEFT JOIN ops.user_account completed_user
          ON completed_user.user_id = CASE
            WHEN ci.completed_by_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN ci.completed_by_user_id::uuid
            ELSE NULL
          END
        LEFT JOIN ops.employee completed_employee
          ON completed_employee.employee_id = completed_user.employee_id
        LEFT JOIN ops.employee auditor_employee
          ON auditor_employee.employee_id = ci.auditor_employee_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            NULLIF(BTRIM(CONCAT_WS(' ', completed_employee.first_name, completed_employee.last_name)), ''),
            NULLIF(BTRIM(CONCAT_WS(' ', auditor_employee.first_name, auditor_employee.last_name)), ''),
            NULLIF(BTRIM(completed_user.username), ''),
            NULLIF(BTRIM(completed_user.email), '')
          ) AS completed_by_display_name
        ) completed_identity ON TRUE
        ${includeResponses ? `LEFT JOIN LATERAL (
          SELECT
            COALESCE(array_agg(DISTINCT names.display_name ORDER BY names.display_name)
              FILTER (WHERE names.role_code = 'REGION_MANAGER'), ARRAY[]::text[]) AS region_manager_names,
            COALESCE(array_agg(DISTINCT names.display_name ORDER BY names.display_name)
              FILTER (WHERE names.role_code = 'STORE_MANAGER'), ARRAY[]::text[]) AS store_manager_names
          FROM (
            SELECT role.role_code,
              COALESCE(
                NULLIF(BTRIM(CONCAT_WS(' ', employee.first_name, employee.last_name)), ''),
                NULLIF(BTRIM(account.username), '')
              ) AS display_name
            FROM ops.user_action_store_assignment assigned
            JOIN ops.user_account account ON account.user_id = assigned.user_id AND account.is_active = TRUE
            LEFT JOIN ops.employee employee ON employee.employee_id = account.employee_id
            JOIN ops.user_role_assignment assignment ON assignment.user_id = account.user_id
            JOIN ops.role role ON role.role_id = assignment.role_id
            WHERE assigned.store_id = ci.store_id
              AND assigned.start_at <= NOW() AND (assigned.end_at IS NULL OR assigned.end_at > NOW())
              AND assignment.start_at <= NOW() AND (assignment.end_at IS NULL OR assignment.end_at >= NOW())
              AND role.role_code IN ('REGION_MANAGER', 'STORE_MANAGER')
              AND (assignment.scope_type = 'global'
                OR (assignment.scope_type = 'company' AND assignment.company_id = s.company_id)
                OR (assignment.scope_type = 'store' AND assignment.store_id = s.store_id)
                OR (assignment.scope_type = 'region' AND EXISTS (
                  SELECT 1 FROM ops.region region
                  WHERE region.region_id = assignment.region_id AND region.company_id = s.company_id
                )))
          ) names WHERE names.display_name IS NOT NULL
        ) signatories ON TRUE` : ""}
        ${responseJoins}
        ${whereClause}
        ${groupByClause}
        ORDER BY ci.completed_at DESC NULLS LAST, ci.created_at DESC
        LIMIT $${limitParam}::integer
        OFFSET $${offsetParam}::integer
      `,
      params,
    );

    const total =
      result.rows[0]?.total_count === undefined
        ? result.rows.length
        : Number(result.rows[0].total_count);

    return {
      items: result.rows.map((row) => ({
        checklistInstanceId: row.checklist_instance_id,
        checklistTemplateId: row.checklist_template_id,
        templateName: row.template_name,
        templateType: row.template_type,
        category: row.category,
        storeId: row.store_id,
        storeName: row.store_name,
        completedByUserId: row.completed_by_user_id,
        completedByDisplayName: row.completed_by_display_name,
        completedAt: row.completed_at,
        status: row.status,
        totalScore: row.total_score === null ? null : Number(row.total_score),
        complianceRate: row.compliance_rate === null ? null : Number(row.compliance_rate),
        responses: this.mapResponseDetails(row.responses_json),
        ...(includeResponses ? { signatories: {
          regionManagerNames: row.region_manager_names ?? [],
          storeManagerNames: row.store_manager_names ?? [],
        } } : {}),
        acknowledgement: row.checklist_acknowledgement_id
          ? {
              checklistAcknowledgementId: row.checklist_acknowledgement_id,
              acknowledgedByUserId: row.acknowledged_by_user_id,
              acknowledgementNote: row.acknowledgement_note,
              acknowledgedAt: row.acknowledged_at,
            }
          : null,
      })),
      total,
    };
  }

  async getChecklistRemediationSource(checklistInstanceId: string) {
    const result = await this.databaseService.query<ChecklistRemediationSourceRow>(
      `
        SELECT
          ci.checklist_instance_id,
          ci.checklist_template_id,
          ct.template_name,
          ct.template_type,
          ct.category,
          ci.store_id,
          s.store_name,
          ci.completed_at,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'templateItemId', cti.template_item_id,
                'sectionName', cti.section_name,
                'itemNo', cti.item_no,
                'itemText', cti.item_text,
                'responseType', cti.response_type,
                'weight', cti.weight,
                'maxScore', cti.max_score,
                'expectedValue', cti.expected_value,
                'responseValue', cr.response_value,
                'scoreValue', cr.score_value,
                'commentText', cr.comment_text,
                'isNonCompliant', COALESCE(cr.is_non_compliant, FALSE),
                'createsRemediationTask', cti.creates_remediation_task
              )
              ORDER BY cti.section_name ASC, cti.item_no ASC, cti.template_item_id ASC
            ) FILTER (WHERE cti.template_item_id IS NOT NULL),
            '[]'::jsonb
          ) AS responses_json
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        INNER JOIN ops.store s
          ON s.store_id = ci.store_id
        LEFT JOIN ops.checklist_template_item cti
          ON cti.checklist_template_id = ci.checklist_template_id
        LEFT JOIN ops.checklist_response cr
          ON cr.checklist_instance_id = ci.checklist_instance_id
         AND cr.template_item_id = cti.template_item_id
        WHERE ci.checklist_instance_id = $1::uuid
          AND ci.status = 'completed'
        GROUP BY
          ci.checklist_instance_id,
          ci.checklist_template_id,
          ct.template_name,
          ct.template_type,
          ct.category,
          ci.store_id,
          s.store_name,
          ci.completed_at
      `,
      [checklistInstanceId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      checklistInstanceId: row.checklist_instance_id,
      checklistTemplateId: row.checklist_template_id,
      templateName: row.template_name,
      templateType: row.template_type,
      category: row.category,
      storeId: row.store_id,
      storeName: row.store_name,
      completedAt: row.completed_at,
      responses: this.mapRemediationResponseDetails(row.responses_json),
    };
  }

  private mapResponseDetails(value: unknown) {
    const rows = Array.isArray(value) ? (value as ChecklistAcknowledgementResponseRow[]) : [];

    return rows.map((row) => ({
      templateItemId: String(row.templateItemId ?? ""),
      sectionName: String(row.sectionName ?? ""),
      itemNo: Number(row.itemNo ?? 0),
      itemText: String(row.itemText ?? ""),
      responseType: String(row.responseType ?? ""),
      weight: Number(row.weight ?? 0),
      maxScore: Number(row.maxScore ?? 0),
      responseValue: row.responseValue ?? null,
      scoreValue:
        row.scoreValue === null || row.scoreValue === undefined
          ? null
          : Number(row.scoreValue),
      commentText: row.commentText ?? null,
    }));
  }

  private mapRemediationResponseDetails(value: unknown) {
    const rows = Array.isArray(value) ? (value as ChecklistRemediationResponseRow[]) : [];

    return rows.map((row) => ({
      templateItemId: String(row.templateItemId ?? ""),
      sectionName: String(row.sectionName ?? ""),
      itemNo: Number(row.itemNo ?? 0),
      itemText: String(row.itemText ?? ""),
      responseType: String(row.responseType ?? ""),
      weight: Number(row.weight ?? 0),
      maxScore: Number(row.maxScore ?? 0),
      responseValue: row.responseValue ?? null,
      scoreValue:
        row.scoreValue === null || row.scoreValue === undefined
          ? null
          : Number(row.scoreValue),
      commentText: row.commentText ?? null,
      isNonCompliant:
        row.responseValue === "not_applicable"
          ? false
          : row.isNonCompliant === true ||
            String(row.isNonCompliant ?? "").toLowerCase() === "true" ||
            isChecklistScoreNonCompliant({
              expectedValue: row.expectedValue,
              scoreValue:
                row.scoreValue === null || row.scoreValue === undefined
                  ? null
                  : Number(row.scoreValue),
            }),
      createsRemediationTask: row.createsRemediationTask !== false,
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
          SET checklist_instance_id = EXCLUDED.checklist_instance_id
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
