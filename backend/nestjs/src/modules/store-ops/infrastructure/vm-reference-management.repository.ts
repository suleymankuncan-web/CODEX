import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";

type DbClient = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };

const ASSIGNMENT_SCOPE_SQL = `
  SELECT assignment.store_id
  FROM ops.visual_campaign_assignment assignment
  INNER JOIN ops.store active_store ON active_store.store_id = assignment.store_id
    AND active_store.region_id = assignment.region_id
    AND active_store.company_id = assignment.company_id
    AND active_store.status = 'active'
  INNER JOIN ops.region active_region ON active_region.region_id = assignment.region_id
    AND active_region.company_id = assignment.company_id
    AND active_region.status = 'active'
  INNER JOIN ops.company active_company ON active_company.company_id = assignment.company_id
    AND active_company.status = 'active'
  INNER JOIN ops.user_account actor ON actor.user_id = $3::uuid AND actor.is_active = TRUE
  WHERE assignment.assignment_id = $1::uuid
    AND assignment.store_id = ANY($2::uuid[])
    AND EXISTS (
      SELECT 1 FROM ops.user_role_assignment role_assignment
      INNER JOIN ops.role role ON role.role_id = role_assignment.role_id
      WHERE role_assignment.user_id = $3::uuid AND role.role_code = 'STORE_MANAGER'
        AND role_assignment.store_id = assignment.store_id
        AND role_assignment.start_at <= CURRENT_TIMESTAMP
        AND (role_assignment.end_at IS NULL OR role_assignment.end_at >= CURRENT_TIMESTAMP)
    )
    AND EXISTS (
      SELECT 1 FROM ops.user_action_store_assignment action_assignment
      WHERE action_assignment.user_id = $3::uuid
        AND action_assignment.store_id = assignment.store_id
        AND action_assignment.start_at <= CURRENT_TIMESTAMP
        AND (action_assignment.end_at IS NULL OR action_assignment.end_at >= CURRENT_TIMESTAMP)
    )
`;

@Injectable()
export class VmReferenceManagementRepository {
  constructor(protected readonly database: DatabaseService) {}

