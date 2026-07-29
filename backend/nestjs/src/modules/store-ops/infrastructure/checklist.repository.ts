import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { ChecklistEvidenceRepository } from "./checklist-evidence.repository";
import {
  ChecklistTemplateDraftForPublish,
  ChecklistTemplateResponseType,
  ChecklistTemplateSummary,
  CreateChecklistTemplateInput,
  MobileChecklistToday,
  PublishChecklistTemplateInput,
} from "../application/checklist.contract";
import { isChecklistScoreNonCompliant } from "../application/checklist-low-score-policy";
import { parseChecklistScorePolicy } from "../application/checklist-score-policy";
import { startOrResumeChecklistInstance } from "./checklist-instance-start";

@Injectable()
export class ChecklistRepository {
  private readonly evidenceRepository: ChecklistEvidenceRepository;

  constructor(private readonly databaseService: DatabaseService) {
    this.evidenceRepository = new ChecklistEvidenceRepository(databaseService);
  }

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
          evidence_policy: "none" | "optional" | "required";
          max_evidence_count: number;
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
              expected_value,
              evidence_policy,
              max_evidence_count
            )
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING
              template_item_id,
              section_name,
              item_no,
              item_text,
              response_type,
              weight,
              max_score,
              expected_value,
              evidence_policy,
              max_evidence_count
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
            item.evidencePolicy ?? "none",
            item.maxEvidenceCount ?? 0,
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
          evidencePolicy: row.evidence_policy,
          maxEvidenceCount: Number(row.max_evidence_count),
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
      evidence_policy: "none" | "optional" | "required";
      max_evidence_count: number;
    }>(
      `
        SELECT cti.template_item_id, cti.weight, cti.evidence_policy, cti.max_evidence_count
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
        evidencePolicy: row.evidence_policy ?? "none",
        maxEvidenceCount: Number(row.max_evidence_count ?? 0),
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

  async getPublishedTemplateForStore(input: {
    checklistTemplateId: string;
    storeId: string;
  }) {
    const result = await this.databaseService.query<{
      checklist_template_id: string;
      template_type: string;
    }>(
      `
        SELECT ct.checklist_template_id, ct.template_type
        FROM ops.checklist_template ct
        INNER JOIN ops.store s
          ON s.store_id = $2::uuid
         AND s.company_id = ct.company_id
        WHERE ct.checklist_template_id = $1::uuid
          AND ct.status = 'published'
          AND ct.effective_from <= CURRENT_DATE
          AND (ct.effective_to IS NULL OR ct.effective_to >= CURRENT_DATE)
      `,
      [input.checklistTemplateId, input.storeId],
    );

    const row = result.rows[0];
    return row
      ? {
          checklistTemplateId: row.checklist_template_id,
          templateType: row.template_type,
        }
      : null;
  }

  async startMobileChecklistInstance(input: {
    checklistTemplateId: string;
    storeId: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction((client) =>
      startOrResumeChecklistInstance(client, input),
    );
  }

  async getMobileChecklistInstanceScope(checklistInstanceId: string) {
    const result = await this.databaseService.query<{
      checklist_instance_id: string;
      store_id: string;
      status: string;
      template_type: string;
    }>(
      `
        SELECT ci.checklist_instance_id, ci.store_id, ci.status, ct.template_type
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        WHERE ci.checklist_instance_id = $1::uuid
      `,
      [checklistInstanceId],
    );

    const row = result.rows[0];
    return row
      ? {
          checklistInstanceId: row.checklist_instance_id,
          storeId: row.store_id,
          status: row.status,
          templateType: row.template_type,
        }
      : null;
  }

  async saveMobileChecklistResponse(input: {
    checklistInstanceId: string;
    templateItemId: string;
    scoreValue: number;
    commentText?: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const guardResult = await client.query<{
        checklist_instance_id: string;
        store_id: string;
        status: string;
        response_type: ChecklistTemplateResponseType;
        max_score: string;
        expected_value: string | null;
      }>(
        `
          SELECT
            ci.checklist_instance_id,
            ci.store_id,
            ci.status,
            cti.response_type,
            cti.max_score,
            cti.expected_value
          FROM ops.checklist_instance ci
          INNER JOIN ops.checklist_template_item cti
            ON cti.checklist_template_id = ci.checklist_template_id
           AND cti.template_item_id = $2::uuid
          WHERE ci.checklist_instance_id = $1::uuid
          FOR UPDATE OF ci
        `,
        [input.checklistInstanceId, input.templateItemId],
      );
      const guard = guardResult.rows[0];

      if (!guard) {
        throw new BadRequestException(
          "Checklist template item is not available for this instance",
        );
      }

      if (guard.status === "completed") {
        throw new BadRequestException("Completed checklist instances are locked");
      }

      const scorePolicy = parseChecklistScorePolicy(guard.expected_value);
      const minScore = scorePolicy.minScore ?? 0;
      if (guard.response_type === "score" && input.scoreValue < minScore) {
        throw new BadRequestException("Checklist score is below item min score");
      }

      if (input.scoreValue > Number(guard.max_score)) {
        throw new BadRequestException("Checklist score exceeds item max score");
      }

      const responseResult = await client.query<{
        response_id: string;
        responded_at: string;
      }>(
        `
          INSERT INTO ops.checklist_response (
            checklist_instance_id,
            template_item_id,
            score_value,
            comment_text,
            is_non_compliant
          )
          VALUES ($1::uuid, $2::uuid, $3::numeric, $4, $5::boolean)
          ON CONFLICT (checklist_instance_id, template_item_id) DO UPDATE
          SET
            score_value = EXCLUDED.score_value,
            comment_text = EXCLUDED.comment_text,
            is_non_compliant = EXCLUDED.is_non_compliant,
            responded_at = NOW()
          RETURNING response_id, responded_at
        `,
        [
          input.checklistInstanceId,
          input.templateItemId,
          input.scoreValue,
          input.commentText ?? null,
          isChecklistScoreNonCompliant({
            expectedValue: guard.expected_value,
            scoreValue: input.scoreValue,
          }),
        ],
      );

      await client.query(
        `
          UPDATE ops.checklist_instance
          SET
            status = 'in_progress',
            started_at = COALESCE(started_at, NOW()),
            started_by_user_id = COALESCE(started_by_user_id, $2)
          WHERE checklist_instance_id = $1::uuid
            AND status = 'planned'
        `,
        [input.checklistInstanceId, input.actorUserId],
      );

      return responseResult.rows[0];
    });
  }

  async calculateMobileChecklistCompletion(checklistInstanceId: string) {
    const result = await this.databaseService.query<{
      total_score: string | null;
      compliance_rate: string;
      missing_mandatory_count: string;
      missing_required_evidence_count: string;
    }>(
      `
        SELECT
          COALESCE(SUM((COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0)) * cti.weight), 0)::numeric(12,2)::text AS total_score,
          COALESCE(AVG(CASE WHEN COALESCE(cr.score_value, 0) > 0 THEN 1 ELSE 0 END), 0)::numeric(7,4)::text AS compliance_rate,
          COUNT(*) FILTER (WHERE cti.is_mandatory = TRUE AND cr.response_id IS NULL)::text AS missing_mandatory_count
          ,COUNT(*) FILTER (
            WHERE policy.evidence_policy = 'required'
              AND NOT EXISTS (
                SELECT 1 FROM ops.checklist_response_media media
                JOIN ops.media_asset asset ON asset.media_asset_id = media.media_asset_id
                WHERE media.checklist_instance_id = ci.checklist_instance_id
                  AND media.template_item_id = cti.template_item_id
                  AND media.unlinked_at IS NULL
                  AND asset.state = 'ready'
              )
          )::text AS missing_required_evidence_count
        FROM ops.checklist_template_item cti
        LEFT JOIN ops.checklist_response cr
          ON cr.template_item_id = cti.template_item_id
         AND cr.checklist_instance_id = $1::uuid
        INNER JOIN ops.checklist_instance ci
          ON ci.checklist_template_id = cti.checklist_template_id
        LEFT JOIN ops.checklist_instance_item_policy policy
          ON policy.checklist_instance_id = ci.checklist_instance_id
         AND policy.template_item_id = cti.template_item_id
        WHERE ci.checklist_instance_id = $1::uuid
      `,
      [checklistInstanceId],
    );
    const row = result.rows[0] ?? {
      total_score: "0.00",
      compliance_rate: "0.0000",
      missing_mandatory_count: "0",
      missing_required_evidence_count: "0",
    };

    return {
      totalScore: row.total_score,
      complianceRate: row.compliance_rate,
      missingMandatoryCount: Number(row.missing_mandatory_count),
      missingRequiredEvidenceCount: Number(row.missing_required_evidence_count ?? 0),
    };
  }

  linkMobileChecklistItemEvidence(
    input: Parameters<ChecklistEvidenceRepository["linkMobileChecklistItemEvidence"]>[0],
  ) {
    return this.evidenceRepository.linkMobileChecklistItemEvidence(input);
  }

  unlinkMobileChecklistItemEvidence(
    input: Parameters<ChecklistEvidenceRepository["unlinkMobileChecklistItemEvidence"]>[0],
  ) {
    return this.evidenceRepository.unlinkMobileChecklistItemEvidence(input);
  }

  assertMobileChecklistItemEvidenceLink(
    input: Parameters<ChecklistEvidenceRepository["assertMobileChecklistItemEvidenceLink"]>[0],
  ) {
    return this.evidenceRepository.assertMobileChecklistItemEvidenceLink(input);
  }

  getMobileChecklistItemEvidenceUploadScope(
    input: Parameters<ChecklistEvidenceRepository["getMobileChecklistItemEvidenceUploadScope"]>[0],
  ) {
    return this.evidenceRepository.getMobileChecklistItemEvidenceUploadScope(input);
  }

  recordMobileChecklistItemEvidenceUploadIntent(
    input: Parameters<ChecklistEvidenceRepository["recordMobileChecklistItemEvidenceUploadIntent"]>[0],
  ) {
    return this.evidenceRepository.recordMobileChecklistItemEvidenceUploadIntent(input);
  }

  assertMobileChecklistItemEvidenceUploadIntent(
    input: Parameters<ChecklistEvidenceRepository["assertMobileChecklistItemEvidenceUploadIntent"]>[0],
  ) {
    return this.evidenceRepository.assertMobileChecklistItemEvidenceUploadIntent(input);
  }

  completeMobileChecklistInstance(
    input: Parameters<ChecklistEvidenceRepository["completeMobileChecklistInstance"]>[0],
  ) {
    return this.evidenceRepository.completeMobileChecklistInstance(input);
  }
  async getMobileChecklistToday(input: {
    actorUserId: string;
    assignedStoreIds: string[];
    readStoreIds: string[];
    readRegionIds?: string[];
    readCompanyIds?: string[];
    allowedTemplateTypes: string[];
  }): Promise<MobileChecklistToday> {
    const explicitStoreIds =
      input.assignedStoreIds.length > 0 ? input.assignedStoreIds : input.readStoreIds;
    const readRegionIds = input.readRegionIds ?? [];
    const readCompanyIds = input.readCompanyIds ?? [];

    if (input.allowedTemplateTypes.length === 0) {
      return {
        stores: [],
        templates: [],
        activeInstances: [],
        completedThisMonth: [],
        pendingAcknowledgements: [],
        monthlySummaries: [],
      };
    }

    if (
      explicitStoreIds.length === 0 &&
      readRegionIds.length === 0 &&
      readCompanyIds.length === 0
    ) {
      return {
        stores: [],
        templates: [],
        activeInstances: [],
        completedThisMonth: [],
        pendingAcknowledgements: [],
        monthlySummaries: [],
      };
    }

    const stores = await this.queryMobileChecklistStores({
      explicitStoreIds,
      readRegionIds,
      readCompanyIds,
    });
    const storeIds = stores.rows.map((row) => row.store_id);

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

    const templates = await this.databaseService.query<{
      checklist_template_id: string;
      template_code: string;
      template_type: string;
      template_name: string;
      version_no: number;
    }>(
      `
        WITH ranked_templates AS (
          SELECT
            ct.checklist_template_id,
            ct.template_code,
            ct.template_type,
            ct.template_name,
            ct.version_no,
            ROW_NUMBER() OVER (
              PARTITION BY ct.company_id, ct.template_type, ct.template_code
              ORDER BY ct.version_no DESC, ct.effective_from DESC, ct.checklist_template_id DESC
            ) AS version_rank
          FROM ops.checklist_template ct
          WHERE ct.company_id IN (
            SELECT DISTINCT s.company_id
            FROM ops.store s
            WHERE s.store_id = ANY($1::uuid[])
          )
            AND ct.template_type = ANY($2::text[])
            AND ct.status = 'published'
            AND ct.effective_from <= CURRENT_DATE
            AND (ct.effective_to IS NULL OR ct.effective_to >= CURRENT_DATE)
        )
        SELECT
          ranked_templates.checklist_template_id,
          ranked_templates.template_code,
          ranked_templates.template_type,
          ranked_templates.template_name,
          ranked_templates.version_no
        FROM ranked_templates
        WHERE ranked_templates.version_rank = 1
        ORDER BY ranked_templates.template_type ASC, ranked_templates.template_name ASC, ranked_templates.version_no DESC
      `,
      [storeIds, input.allowedTemplateTypes],
    );
    const templateIds = templates.rows.map((row) => row.checklist_template_id);

    const templateItems =
      templateIds.length === 0
        ? { rows: [] }
        : await this.databaseService.query<{
            checklist_template_id: string;
            template_item_id: string;
            section_name: string;
            item_no: number;
            item_text: string;
            response_type: ChecklistTemplateResponseType;
            weight: string;
            max_score: string;
            expected_value: string | null;
            evidence_policy: "none" | "optional" | "required";
            max_evidence_count: number;
          }>(
            `
              SELECT
                cti.checklist_template_id,
                cti.template_item_id,
                cti.section_name,
                cti.item_no,
                cti.item_text,
                cti.response_type,
                cti.weight,
                cti.max_score,
                cti.expected_value,
                cti.evidence_policy,
                cti.max_evidence_count
              FROM ops.checklist_template_item cti
              WHERE cti.checklist_template_id = ANY($1::uuid[])
              ORDER BY cti.checklist_template_id, cti.item_no ASC
            `,
            [templateIds],
          );
    const itemsByTemplateId = new Map<
      string,
      Array<{
        templateItemId: string;
        sectionName: string;
        itemNo: number;
        itemText: string;
        responseType: ChecklistTemplateResponseType;
        weight: number;
        maxScore: number;
        minScore?: number;
        lowScoreThreshold?: number | null;
        requiresLowScoreNote?: boolean;
        evidencePolicy: "none" | "optional" | "required";
        maxEvidenceCount: number;
      }>
    >();

    for (const item of templateItems.rows) {
      const items = itemsByTemplateId.get(item.checklist_template_id) ?? [];
      const scorePolicy = parseChecklistScorePolicy(item.expected_value);
      items.push({
        templateItemId: item.template_item_id,
        sectionName: item.section_name,
        itemNo: Number(item.item_no),
        itemText: item.item_text,
        responseType: item.response_type,
        weight: Number(item.weight),
        maxScore: Number(item.max_score),
        ...(scorePolicy.minScore !== null
          ? { minScore: scorePolicy.minScore }
          : {}),
        lowScoreThreshold: scorePolicy.lowScoreThreshold,
        requiresLowScoreNote: scorePolicy.requiresLowScoreNote,
        evidencePolicy: item.evidence_policy ?? "none",
        maxEvidenceCount: Number(item.max_evidence_count ?? 0),
      });
      itemsByTemplateId.set(item.checklist_template_id, items);
    }

    const activeInstances = await this.databaseService.query<{
      checklist_instance_id: string;
      checklist_template_id: string;
      store_id: string;
      status: "planned" | "in_progress";
      started_at: string | null;
      updated_at: string | null;
      responses_json: unknown;
      evidence_version_no: number;
      evidence_json: unknown;
    }>(
      `
        SELECT
          ci.checklist_instance_id,
          ci.checklist_template_id,
          ci.store_id,
          ci.status,
          ci.started_at,
          ci.evidence_version_no,
          COALESCE(MAX(cr.responded_at), ci.created_at) AS updated_at,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'templateItemId', cr.template_item_id,
                'scoreValue', cr.score_value,
                'commentText', cr.comment_text
              )
              ORDER BY cr.responded_at ASC
            ) FILTER (WHERE cr.response_id IS NOT NULL),
            '[]'::jsonb
          ) AS responses_json,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'templateItemId', media.template_item_id,
              'mediaAssetId', media.media_asset_id,
              'displayOrder', media.display_order,
              'captureSource', asset.capture_source,
              'thumbnailAvailable', asset.thumbnail_object_key IS NOT NULL
            ) ORDER BY media.template_item_id, media.display_order)
            FROM ops.checklist_response_media media
            JOIN ops.media_asset asset ON asset.media_asset_id = media.media_asset_id
            WHERE media.checklist_instance_id = ci.checklist_instance_id
              AND media.unlinked_at IS NULL
              AND asset.state = 'ready'
          ), '[]'::jsonb) AS evidence_json
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        LEFT JOIN ops.checklist_response cr
          ON cr.checklist_instance_id = ci.checklist_instance_id
        WHERE ci.store_id = ANY($1::uuid[])
          AND ct.template_type = ANY($2::text[])
          AND ci.status IN ('planned', 'in_progress')
        GROUP BY ci.checklist_instance_id, ci.checklist_template_id, ci.store_id, ci.status,
                 ci.started_at, ci.created_at, ci.evidence_version_no
        ORDER BY ci.created_at DESC
      `,
      [storeIds, input.allowedTemplateTypes],
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
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        LEFT JOIN ops.checklist_acknowledgement ca
          ON ca.checklist_instance_id = ci.checklist_instance_id
        WHERE ci.store_id = ANY($1::uuid[])
          AND ct.template_type = ANY($2::text[])
          AND ci.status = 'completed'
          AND ci.completed_at >= (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')
          AND ci.completed_at < ((date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul') + INTERVAL '1 month') AT TIME ZONE 'Europe/Istanbul')
        ORDER BY ci.completed_at DESC
      `,
      [storeIds, input.allowedTemplateTypes],
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
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        WHERE ci.store_id = ANY($1::uuid[])
          AND ct.template_type = ANY($2::text[])
          AND ci.status = 'completed'
          AND ci.completed_at >= (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')
          AND ci.completed_at < ((date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul') + INTERVAL '1 month') AT TIME ZONE 'Europe/Istanbul')
        GROUP BY ci.store_id, ci.checklist_template_id, date_trunc('month', ci.completed_at)::date
      `,
      [storeIds, input.allowedTemplateTypes],
    );

    return {
      stores: stores.rows.map((row) => ({ storeId: row.store_id, storeName: row.store_name })),
      templates: templates.rows.map((row) => ({
        checklistTemplateId: row.checklist_template_id,
        templateCode: row.template_code,
        templateType: row.template_type,
        templateName: row.template_name,
        versionNo: Number(row.version_no),
        items: itemsByTemplateId.get(row.checklist_template_id) ?? [],
      })),
      activeInstances: activeInstances.rows.map((row) => ({
        checklistInstanceId: row.checklist_instance_id,
        checklistTemplateId: row.checklist_template_id,
        storeId: row.store_id,
        status: row.status,
        startedAt: row.started_at,
        updatedAt: row.updated_at,
        evidenceVersion: Number(row.evidence_version_no ?? 0),
        evidence: this.mapMobileChecklistEvidence(row.evidence_json),
        responses: this.mapMobileChecklistDraftResponses(row.responses_json),
      })),
      completedThisMonth: completedThisMonth.rows.map((row) => ({
        checklistInstanceId: row.checklist_instance_id,
        checklistTemplateId: row.checklist_template_id,
        storeId: row.store_id,
        completedAt: row.completed_at,
        totalScore: row.total_score === null ? null : Number(row.total_score),
        acknowledgedAt: row.acknowledged_at,
      })),
      pendingAcknowledgements: completedThisMonth.rows
        .filter((row) => row.acknowledged_at === null)
        .map((row) => ({
          checklistInstanceId: row.checklist_instance_id,
          checklistTemplateId: row.checklist_template_id,
          storeId: row.store_id,
          completedAt: row.completed_at,
          totalScore: row.total_score === null ? null : Number(row.total_score),
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

  private mapMobileChecklistDraftResponses(
    value: unknown,
  ): MobileChecklistToday["activeInstances"][number]["responses"] {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => {
      const row = item as {
        templateItemId?: unknown;
        scoreValue?: unknown;
        commentText?: unknown;
      };

      return {
        templateItemId: String(row.templateItemId ?? ""),
        scoreValue: Number(row.scoreValue ?? 0),
        commentText: row.commentText === null || row.commentText === undefined
          ? null
          : String(row.commentText),
      };
    }).filter((item) => item.templateItemId.length > 0);
  }

  private mapMobileChecklistEvidence(
    value: unknown,
  ): MobileChecklistToday["activeInstances"][number]["evidence"] {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        templateItemId: String(row.templateItemId ?? ""),
        mediaAssetId: String(row.mediaAssetId ?? ""),
        displayOrder: Number(row.displayOrder ?? 0),
        captureSource: String(row.captureSource ?? "system_generated") as
          | "camera"
          | "gallery"
          | "system_generated",
        thumbnailAvailable: row.thumbnailAvailable === true,
      };
    }).filter((item) => item.templateItemId.length > 0 && item.mediaAssetId.length > 0);
  }

  private async queryMobileChecklistStores(input: {
    explicitStoreIds: string[];
    readRegionIds: string[];
    readCompanyIds: string[];
  }) {
    if (input.explicitStoreIds.length > 0) {
      return this.databaseService.query<{ store_id: string; store_name: string }>(
        `
          SELECT s.store_id, s.store_name
          FROM ops.store s
          WHERE s.store_id = ANY($1::uuid[])
          ORDER BY s.store_name ASC
        `,
        [input.explicitStoreIds],
      );
    }

    if (input.readRegionIds.length > 0) {
      return this.databaseService.query<{ store_id: string; store_name: string }>(
        `
          SELECT s.store_id, s.store_name
          FROM ops.store s
          WHERE s.region_id = ANY($1::uuid[])
          ORDER BY s.store_name ASC
        `,
        [input.readRegionIds],
      );
    }

    return this.databaseService.query<{ store_id: string; store_name: string }>(
      `
        SELECT s.store_id, s.store_name
        FROM ops.store s
        WHERE s.company_id = ANY($1::uuid[])
        ORDER BY s.store_name ASC
      `,
      [input.readCompanyIds],
    );
  }
}