  async createDraft(input: {
    actorUserId: string; companyId: string; referenceCode: string;
    referenceName: string; instructions: string;
  }) {
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      const result = await client.query<any>(`
        INSERT INTO ops.visual_reference_set (
          company_id, reference_code, reference_name, instructions, created_by_user_id
        ) VALUES ($1::uuid, $2, $3, $4, $5::uuid)
        RETURNING visual_reference_set_id, company_id, reference_code, reference_name,
          instructions, lifecycle_status, draft_optimistic_version, created_at, updated_at
      `, [input.companyId, input.referenceCode.trim(), input.referenceName.trim(),
        input.instructions.trim(), input.actorUserId]);
      const row = result.rows[0];
      if (!row) throw new ConflictException("VM reference draft could not be created");
      await this.insertPhotoAudit(client, {
        actorUserId: input.actorUserId, eventType: "checklist_photo_evidence.reference.draft_created",
        entityName: "visual_reference_set", entityId: row.visual_reference_set_id,
        companyId: input.companyId, stateAfter: "draft",
      });
      return mapReference(row);
    });
  }

  async listPublisherReferences(input: { companyId: string; limit: number; offset: number }) {
    const result = await this.database.query<any>(`
      SELECT visual_reference_set_id, company_id, reference_code, reference_name,
        instructions, lifecycle_status, draft_optimistic_version, current_revision_no,
        created_at, updated_at, retired_at,
        COUNT(*) OVER()::int AS total_count
      FROM ops.visual_reference_set
      WHERE company_id = $1::uuid
      ORDER BY updated_at DESC, visual_reference_set_id
      LIMIT $2 OFFSET $3
    `, [input.companyId, input.limit, input.offset]);
    return {
      items: result.rows.map(mapReference),
      total: Number(result.rows[0]?.total_count ?? 0),
      limit: input.limit,
      offset: input.offset,
    };
  }

  async listPublisherOptions(input: { companyId: string }) {
    const [stores, templates] = await Promise.all([
      this.database.query<{ store_id: string; store_name: string }>(`
        SELECT store_id, store_name FROM ops.store
        WHERE company_id = $1::uuid AND status = 'active'
        ORDER BY store_name, store_id
      `, [input.companyId]),
      this.database.query<any>(`
        SELECT template.checklist_template_id, template.template_name,
          item.template_item_id, item.section_name, item.item_no, item.item_text
        FROM ops.checklist_template template
        INNER JOIN ops.checklist_template_item item
          ON item.checklist_template_id = template.checklist_template_id
        WHERE template.company_id = $1::uuid
          AND template.template_type = 'VM_STORE_VISIT'
          AND template.status = 'published'
          AND template.effective_from <= CURRENT_DATE
          AND (template.effective_to IS NULL OR template.effective_to >= CURRENT_DATE)
        ORDER BY template.template_name, template.version_no DESC, item.item_no
      `, [input.companyId]),
    ]);
    const byTemplate = new Map<string, any>();
    for (const row of templates.rows) {
      const entry = byTemplate.get(row.checklist_template_id) ?? {
        templateId: row.checklist_template_id, templateName: row.template_name, items: [],
      };
      entry.items.push({ templateItemId: row.template_item_id,
        sectionName: row.section_name, itemNo: Number(row.item_no), itemText: row.item_text });
      byTemplate.set(row.checklist_template_id, entry);
    }
    return { stores: stores.rows.map((row) => ({ storeId: row.store_id, storeName: row.store_name })),
      templates: [...byTemplate.values()] };
  }

  async listReviewerCampaigns(input: { companyId: string; limit: number; offset: number }) {
    const result = await this.database.query<any>(`
      SELECT assignment.assignment_id, assignment.store_id, store.store_name,
        reference.visual_reference_set_id, reference.reference_name,
        assignment.deadline_status, assignment.review_status,
        assignment.optimistic_version, revision.starts_at, revision.submission_closes_at,
        COALESCE(items.items_json, '[]'::jsonb) AS items_json,
        COUNT(*) OVER()::int AS total_count
      FROM ops.visual_campaign_assignment assignment
      INNER JOIN ops.visual_reference_set reference
        ON reference.visual_reference_set_id = assignment.visual_reference_set_id
      INNER JOIN ops.visual_campaign_revision revision
        ON revision.campaign_revision_id = assignment.active_campaign_revision_id
      INNER JOIN ops.store store ON store.store_id = assignment.store_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'referenceItemId', item.visual_reference_item_id,
          'templateItemId', item.template_item_id,
          'expectedVisualIntent', item.expected_visual_intent,
          'reviewInstructions', item.review_instructions,
          'requiredEvidenceCount', item.required_evidence_count,
          'referenceAssetId', asset.media_asset_id
        ) ORDER BY item.item_order, item.visual_reference_item_id) AS items_json
        FROM ops.visual_reference_item item
        INNER JOIN ops.visual_reference_item_asset asset
          ON asset.visual_reference_item_id = item.visual_reference_item_id
         AND asset.display_order = 0
        WHERE item.campaign_revision_id = assignment.active_campaign_revision_id
      ) items ON TRUE
      WHERE assignment.company_id = $1::uuid
      ORDER BY revision.submission_closes_at, store.store_name, assignment.assignment_id
      LIMIT $2 OFFSET $3
    `, [input.companyId, input.limit, input.offset]);
    return { items: result.rows.map(mapAssignment),
      total: Number(result.rows[0]?.total_count ?? 0), limit: input.limit, offset: input.offset };
  }

  async upsertDraftItem(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    templateId: string; templateItemId: string; itemOrder: number;
    expectedVisualIntent: string; reviewInstructions: string; rubricVersion: string;
    expectedRevision: number; requiredEvidenceCount: 1; allowedVariants: readonly [];
  }) {
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      const locked = await client.query<any>(`
        SELECT lifecycle_status, draft_optimistic_version
        FROM ops.visual_reference_set
        WHERE visual_reference_set_id = $1::uuid AND company_id = $2::uuid
        FOR UPDATE
      `, [input.referenceSetId, input.companyId]);
      const reference = locked.rows[0];
      if (!reference || reference.lifecycle_status !== "draft" ||
          Number(reference.draft_optimistic_version) !== input.expectedRevision) {
        throw new ConflictException("VM reference draft revision is stale");
      }
      if (input.allowedVariants.length !== 0 || input.requiredEvidenceCount !== 1) {
        throw new ConflictException("VM reference V1 requires empty variants and one evidence asset");
      }
      const result = await client.query<any>(`
        INSERT INTO ops.visual_reference_draft_item (
          visual_reference_set_id, company_id, checklist_template_id, template_item_id,
          item_order, expected_visual_intent, allowed_variants_json,
          review_instructions, rubric_version, required_evidence_count
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,'[]'::jsonb,$7,$8,1)
        ON CONFLICT (visual_reference_set_id, template_item_id) DO UPDATE SET
          item_order = EXCLUDED.item_order,
          expected_visual_intent = EXCLUDED.expected_visual_intent,
          review_instructions = EXCLUDED.review_instructions,
          rubric_version = EXCLUDED.rubric_version,
          updated_at = NOW()
        RETURNING visual_reference_draft_item_id
      `, [input.referenceSetId, input.companyId, input.templateId, input.templateItemId,
        input.itemOrder, input.expectedVisualIntent.trim(), input.reviewInstructions.trim(),
        input.rubricVersion.trim()]);
      await client.query(`
        UPDATE ops.visual_reference_set SET draft_optimistic_version = draft_optimistic_version + 1,
          updated_at = NOW() WHERE visual_reference_set_id = $1::uuid
      `, [input.referenceSetId]);
      return { draftItemId: result.rows[0]!.visual_reference_draft_item_id,
        version: input.expectedRevision + 1 };
    });
  }

  async createReferenceUploadIntent(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    draftItemId: string; mediaAssetId: string;
  }) {
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      const result = await client.query(`
        INSERT INTO ops.visual_reference_upload_intent (
          visual_reference_set_id, visual_reference_draft_item_id, media_asset_id,
          company_id, initiated_by_user_id
        )
        SELECT item.visual_reference_set_id, item.visual_reference_draft_item_id,
          asset.media_asset_id, item.company_id, $5::uuid
        FROM ops.visual_reference_draft_item item
        INNER JOIN ops.visual_reference_set reference
          ON reference.visual_reference_set_id = item.visual_reference_set_id
         AND reference.company_id = item.company_id
        INNER JOIN ops.media_asset asset
          ON asset.media_asset_id = $4::uuid AND asset.company_id = item.company_id
        WHERE item.visual_reference_set_id = $1::uuid
          AND item.visual_reference_draft_item_id = $2::uuid
          AND item.company_id = $3::uuid
          AND reference.lifecycle_status = 'draft'
          AND asset.store_id IS NULL
          AND asset.uploaded_by_user_id = $5::uuid
          AND asset.classification = 'vm_reference'
        RETURNING visual_reference_upload_intent_id
      `, [input.referenceSetId, input.draftItemId, input.companyId, input.mediaAssetId, input.actorUserId]);
      if (!result.rows[0]) throw new ForbiddenException("VM reference asset is outside the draft scope");
    });
  }

  async hasReferenceUploadIntent(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    draftItemId: string; mediaAssetId: string;
  }) {
    const result = await this.database.query(`
      SELECT TRUE AS ok FROM ops.visual_reference_upload_intent
      WHERE visual_reference_set_id = $1::uuid
        AND visual_reference_draft_item_id = $2::uuid
        AND company_id = $3::uuid
        AND media_asset_id = $4::uuid
        AND initiated_by_user_id = $5::uuid
    `, [input.referenceSetId, input.draftItemId, input.companyId, input.mediaAssetId, input.actorUserId]);
    return Boolean(result.rows[0]);
  }

  async linkFinalizedReferenceAsset(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    draftItemId: string; mediaAssetId: string;
  }) {
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      const result = await client.query(`
        INSERT INTO ops.visual_reference_draft_item_asset (
          visual_reference_draft_item_id, visual_reference_set_id, company_id,
          media_asset_id, display_order
        )
        SELECT intent.visual_reference_draft_item_id, intent.visual_reference_set_id,
          intent.company_id, intent.media_asset_id, 0
        FROM ops.visual_reference_upload_intent intent
        INNER JOIN ops.media_asset asset ON asset.media_asset_id = intent.media_asset_id
        WHERE intent.visual_reference_set_id = $1::uuid
          AND intent.visual_reference_draft_item_id = $2::uuid
          AND intent.company_id = $3::uuid
          AND intent.media_asset_id = $4::uuid
          AND intent.initiated_by_user_id = $5::uuid
          AND asset.state = 'ready' AND asset.classification = 'vm_reference'
        ON CONFLICT (visual_reference_draft_item_id, media_asset_id) DO NOTHING
        RETURNING visual_reference_draft_item_asset_id
      `, [input.referenceSetId, input.draftItemId, input.companyId,
        input.mediaAssetId, input.actorUserId]);
      if (!result.rows[0]) throw new ForbiddenException("Ready VM reference asset is not bound to this draft");
    });
  }

  async publish(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    expectedRevision: number; idempotencyKey: string; startsOn: string; endsOn: string;
    storeIds: string[]; reason: string; timezone: "Europe/Istanbul";
    requiredEvidenceCount: 1; allowedVariants: readonly [];
  }) {
    const payloadSha256 = digest({
      referenceSetId: input.referenceSetId, expectedRevision: input.expectedRevision,
      startsOn: input.startsOn, endsOn: input.endsOn,
      storeIds: [...new Set(input.storeIds)].sort(), reason: input.reason.trim(),
      timezone: input.timezone, requiredEvidenceCount: 1, allowedVariants: [],
    });
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      const aggregateResult = await client.query<any>(`
        SELECT * FROM ops.visual_reference_set
        WHERE visual_reference_set_id = $1::uuid AND company_id = $2::uuid
        FOR UPDATE
      `, [input.referenceSetId, input.companyId]);
      const aggregate = aggregateResult.rows[0];
      if (!aggregate) throw new NotFoundException("VM reference draft was not found");
      const replay = await this.findReceipt(client, input, "publish", payloadSha256);
      if (replay) {
        const published = await client.query<any>(`
          SELECT revision.campaign_revision_id, revision.visual_reference_version_id,
            revision.starts_at, revision.submission_closes_at,
            COUNT(snapshot.store_id)::int AS assigned_store_count
          FROM ops.visual_campaign_revision revision
          INNER JOIN ops.visual_campaign_revision_store snapshot
            ON snapshot.campaign_revision_id = revision.campaign_revision_id
          WHERE revision.campaign_revision_id = $1::uuid
            AND revision.visual_reference_set_id = $2::uuid
            AND revision.company_id = $3::uuid
          GROUP BY revision.campaign_revision_id
        `, [replay.resultEntityId, input.referenceSetId, input.companyId]);
        const row = published.rows[0];
        if (!row) throw new ConflictException("idempotent_result_missing");
        return { referenceSetId: input.referenceSetId,
          referenceVersionId: row.visual_reference_version_id,
          campaignRevisionId: row.campaign_revision_id, status: replay.resultCode,
          startsAt: row.starts_at, submissionClosesAt: row.submission_closes_at,
          assignedStoreCount: Number(row.assigned_store_count) };
      }
      if (aggregate.lifecycle_status !== "draft" ||
          Number(aggregate.draft_optimistic_version) !== input.expectedRevision) {
        throw new ConflictException("VM reference draft revision is stale");
      }
      if (input.storeIds.length === 0 || input.allowedVariants.length !== 0 || input.requiredEvidenceCount !== 1) {
        throw new ConflictException("VM reference V1 requires exact stores, empty variants, and one evidence asset");
      }
      const stores = await client.query<{ store_id: string; region_id: string }>(`
        SELECT store_id, region_id FROM ops.store
        WHERE company_id = $1::uuid AND status = 'active'
          AND store_id = ANY($2::uuid[])
        ORDER BY store_id FOR UPDATE
      `, [input.companyId, [...new Set(input.storeIds)]]);
      if (stores.rows.length !== new Set(input.storeIds).size) {
        throw new ForbiddenException("VM reference includes an unavailable store");
      }
      const draftItems = await client.query<any>(`
        SELECT item.*, asset.media_asset_id, media.canonical_sha256
        FROM ops.visual_reference_draft_item item
        INNER JOIN ops.visual_reference_draft_item_asset asset
          ON asset.visual_reference_draft_item_id = item.visual_reference_draft_item_id
        INNER JOIN ops.visual_reference_upload_intent intent
          ON intent.visual_reference_draft_item_id = item.visual_reference_draft_item_id
         AND intent.media_asset_id = asset.media_asset_id
        INNER JOIN ops.media_asset media
          ON media.media_asset_id = asset.media_asset_id
         AND media.company_id = item.company_id
        WHERE item.visual_reference_set_id = $1::uuid AND item.company_id = $2::uuid
          AND item.allowed_variants_json = '[]'::jsonb
          AND item.required_evidence_count = 1
          AND media.classification = 'vm_reference' AND media.state = 'ready'
        ORDER BY item.item_order, item.template_item_id
      `, [input.referenceSetId, input.companyId]);
      if (draftItems.rows.length === 0) throw new ConflictException("VM reference requires ready draft items");
      const duplicateItem = draftItems.rows.some((row, index, rows) =>
        index > 0 && row.visual_reference_draft_item_id === rows[index - 1].visual_reference_draft_item_id);
      if (duplicateItem) throw new ConflictException("VM reference V1 requires exactly one asset per item");
      const startsAndCloses = await client.query<{ starts_at: Date; closes_at: Date }>(`
        SELECT ($1::date::timestamp AT TIME ZONE 'Europe/Istanbul') AS starts_at,
          ((($2::date + 1)::timestamp) AT TIME ZONE 'Europe/Istanbul') AS closes_at
      `, [input.startsOn, input.endsOn]);
      const window = startsAndCloses.rows[0];
      if (!window || window.starts_at >= window.closes_at) throw new ConflictException("VM campaign window is invalid");
      for (const store of stores.rows) {
        for (const item of draftItems.rows) {
          await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [
            `vm-campaign:${input.companyId}:${store.store_id}:${item.template_item_id}`,
          ]);
        }
      }
      const overlap = await client.query(`
        SELECT 1
        FROM ops.visual_campaign_revision revision
        INNER JOIN ops.visual_campaign_revision_store snapshot
          ON snapshot.campaign_revision_id = revision.campaign_revision_id
        INNER JOIN ops.visual_reference_item item
          ON item.campaign_revision_id = revision.campaign_revision_id
        WHERE revision.company_id = $1::uuid
          AND snapshot.store_id = ANY($2::uuid[])
          AND item.template_item_id = ANY($3::uuid[])
          AND revision.starts_at < $5::timestamptz
          AND revision.submission_closes_at > $4::timestamptz
        LIMIT 1
      `, [input.companyId, stores.rows.map((row) => row.store_id),
        draftItems.rows.map((row) => row.template_item_id), window.starts_at, window.closes_at]);
      if (overlap.rows[0]) throw new ConflictException("overlapping_campaign");
      const snapshotSha256 = digest(stores.rows.map((row) => ({ storeId: row.store_id, regionId: row.region_id })));
      const contentSha256 = digest(draftItems.rows.map((row) => ({
        templateItemId: row.template_item_id, mediaAssetId: row.media_asset_id,
        canonicalSha256: row.canonical_sha256, rubricVersion: row.rubric_version,
      })));
      const versionResult = await client.query<{ visual_reference_version_id: string }>(`
        INSERT INTO ops.visual_reference_version (
          visual_reference_set_id, company_id, version_no, instructions,
          content_sha256, published_by_user_id
        ) VALUES ($1::uuid,$2::uuid,1,$3,$4,$5::uuid)
        RETURNING visual_reference_version_id
      `, [input.referenceSetId, input.companyId, aggregate.instructions, contentSha256, input.actorUserId]);
      const versionId = versionResult.rows[0]!.visual_reference_version_id;
      const revisionResult = await client.query<{ campaign_revision_id: string }>(`
        INSERT INTO ops.visual_campaign_revision (
          visual_reference_set_id, company_id, revision_no, expected_revision,
          reference_version_no, visual_reference_version_id, starts_at,
          submission_closes_at, timezone_name, revision_type, revision_reason,
          assigned_store_snapshot_sha256, command_digest, created_by_user_id
        ) VALUES ($1::uuid,$2::uuid,1,$3,1,$4::uuid,$5,$6,'Europe/Istanbul',
          'publish',$7,$8,$9,$10::uuid)
        RETURNING campaign_revision_id
      `, [input.referenceSetId, input.companyId, input.expectedRevision, versionId,
        window.starts_at, window.closes_at, input.reason.trim(), snapshotSha256,
        payloadSha256, input.actorUserId]);
      const revisionId = revisionResult.rows[0]!.campaign_revision_id;
      for (const store of stores.rows) {
        await client.query(`
          INSERT INTO ops.visual_campaign_revision_store (
            campaign_revision_id, visual_reference_set_id, company_id, region_id,
            store_id, snapshot_sha256
          ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6)
        `, [revisionId, input.referenceSetId, input.companyId, store.region_id,
          store.store_id, digest({ storeId: store.store_id, regionId: store.region_id })]);
        await client.query(`
          INSERT INTO ops.visual_campaign_assignment (
            visual_reference_set_id, active_campaign_revision_id, company_id,
            region_id, store_id, deadline_status, review_status
          ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,
            CASE WHEN CURRENT_TIMESTAMP >= $6::timestamptz THEN 'open' ELSE 'scheduled' END,
            'not_submitted')
        `, [input.referenceSetId, revisionId, input.companyId, store.region_id,
          store.store_id, window.starts_at]);
      }
      for (const item of draftItems.rows) {
        const publishedItem = await client.query<{ visual_reference_item_id: string }>(`
          INSERT INTO ops.visual_reference_item (
            campaign_revision_id, visual_reference_set_id, visual_reference_version_id,
            company_id, checklist_template_id, template_item_id, item_order,
            expected_visual_intent, allowed_variants_json, review_instructions,
            rubric_version, required_evidence_count
          ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,
            $8,'[]'::jsonb,$9,$10,1)
          RETURNING visual_reference_item_id
        `, [revisionId, input.referenceSetId, versionId, input.companyId,
          item.checklist_template_id, item.template_item_id, item.item_order,
          item.expected_visual_intent, item.review_instructions, item.rubric_version]);
        await client.query(`
          INSERT INTO ops.visual_reference_item_asset (
            visual_reference_item_id, campaign_revision_id, visual_reference_set_id,
            company_id, media_asset_id, display_order
          ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,0)
        `, [publishedItem.rows[0]!.visual_reference_item_id, revisionId,
          input.referenceSetId, input.companyId, item.media_asset_id]);
        await client.query(`UPDATE ops.media_asset SET active_workflow_hold = TRUE, expires_at = 'infinity'::timestamptz, updated_at = NOW() WHERE media_asset_id = $1::uuid`, [item.media_asset_id]);
      }
      const statusResult = await client.query<{ lifecycle_status: string }>(`
        UPDATE ops.visual_reference_set SET lifecycle_status =
          CASE WHEN CURRENT_TIMESTAMP >= $2::timestamptz THEN 'open' ELSE 'scheduled' END,
          current_revision_no = 1, draft_optimistic_version = draft_optimistic_version + 1,
          updated_at = NOW() WHERE visual_reference_set_id = $1::uuid
        RETURNING lifecycle_status
      `, [input.referenceSetId, window.starts_at]);
      const status = statusResult.rows[0]?.lifecycle_status ?? "scheduled";
      await this.insertReceipt(client, input, "publish", payloadSha256, status, revisionId);
      await this.insertPhotoAudit(client, {
        actorUserId: input.actorUserId, eventType: "checklist_photo_evidence.reference.published",
        entityName: "visual_reference_set", entityId: input.referenceSetId,
        companyId: input.companyId, stateBefore: "draft", stateAfter: status,
        referenceVersionId: versionId, campaignRevisionId: revisionId,
        commandDigest: payloadSha256, snapshotDigest: snapshotSha256,
      });
      return { referenceSetId: input.referenceSetId, referenceVersionId: versionId,
        campaignRevisionId: revisionId, status, startsAt: window.starts_at,
        submissionClosesAt: window.closes_at, assignedStoreCount: stores.rows.length };
    });
  }

  async listStoreAssignments(input: { storeIds: string[]; limit: number; offset: number }) {
    const result = await this.database.query<any>(`
      SELECT assignment.assignment_id, assignment.store_id, store.store_name,
        reference.visual_reference_set_id, reference.reference_name,
        assignment.deadline_status, assignment.review_status,
        assignment.optimistic_version, revision.starts_at, revision.submission_closes_at,
        COALESCE(items.items_json, '[]'::jsonb) AS items_json,
        COUNT(*) OVER()::int AS total_count
      FROM ops.visual_campaign_assignment assignment
      INNER JOIN ops.visual_reference_set reference
        ON reference.visual_reference_set_id = assignment.visual_reference_set_id
      INNER JOIN ops.visual_campaign_revision revision
        ON revision.campaign_revision_id = assignment.active_campaign_revision_id
      INNER JOIN ops.store store ON store.store_id = assignment.store_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'referenceItemId', item.visual_reference_item_id,
          'templateItemId', item.template_item_id,
          'expectedVisualIntent', item.expected_visual_intent,
          'reviewInstructions', item.review_instructions,
          'requiredEvidenceCount', item.required_evidence_count,
          'referenceAssetId', asset.media_asset_id
        ) ORDER BY item.item_order, item.visual_reference_item_id) AS items_json
        FROM ops.visual_reference_item item
        INNER JOIN ops.visual_reference_item_asset asset
          ON asset.visual_reference_item_id = item.visual_reference_item_id
         AND asset.display_order = 0
        WHERE item.campaign_revision_id = assignment.active_campaign_revision_id
      ) items ON TRUE
      WHERE assignment.store_id = ANY($1::uuid[])
      ORDER BY revision.submission_closes_at, assignment.assignment_id
      LIMIT $2 OFFSET $3
    `, [input.storeIds, input.limit, input.offset]);
    return { items: result.rows.map(mapAssignment), total: Number(result.rows[0]?.total_count ?? 0),
      limit: input.limit, offset: input.offset };
  }

  async getAssignmentScope(input: { assignmentId: string; actorUserId: string; storeIds: string[] }) {
    const result = await this.database.query<{ store_id: string }>(ASSIGNMENT_SCOPE_SQL,
      [input.assignmentId, input.storeIds, input.actorUserId]);
    return result.rows[0] ? { storeId: result.rows[0].store_id } : null;
  }

  async getAssignmentReferenceAsset(input: {
    assignmentId: string; referenceItemId: string; actorUserId: string; storeIds: string[];
  }) {
    const result = await this.database.query<{ media_asset_id: string }>(`
      WITH authorized_assignment AS (${ASSIGNMENT_SCOPE_SQL})
      SELECT asset.media_asset_id
      FROM ops.visual_campaign_assignment assignment
      INNER JOIN authorized_assignment authorized
        ON authorized.store_id = assignment.store_id
      INNER JOIN ops.visual_reference_item item
        ON item.campaign_revision_id = assignment.active_campaign_revision_id
       AND item.visual_reference_item_id = $4::uuid
      INNER JOIN ops.visual_reference_item_asset asset
        ON asset.visual_reference_item_id = item.visual_reference_item_id
       AND asset.display_order = 0
      WHERE assignment.assignment_id = $1::uuid
      LIMIT 1
    `, [input.assignmentId, input.storeIds, input.actorUserId, input.referenceItemId]);
    return result.rows[0] ? { mediaAssetId: result.rows[0].media_asset_id } : null;
  }

  private async getAssignmentScopeWithClient(client: DbClient, input: {
    assignmentId: string; actorUserId: string; storeIds: string[];
  }) {
    const result = await client.query<{ store_id: string }>(ASSIGNMENT_SCOPE_SQL,
      [input.assignmentId, input.storeIds, input.actorUserId]);
    return result.rows[0] ? { storeId: result.rows[0].store_id } : null;
  }

  async createSubmissionUploadIntent(input: {
    assignmentId: string; referenceItemId: string; mediaAssetId: string; actorUserId: string;
    storeIds: string[];
  }) {
    return this.database.withTransaction(async (client) => {
      const scope = await this.getAssignmentScopeWithClient(client, input);
      if (!scope) throw new ForbiddenException("VM campaign submission is outside fresh Store Manager scope");
      const result = await client.query(`
        INSERT INTO ops.visual_campaign_submission_upload_intent (
          assignment_id, visual_reference_item_id, media_asset_id,
          visual_reference_set_id, campaign_revision_id, company_id, region_id,
          store_id, initiated_by_user_id
        )
        SELECT assignment.assignment_id, item.visual_reference_item_id,
          asset.media_asset_id, assignment.visual_reference_set_id,
          assignment.active_campaign_revision_id, assignment.company_id,
          assignment.region_id, assignment.store_id, $4::uuid
        FROM ops.visual_campaign_assignment assignment
        INNER JOIN ops.visual_reference_item item
          ON item.campaign_revision_id = assignment.active_campaign_revision_id
         AND item.visual_reference_item_id = $2::uuid
        INNER JOIN ops.media_asset asset
          ON asset.media_asset_id = $3::uuid
         AND asset.company_id = assignment.company_id
         AND asset.store_id = assignment.store_id
        WHERE assignment.assignment_id = $1::uuid
          AND assignment.store_id = $5::uuid
          AND asset.uploaded_by_user_id = $4::uuid
          AND asset.classification = 'vm_campaign_evidence'
        RETURNING visual_campaign_submission_upload_intent_id
      `, [input.assignmentId, input.referenceItemId, input.mediaAssetId, input.actorUserId, scope.storeId]);
      if (!result.rows[0]) throw new ForbiddenException("VM campaign asset is outside assignment scope");
    });
  }

  async hasSubmissionUploadIntent(input: {
    assignmentId: string; referenceItemId: string; mediaAssetId: string; actorUserId: string;
    storeIds: string[];
  }) {
    return this.database.withTransaction(async (client) => {
      const scope = await this.getAssignmentScopeWithClient(client, input);
      if (!scope) return false;
      const result = await client.query(`
        SELECT TRUE AS ok
        FROM ops.visual_campaign_submission_upload_intent intent
        WHERE intent.assignment_id = $1::uuid
          AND intent.visual_reference_item_id = $2::uuid
          AND intent.media_asset_id = $3::uuid
          AND intent.initiated_by_user_id = $4::uuid
          AND intent.store_id = $5::uuid
      `, [input.assignmentId, input.referenceItemId, input.mediaAssetId,
        input.actorUserId, scope.storeId]);
      return Boolean(result.rows[0]);
    });
  }

  async submit(input: {
    assignmentId: string; actorUserId: string; storeIds: string[];
    expectedVersion: number; idempotencyKey: string;
    items: Array<{ referenceItemId: string; mediaAssetId: string }>;
  }) {
    const normalizedItems = [...input.items].sort((a, b) => a.referenceItemId.localeCompare(b.referenceItemId));
    const payloadSha256 = digest({ assignmentId: input.assignmentId,
      expectedVersion: input.expectedVersion, items: normalizedItems });
    return this.database.withTransaction(async (client) => {
      const scope = await this.getAssignmentScopeWithClient(client, { assignmentId: input.assignmentId,
        actorUserId: input.actorUserId, storeIds: input.storeIds });
      if (!scope) throw new ForbiddenException("VM campaign submission is outside fresh Store Manager scope");
      const locked = await client.query<any>(`
        SELECT assignment.*, revision.starts_at, revision.submission_closes_at,
          reference.reference_name,
          (CURRENT_TIMESTAMP >= revision.starts_at
           AND CURRENT_TIMESTAMP < revision.submission_closes_at) AS window_open
        FROM ops.visual_campaign_assignment assignment
        INNER JOIN ops.visual_campaign_revision revision
          ON revision.campaign_revision_id = assignment.active_campaign_revision_id
        INNER JOIN ops.visual_reference_set reference
          ON reference.visual_reference_set_id = assignment.visual_reference_set_id
        WHERE assignment.assignment_id = $1::uuid
        FOR UPDATE OF assignment, revision
      `, [input.assignmentId]);
      const assignment = locked.rows[0];
      if (!assignment || assignment.store_id !== scope.storeId) throw new ForbiddenException("VM campaign assignment is unavailable");
      const existing = await client.query<any>(`
        SELECT submission.payload_sha256, submission.campaign_submission_id
        FROM ops.visual_campaign_submission submission
        WHERE submission.assignment_id = $1::uuid AND submission.idempotency_key = $2::uuid
      `, [input.assignmentId, input.idempotencyKey]);
      if (existing.rows[0]) {
        if (existing.rows[0].payload_sha256 !== payloadSha256) throw new ConflictException("idempotency_mismatch");
        return { assignmentId: input.assignmentId, submissionId: existing.rows[0].campaign_submission_id,
          deadlineStatus: "on_time", reviewStatus: "review_pending",
          version: input.expectedVersion + 1 };
      }
      if (!assignment.window_open) throw new ConflictException("window_closed");
      if (assignment.deadline_status === "operational_hold") throw new ConflictException("assignment_held");
      if (!["scheduled", "open"].includes(assignment.deadline_status)) {
        throw new ConflictException("assignment_already_final");
      }
      if (Number(assignment.optimistic_version) !== input.expectedVersion) throw new ConflictException("stale_revision");
      const required = await client.query<{ visual_reference_item_id: string }>(`
        SELECT visual_reference_item_id FROM ops.visual_reference_item
        WHERE campaign_revision_id = $1::uuid ORDER BY visual_reference_item_id
      `, [assignment.active_campaign_revision_id]);
      if (required.rows.length !== normalizedItems.length ||
          required.rows.some((row, index) => row.visual_reference_item_id !== normalizedItems[index]?.referenceItemId)) {
        throw new ConflictException("VM campaign submission must include every exact reference item once");
      }
      for (const item of normalizedItems) {
        const asset = await client.query(`
          SELECT TRUE AS ok
          FROM ops.visual_campaign_submission_upload_intent intent
          INNER JOIN ops.media_asset media ON media.media_asset_id = intent.media_asset_id
          WHERE intent.assignment_id = $1::uuid
            AND intent.visual_reference_item_id = $2::uuid
            AND intent.media_asset_id = $3::uuid
            AND intent.initiated_by_user_id = $4::uuid
            AND media.classification = 'vm_campaign_evidence'
            AND media.state = 'ready'
        `, [input.assignmentId, item.referenceItemId, item.mediaAssetId, input.actorUserId]);
        if (!asset.rows[0]) throw new ForbiddenException("Ready campaign evidence is not bound to this assignment");
      }
      const submission = await client.query<{ campaign_submission_id: string }>(`
        INSERT INTO ops.visual_campaign_submission (
          assignment_id, campaign_revision_id, visual_reference_set_id, company_id,
          region_id, store_id, submitted_by_user_id, idempotency_key, finalized_at,
          payload_sha256
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,
          $8::uuid,CURRENT_TIMESTAMP,$9)
        RETURNING campaign_submission_id
      `, [input.assignmentId, assignment.active_campaign_revision_id,
        assignment.visual_reference_set_id, assignment.company_id, assignment.region_id,
        assignment.store_id, input.actorUserId, input.idempotencyKey, payloadSha256]);
      const submissionId = submission.rows[0]!.campaign_submission_id;
      for (let index = 0; index < normalizedItems.length; index += 1) {
        const item = normalizedItems[index];
        await client.query(`
          INSERT INTO ops.visual_campaign_submission_media (
            campaign_submission_id, campaign_revision_id, visual_reference_set_id,
            company_id, region_id, store_id, visual_reference_item_id,
            media_asset_id, display_order
          ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,
            $7::uuid,$8::uuid,$9)
        `, [submissionId, assignment.active_campaign_revision_id,
          assignment.visual_reference_set_id, assignment.company_id, assignment.region_id,
          assignment.store_id, item.referenceItemId, item.mediaAssetId, index]);
      }
      await client.query(`
        UPDATE ops.visual_campaign_assignment SET
          first_valid_submission_at = COALESCE(first_valid_submission_at, CURRENT_TIMESTAMP),
          deadline_status = 'on_time', review_status = 'review_pending',
          optimistic_version = optimistic_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE assignment_id = $1::uuid
      `, [input.assignmentId]);
      await client.query(`
        INSERT INTO ops.visual_campaign_assignment_outcome (
          assignment_id, campaign_revision_id, visual_reference_set_id, company_id,
          region_id, store_id, deadline_status, review_status,
          first_valid_submission_at, classified_at, classified_by_user_id
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,
          'on_time','review_pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$7::uuid)
        ON CONFLICT (assignment_id, campaign_revision_id) DO NOTHING
      `, [input.assignmentId, assignment.active_campaign_revision_id,
        assignment.visual_reference_set_id, assignment.company_id, assignment.region_id,
        assignment.store_id, input.actorUserId]);
      await this.insertReceipt(client, {
        actorUserId: input.actorUserId, companyId: assignment.company_id,
        referenceSetId: assignment.visual_reference_set_id,
        idempotencyKey: input.idempotencyKey,
      }, "submit", payloadSha256, "on_time", submissionId);
      await this.insertPhotoAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "checklist_photo_evidence.campaign.submitted",
        entityName: "visual_campaign_submission", entityId: submissionId,
        companyId: assignment.company_id, regionId: assignment.region_id,
        storeId: assignment.store_id, stateBefore: assignment.deadline_status,
        stateAfter: "on_time", campaignRevisionId: assignment.active_campaign_revision_id,
        commandDigest: payloadSha256, idempotencyKey: input.idempotencyKey,
      });
      return { assignmentId: input.assignmentId, submissionId, deadlineStatus: "on_time",
        reviewStatus: "review_pending", version: input.expectedVersion + 1 };
    });
  }

  async settleDueAssignments(limit: number) {
    return this.database.withTransaction(async (client) => {
      const due = await client.query<any>(`
        SELECT assignment.*, revision.starts_at, revision.submission_closes_at,
          (CURRENT_TIMESTAMP >= revision.submission_closes_at
           AND assignment.first_valid_submission_at IS NULL) AS should_miss,
          (CURRENT_TIMESTAMP >= revision.starts_at
           AND CURRENT_TIMESTAMP < revision.submission_closes_at) AS should_open
        FROM ops.visual_campaign_assignment assignment
        INNER JOIN ops.visual_campaign_revision revision
          ON revision.campaign_revision_id = assignment.active_campaign_revision_id
        WHERE assignment.deadline_status IN ('scheduled', 'open')
          AND (CURRENT_TIMESTAMP >= revision.starts_at OR CURRENT_TIMESTAMP >= revision.submission_closes_at)
        ORDER BY revision.submission_closes_at, assignment.assignment_id
        LIMIT $1 FOR UPDATE OF assignment SKIP LOCKED
      `, [limit]);
      let opened = 0;
      let missed = 0;
      for (const assignment of due.rows) {
        if (assignment.should_miss) {
          await client.query(`
            UPDATE ops.visual_campaign_assignment SET deadline_status = 'missed',
              optimistic_version = optimistic_version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = $1::uuid AND deadline_status IN ('scheduled','open')
          `, [assignment.assignment_id]);
          await client.query(`
            INSERT INTO ops.visual_campaign_assignment_outcome (
              assignment_id, campaign_revision_id, visual_reference_set_id, company_id,
              region_id, store_id, deadline_status, review_status, classified_at,
              classification_reason
            ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,
              'missed',$7,CURRENT_TIMESTAMP,'deadline_elapsed')
            ON CONFLICT (assignment_id, campaign_revision_id) DO NOTHING
          `, [assignment.assignment_id, assignment.active_campaign_revision_id,
            assignment.visual_reference_set_id, assignment.company_id,
            assignment.region_id, assignment.store_id, assignment.review_status]);
          await this.insertPhotoAudit(client, {
            eventType: "checklist_photo_evidence.campaign.missed",
            entityName: "visual_campaign_assignment", entityId: assignment.assignment_id,
            companyId: assignment.company_id, regionId: assignment.region_id,
            storeId: assignment.store_id, stateBefore: assignment.deadline_status,
            stateAfter: "missed", campaignRevisionId: assignment.active_campaign_revision_id,
          });
          const settlementDigest = digest({ assignmentId: assignment.assignment_id,
            campaignRevisionId: assignment.active_campaign_revision_id, result: "missed" });
          await this.insertSystemReceipt(client, {
            companyId: assignment.company_id,
            referenceSetId: assignment.visual_reference_set_id,
            idempotencyKey: assignment.active_campaign_revision_id,
          }, "settle", settlementDigest, "missed", assignment.assignment_id);
          missed += 1;
        } else if (assignment.deadline_status === "scheduled" && assignment.should_open) {
          await client.query(`
            UPDATE ops.visual_campaign_assignment SET deadline_status = 'open',
              optimistic_version = optimistic_version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = $1::uuid AND deadline_status = 'scheduled'
          `, [assignment.assignment_id]);
          opened += 1;
        }
      }
      await client.query(`
        UPDATE ops.visual_reference_set reference SET lifecycle_status = 'closed',
          updated_at = CURRENT_TIMESTAMP
        WHERE reference.lifecycle_status IN ('scheduled','open')
          AND reference.current_revision_no > 0
          AND NOT EXISTS (
            SELECT 1 FROM ops.visual_campaign_assignment assignment
            WHERE assignment.visual_reference_set_id = reference.visual_reference_set_id
              AND assignment.deadline_status IN ('scheduled','open','operational_hold')
          )
      `);
      return { opened, missed };
    });
  }

  protected async assertPermission(client: DbClient, actorUserId: string,
    companyId: string, permissionCode: string) {
    const result = await client.query(`
      SELECT TRUE AS ok
      FROM ops.user_account actor
      INNER JOIN ops.company active_company
        ON active_company.company_id = $2::uuid AND active_company.status = 'active'
      WHERE actor.user_id = $1::uuid AND actor.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM ops.user_role_assignment persona_assignment
        INNER JOIN ops.role persona_role ON persona_role.role_id = persona_assignment.role_id
         AND persona_role.role_scope_type = 'store'
        INNER JOIN ops.store persona_store
          ON persona_store.store_id = persona_assignment.store_id
         AND persona_store.region_id = persona_assignment.region_id
         AND persona_store.company_id = persona_assignment.company_id
         AND persona_store.status = 'active'
        INNER JOIN ops.region persona_region
          ON persona_region.region_id = persona_store.region_id
         AND persona_region.company_id = persona_store.company_id
         AND persona_region.status = 'active'
        WHERE persona_assignment.user_id = $1::uuid
          AND persona_assignment.company_id = $2::uuid
          AND persona_assignment.scope_type = 'store'
          AND persona_role.role_code = 'VISUAL_MERCHANDISER'
          AND persona_assignment.start_at <= CURRENT_TIMESTAMP
          AND (persona_assignment.end_at IS NULL OR persona_assignment.end_at >= CURRENT_TIMESTAMP)
      )
      AND EXISTS (
        SELECT 1 FROM ops.user_role_assignment capability_assignment
        INNER JOIN ops.role capability_role
          ON capability_role.role_id = capability_assignment.role_id
         AND capability_role.role_scope_type = 'company'
        INNER JOIN ops.role_permission role_permission
          ON role_permission.role_id = capability_assignment.role_id
        INNER JOIN ops.permission permission
          ON permission.permission_id = role_permission.permission_id
        WHERE capability_assignment.user_id = $1::uuid
          AND capability_assignment.company_id = $2::uuid
          AND capability_assignment.scope_type = 'company'
          AND capability_assignment.region_id IS NULL
          AND capability_assignment.store_id IS NULL
          AND permission.permission_code = $3
          AND capability_assignment.start_at <= CURRENT_TIMESTAMP
          AND (capability_assignment.end_at IS NULL OR capability_assignment.end_at >= CURRENT_TIMESTAMP)
      )
      LIMIT 1
    `, [actorUserId, companyId, permissionCode]);
    if (!result.rows[0]) throw new ForbiddenException("VM reference permission is not active");
  }

  protected async findReceipt(client: DbClient, input: {
    actorUserId: string; companyId: string; referenceSetId: string; idempotencyKey: string;
  }, commandType: string, payloadSha256: string) {
    const result = await client.query<any>(`
      SELECT payload_sha256, result_code, result_entity_id
      FROM ops.visual_campaign_command_receipt
      WHERE visual_reference_set_id = $1::uuid AND actor_identity = $2
        AND command_type = $3 AND idempotency_key = $4::uuid
    `, [input.referenceSetId, input.actorUserId, commandType, input.idempotencyKey]);
    const row = result.rows[0];
    if (!row) return null;
    if (row.payload_sha256 !== payloadSha256) throw new ConflictException("idempotency_mismatch");
    return { referenceSetId: input.referenceSetId, resultCode: row.result_code,
      resultEntityId: row.result_entity_id, replayed: true };
  }

  protected async insertReceipt(client: DbClient, input: {
    actorUserId: string; companyId: string; referenceSetId: string; idempotencyKey: string;
  }, commandType: string, payloadSha256: string, resultCode: string, resultEntityId: string) {
    await client.query(`
      INSERT INTO ops.visual_campaign_command_receipt (
        visual_reference_set_id, company_id, actor_user_id, actor_identity, command_type,
        idempotency_key, payload_sha256, result_code, result_entity_id
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,$3,$4,$5::uuid,$6,$7,$8::uuid)
    `, [input.referenceSetId, input.companyId, input.actorUserId, commandType,
      input.idempotencyKey, payloadSha256, resultCode, resultEntityId]);
  }

  private async insertSystemReceipt(client: DbClient, input: {
    companyId: string; referenceSetId: string; idempotencyKey: string;
  }, commandType: string, payloadSha256: string, resultCode: string, resultEntityId: string) {
    await client.query(`
      INSERT INTO ops.visual_campaign_command_receipt (
        visual_reference_set_id, company_id, actor_user_id, actor_identity, command_type,
        idempotency_key, payload_sha256, result_code, result_entity_id
      ) VALUES ($1::uuid,$2::uuid,NULL,'system:settlement',$3,$4::uuid,$5,$6,$7::uuid)
      ON CONFLICT (visual_reference_set_id, actor_identity, command_type, idempotency_key)
      DO NOTHING
    `, [input.referenceSetId, input.companyId, commandType, input.idempotencyKey,
      payloadSha256, resultCode, resultEntityId]);
  }

  protected async insertPhotoAudit(client: DbClient, input: {
    actorUserId?: string; eventType: string; entityName: string; entityId: string;
    companyId: string; regionId?: string; storeId?: string; stateBefore?: string;
    stateAfter?: string; referenceVersionId?: string; campaignRevisionId?: string;
    commandDigest?: string; idempotencyKey?: string; snapshotDigest?: string;
  }) {
    await client.query(`
      INSERT INTO audit.photo_evidence_event (
        actor_user_id, event_type, entity_name, entity_id, company_id, region_id,
        store_id, correlation_id, state_before, state_after,
        visual_reference_version_id, campaign_revision_id, command_digest,
        idempotency_key, assignment_snapshot_sha256
      ) VALUES ($1::uuid,$2,$3,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10,
        $11::uuid,$12::uuid,$13,$14::uuid,$15)
    `, [input.actorUserId ?? null, input.eventType, input.entityName, input.entityId,
      input.companyId, input.regionId ?? null, input.storeId ?? null,
      RequestContextStore.getCorrelationId(), input.stateBefore ?? null,
      input.stateAfter ?? null, input.referenceVersionId ?? null,
      input.campaignRevisionId ?? null, input.commandDigest ?? null,
      input.idempotencyKey ?? null, input.snapshotDigest ?? null]);
  }
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function mapReference(row: any) {
  return {
    referenceSetId: row.visual_reference_set_id,
    companyId: row.company_id,
    referenceCode: row.reference_code,
    referenceName: row.reference_name,
    instructions: row.instructions,
    status: row.lifecycle_status,
    version: Number(row.current_revision_no) > 0
      ? Number(row.current_revision_no)
      : Number(row.draft_optimistic_version ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retiredAt: row.retired_at ?? null,
  };
}

function mapAssignment(row: any) {
  return {
    assignmentId: row.assignment_id,
    storeId: row.store_id,
    storeName: row.store_name,
    referenceSetId: row.visual_reference_set_id,
    referenceName: row.reference_name,
    deadlineStatus: row.deadline_status,
    reviewStatus: row.review_status,
    version: Number(row.optimistic_version),
    startsAt: row.starts_at,
    submissionClosesAt: row.submission_closes_at,
    items: row.items_json ?? [],
  };
}
