import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../../shared/database/database.service";
import { VmReferenceManagementRepository } from "./vm-reference-management.repository";

@Injectable()
export class VmCampaignLifecycleRepository extends VmReferenceManagementRepository {
  constructor(database: DatabaseService) {
    super(database);
  }

  async reviseCampaign(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    command: "extend" | "reopen" | "scope_add"; expectedRevision: number;
    idempotencyKey: string; reason: string; startsOn: string; endsOn: string;
    storeIds: string[]; timezone: "Europe/Istanbul";
  }) {
    const requestedStores = [...new Set(input.storeIds)].sort();
    const payloadSha256 = digest({ referenceSetId: input.referenceSetId,
      command: input.command, expectedRevision: input.expectedRevision,
      startsOn: input.startsOn, endsOn: input.endsOn, storeIds: requestedStores,
      reason: input.reason.trim(), timezone: input.timezone });
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      await this.assertPermission(client, input.actorUserId, input.companyId,
        input.command === "scope_add" ? "VM_CAMPAIGN_SCOPE_AUTHORITY" : "VM_CAMPAIGN_WINDOW_AUTHORITY");
      const locked = await client.query<any>(`
        SELECT reference.lifecycle_status, reference.current_revision_no,
          revision.*
        FROM ops.visual_reference_set reference
        INNER JOIN ops.visual_campaign_revision revision
          ON revision.visual_reference_set_id = reference.visual_reference_set_id
         AND revision.revision_no = reference.current_revision_no
        WHERE reference.visual_reference_set_id = $1::uuid
          AND reference.company_id = $2::uuid
        FOR UPDATE OF reference, revision
      `, [input.referenceSetId, input.companyId]);
      const current = locked.rows[0];
      if (!current) throw new NotFoundException("VM campaign was not found");
      const replay = await this.findReceipt(client, input, input.command, payloadSha256);
      if (replay) {
        const revision = await client.query<any>(`
          SELECT revision.revision_no, COUNT(snapshot.store_id)::int AS assigned_store_count
          FROM ops.visual_campaign_revision revision
          INNER JOIN ops.visual_campaign_revision_store snapshot
            ON snapshot.campaign_revision_id = revision.campaign_revision_id
          WHERE revision.campaign_revision_id = $1::uuid
            AND revision.visual_reference_set_id = $2::uuid
            AND revision.company_id = $3::uuid
          GROUP BY revision.campaign_revision_id
        `, [replay.resultEntityId, input.referenceSetId, input.companyId]);
        const row = revision.rows[0];
        if (!row) throw new ConflictException("idempotent_result_missing");
        return { referenceSetId: input.referenceSetId,
          campaignRevisionId: replay.resultEntityId, revision: Number(row.revision_no),
          status: replay.resultCode, assignedStoreCount: Number(row.assigned_store_count) };
      }
      if (current.lifecycle_status === "retired" || Number(current.current_revision_no) !== input.expectedRevision) {
        throw new ConflictException("stale_revision");
      }
      const holdState = await client.query<{ has_hold: boolean; has_unreconciled_hold: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM ops.visual_campaign_assignment
          WHERE visual_reference_set_id = $1::uuid
            AND deadline_status = 'operational_hold'
        ) AS has_hold,
        EXISTS (
          SELECT 1 FROM ops.visual_campaign_assignment
          WHERE visual_reference_set_id = $1::uuid
            AND deadline_status = 'operational_hold'
            AND hold_reconciled_at IS NULL
        ) AS has_unreconciled_hold
      `, [input.referenceSetId]);
      const hasReconciledHold = Boolean(holdState.rows[0]?.has_hold) &&
        holdState.rows[0]?.has_unreconciled_hold !== true;
      if (["extend", "reopen"].includes(input.command) &&
          holdState.rows[0]?.has_unreconciled_hold === true) {
        throw new ConflictException("reconciliation_required");
      }
      if (input.command === "reopen" && current.lifecycle_status !== "closed" && !hasReconciledHold) {
        throw new ConflictException("reopen_requires_closed_campaign");
      }
      if (input.command !== "reopen" && !["scheduled", "open"].includes(current.lifecycle_status)) {
        throw new ConflictException("campaign_is_not_active");
      }
      const windowResult = await client.query<{ starts_at: Date; closes_at: Date }>(`
        SELECT ($1::date::timestamp AT TIME ZONE 'Europe/Istanbul') AS starts_at,
          ((($2::date + 1)::timestamp) AT TIME ZONE 'Europe/Istanbul') AS closes_at
      `, [input.startsOn, input.endsOn]);
      const requestedWindow = windowResult.rows[0];
      if (!requestedWindow || requestedWindow.starts_at >= requestedWindow.closes_at) {
        throw new ConflictException("invalid_campaign_window");
      }
      const existingStores = await client.query<{ store_id: string; region_id: string }>(`
        SELECT store_id, region_id FROM ops.visual_campaign_revision_store
        WHERE campaign_revision_id = $1::uuid ORDER BY store_id
      `, [current.campaign_revision_id]);
      let stores = existingStores.rows;
      let startsAt = current.starts_at as Date;
      let closesAt = current.submission_closes_at as Date;
      if (input.command === "extend") {
        if (requestedWindow.starts_at.getTime() !== startsAt.getTime() ||
            requestedWindow.closes_at <= closesAt || current.lifecycle_status === "closed") {
          throw new ConflictException("invalid_extension");
        }
        closesAt = requestedWindow.closes_at;
      } else if (input.command === "reopen") {
        if (requestedWindow.closes_at <= requestedWindow.starts_at) throw new ConflictException("invalid_reopen");
        startsAt = requestedWindow.starts_at;
        closesAt = requestedWindow.closes_at;
      } else {
        if (requestedStores.length === 0) throw new ConflictException("scope_add_requires_stores");
        if (requestedWindow.starts_at.getTime() !== startsAt.getTime() ||
            requestedWindow.closes_at.getTime() !== closesAt.getTime()) {
          throw new ConflictException("scope_add_cannot_change_window");
        }
        const additions = await client.query<{ store_id: string; region_id: string }>(`
          SELECT store_id, region_id FROM ops.store
          WHERE company_id = $1::uuid AND status = 'active' AND store_id = ANY($2::uuid[])
          ORDER BY store_id FOR UPDATE
        `, [input.companyId, requestedStores]);
        if (additions.rows.length !== requestedStores.length ||
            additions.rows.some((row) => existingStores.rows.some((existing) => existing.store_id === row.store_id))) {
          throw new ConflictException("invalid_scope_add");
        }
        stores = [...existingStores.rows, ...additions.rows].sort((a, b) => a.store_id.localeCompare(b.store_id));
      }
      const templateItems = await client.query<{ template_item_id: string }>(`
        SELECT template_item_id FROM ops.visual_reference_item
        WHERE campaign_revision_id = $1::uuid ORDER BY template_item_id
      `, [current.campaign_revision_id]);
      for (const store of stores) {
        for (const item of templateItems.rows) {
          await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [
            `vm-campaign:${input.companyId}:${store.store_id}:${item.template_item_id}`,
          ]);
        }
      }
      const overlap = await client.query(`
        SELECT 1 FROM ops.visual_campaign_revision revision
        INNER JOIN ops.visual_campaign_revision_store snapshot
          ON snapshot.campaign_revision_id = revision.campaign_revision_id
        INNER JOIN ops.visual_reference_item item
          ON item.campaign_revision_id = revision.campaign_revision_id
        WHERE revision.company_id = $1::uuid
          AND revision.visual_reference_set_id <> $2::uuid
          AND snapshot.store_id = ANY($3::uuid[])
          AND item.template_item_id = ANY($4::uuid[])
          AND revision.starts_at < $6::timestamptz
          AND revision.submission_closes_at > $5::timestamptz
        LIMIT 1
      `, [input.companyId, input.referenceSetId, stores.map((row) => row.store_id),
        templateItems.rows.map((row) => row.template_item_id), startsAt, closesAt]);
      if (overlap.rows[0]) throw new ConflictException("overlapping_campaign");
      const revisionNo = input.expectedRevision + 1;
      const snapshotSha256 = digest(stores.map((store) => ({ storeId: store.store_id, regionId: store.region_id })));
      const revisionResult = await client.query<{ campaign_revision_id: string }>(`
        INSERT INTO ops.visual_campaign_revision (
          visual_reference_set_id, company_id, parent_revision_id, revision_no,
          expected_revision, reference_version_no, visual_reference_version_id,
          starts_at, submission_closes_at, timezone_name, revision_type,
          revision_reason, assigned_store_snapshot_sha256, command_digest,
          created_by_user_id
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::uuid,$8,$9,
          'Europe/Istanbul',$10,$11,$12,$13,$14::uuid)
        RETURNING campaign_revision_id
      `, [input.referenceSetId, input.companyId, current.campaign_revision_id,
        revisionNo, input.expectedRevision, current.reference_version_no,
        current.visual_reference_version_id, startsAt, closesAt, input.command,
        input.reason.trim(), snapshotSha256, payloadSha256, input.actorUserId]);
      const revisionId = revisionResult.rows[0]!.campaign_revision_id;
      for (const store of stores) {
        await client.query(`
          INSERT INTO ops.visual_campaign_revision_store (
            campaign_revision_id, visual_reference_set_id, company_id, region_id,
            store_id, snapshot_sha256
          ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6)
        `, [revisionId, input.referenceSetId, input.companyId, store.region_id,
          store.store_id, digest({ storeId: store.store_id, regionId: store.region_id })]);
      }
      await client.query(`
        WITH cloned AS (
          INSERT INTO ops.visual_reference_item (
            campaign_revision_id, visual_reference_set_id, visual_reference_version_id,
            company_id, checklist_template_id, template_item_id, item_order,
            expected_visual_intent, allowed_variants_json, review_instructions,
            rubric_version, required_evidence_count
          ) SELECT $1::uuid, item.visual_reference_set_id,
            item.visual_reference_version_id, item.company_id,
            item.checklist_template_id, item.template_item_id, item.item_order,
            item.expected_visual_intent, item.allowed_variants_json,
            item.review_instructions, item.rubric_version, item.required_evidence_count
          FROM ops.visual_reference_item item
          WHERE item.campaign_revision_id = $2::uuid
          RETURNING visual_reference_item_id, template_item_id
        )
        INSERT INTO ops.visual_reference_item_asset (
          visual_reference_item_id, campaign_revision_id, visual_reference_set_id,
          company_id, media_asset_id, display_order
        ) SELECT cloned.visual_reference_item_id, $1::uuid,
          old_item.visual_reference_set_id, old_item.company_id,
          asset.media_asset_id, asset.display_order
        FROM cloned
        INNER JOIN ops.visual_reference_item old_item
          ON old_item.campaign_revision_id = $2::uuid
         AND old_item.template_item_id = cloned.template_item_id
        INNER JOIN ops.visual_reference_item_asset asset
          ON asset.visual_reference_item_id = old_item.visual_reference_item_id
      `, [revisionId, current.campaign_revision_id]);
      await client.query(`
        UPDATE ops.visual_campaign_assignment SET active_campaign_revision_id = CASE
            WHEN deadline_status = 'missed' AND $2 <> 'reopen'
              THEN active_campaign_revision_id
            ELSE $1::uuid END,
          deadline_status = CASE
            WHEN $2 IN ('extend','reopen') AND deadline_status = 'operational_hold'
              AND hold_reconciled_at IS NOT NULL THEN
              CASE WHEN CURRENT_TIMESTAMP >= $3::timestamptz THEN 'open' ELSE 'scheduled' END
            WHEN $2 = 'reopen' AND deadline_status = 'missed' THEN
              CASE WHEN CURRENT_TIMESTAMP >= $3::timestamptz THEN 'open' ELSE 'scheduled' END
            ELSE deadline_status END,
          current_hold_reason = CASE
            WHEN $2 IN ('extend','reopen') AND deadline_status = 'operational_hold'
              AND hold_reconciled_at IS NOT NULL THEN NULL
            ELSE current_hold_reason END,
          hold_reconciled_at = CASE
            WHEN $2 IN ('extend','reopen') AND deadline_status = 'operational_hold'
              AND hold_reconciled_at IS NOT NULL THEN NULL
            ELSE hold_reconciled_at END,
          optimistic_version = optimistic_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE visual_reference_set_id = $4::uuid
          AND deadline_status IN ('scheduled','open','missed','operational_hold')
      `, [revisionId, input.command, startsAt, input.referenceSetId]);
      if (input.command === "scope_add") {
        const existingIds = new Set(existingStores.rows.map((row) => row.store_id));
        for (const store of stores.filter((row) => !existingIds.has(row.store_id))) {
          await client.query(`
            INSERT INTO ops.visual_campaign_assignment (
              visual_reference_set_id, active_campaign_revision_id, company_id,
              region_id, store_id, deadline_status, review_status
            ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,
              CASE WHEN CURRENT_TIMESTAMP >= $6::timestamptz THEN 'open' ELSE 'scheduled' END,
              'not_submitted')
          `, [input.referenceSetId, revisionId, input.companyId, store.region_id,
            store.store_id, startsAt]);
        }
      }
      const lifecycle = await client.query<{ lifecycle_status: string }>(`UPDATE ops.visual_reference_set SET current_revision_no = $2,
        lifecycle_status = CASE WHEN CURRENT_TIMESTAMP >= $3::timestamptz THEN 'open' ELSE 'scheduled' END,
        updated_at = CURRENT_TIMESTAMP WHERE visual_reference_set_id = $1::uuid
        RETURNING lifecycle_status`,
      [input.referenceSetId, revisionNo, startsAt]);
      const status = lifecycle.rows[0]?.lifecycle_status ?? "scheduled";
      await this.insertReceipt(client, input, input.command, payloadSha256, status, revisionId);
      await this.insertPhotoAudit(client, { actorUserId: input.actorUserId,
        eventType: `checklist_photo_evidence.campaign.${input.command}`,
        entityName: "visual_reference_set", entityId: input.referenceSetId,
        companyId: input.companyId, stateBefore: current.lifecycle_status,
        stateAfter: status, campaignRevisionId: revisionId,
        commandDigest: payloadSha256, idempotencyKey: input.idempotencyKey,
        snapshotDigest: snapshotSha256 });
      return { referenceSetId: input.referenceSetId, campaignRevisionId: revisionId,
        revision: revisionNo, status, assignedStoreCount: stores.length };
    });
  }

  async changeAssignmentState(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    assignmentId: string; command: "withdraw" | "exempt" | "hold" | "reconcile";
    expectedVersion: number; idempotencyKey: string; reason: string;
  }) {
    const payloadSha256 = digest({ referenceSetId: input.referenceSetId,
      assignmentId: input.assignmentId, command: input.command,
      expectedVersion: input.expectedVersion, reason: input.reason.trim() });
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      await this.assertPermission(client, input.actorUserId, input.companyId,
        ["withdraw", "exempt"].includes(input.command)
          ? "VM_CAMPAIGN_SCOPE_AUTHORITY" : "VM_CAMPAIGN_EMERGENCY_AUTHORITY");
      const locked = await client.query<any>(`
        SELECT assignment.*, revision.starts_at, revision.submission_closes_at
        FROM ops.visual_campaign_assignment assignment
        INNER JOIN ops.visual_campaign_revision revision
          ON revision.campaign_revision_id = assignment.active_campaign_revision_id
        WHERE assignment.assignment_id = $1::uuid
          AND assignment.visual_reference_set_id = $2::uuid
          AND assignment.company_id = $3::uuid
        FOR UPDATE OF assignment, revision
      `, [input.assignmentId, input.referenceSetId, input.companyId]);
      const assignment = locked.rows[0];
      if (!assignment) throw new NotFoundException("VM campaign assignment was not found");
      const replay = await this.findReceipt(client, input, input.command, payloadSha256);
      if (replay) return { assignmentId: input.assignmentId,
        deadlineStatus: input.command === "reconcile" ? "operational_hold" : replay.resultCode,
        version: input.expectedVersion + 1 };
      if (Number(assignment.optimistic_version) !== input.expectedVersion) {
        throw new ConflictException("stale_assignment");
      }
      let nextStatus: string;
      if (input.command === "hold") {
        if (!["scheduled", "open"].includes(assignment.deadline_status)) throw new ConflictException("invalid_hold");
        nextStatus = "operational_hold";
      } else if (input.command === "reconcile") {
        if (assignment.deadline_status !== "operational_hold") throw new ConflictException("invalid_reconciliation");
        if (assignment.hold_reconciled_at) throw new ConflictException("reconciliation_already_recorded");
        nextStatus = "operational_hold";
      } else {
        if (!["scheduled", "open", "operational_hold"].includes(assignment.deadline_status)) {
          throw new ConflictException("assignment_already_final");
        }
        nextStatus = input.command === "withdraw" ? "withdrawn" : "exempt";
      }
      await client.query(`
        UPDATE ops.visual_campaign_assignment SET deadline_status = $2,
          current_hold_reason = CASE
            WHEN $4 = 'hold' THEN $3
            WHEN $4 = 'reconcile' THEN current_hold_reason
            ELSE NULL END,
          hold_reconciled_at = CASE
            WHEN $4 = 'reconcile' THEN CURRENT_TIMESTAMP
            ELSE NULL END,
          optimistic_version = optimistic_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE assignment_id = $1::uuid
      `, [input.assignmentId, nextStatus, input.reason.trim(), input.command]);
      if (["withdrawn", "exempt"].includes(nextStatus)) {
        await client.query(`
          INSERT INTO ops.visual_campaign_assignment_outcome (
            assignment_id, campaign_revision_id, visual_reference_set_id, company_id,
            region_id, store_id, deadline_status, review_status, classified_at,
            classification_reason, classified_by_user_id
          ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,
            $7,$8,CURRENT_TIMESTAMP,$9,$10::uuid)
          ON CONFLICT (assignment_id, campaign_revision_id) DO NOTHING
        `, [input.assignmentId, assignment.active_campaign_revision_id,
          input.referenceSetId, input.companyId, assignment.region_id,
          assignment.store_id, nextStatus, assignment.review_status,
          input.reason.trim(), input.actorUserId]);
      }
      await this.insertReceipt(client, input, input.command, payloadSha256,
        input.command === "reconcile" ? "reconciled" : nextStatus, input.assignmentId);
      await this.insertPhotoAudit(client, { actorUserId: input.actorUserId,
        eventType: `checklist_photo_evidence.campaign.${input.command}`,
        entityName: "visual_campaign_assignment", entityId: input.assignmentId,
        companyId: input.companyId, regionId: assignment.region_id,
        storeId: assignment.store_id, stateBefore: assignment.deadline_status,
        stateAfter: nextStatus, campaignRevisionId: assignment.active_campaign_revision_id,
        commandDigest: payloadSha256, idempotencyKey: input.idempotencyKey });
      return { assignmentId: input.assignmentId, deadlineStatus: nextStatus,
        version: input.expectedVersion + 1 };
    });
  }

  async retireReference(input: {
    actorUserId: string; companyId: string; referenceSetId: string;
    expectedRevision: number; idempotencyKey: string; reason: string;
  }) {
    const payloadSha256 = digest({ referenceSetId: input.referenceSetId,
      expectedRevision: input.expectedRevision, reason: input.reason.trim() });
    return this.database.withTransaction(async (client) => {
      await this.assertPermission(client, input.actorUserId, input.companyId, "VM_REFERENCE_PUBLISHER");
      await this.assertPermission(client, input.actorUserId, input.companyId,
        "VM_CAMPAIGN_EMERGENCY_AUTHORITY");
      const reference = await client.query<any>(`
        SELECT lifecycle_status, current_revision_no FROM ops.visual_reference_set
        WHERE visual_reference_set_id = $1::uuid AND company_id = $2::uuid FOR UPDATE
      `, [input.referenceSetId, input.companyId]);
      const row = reference.rows[0];
      if (!row) throw new NotFoundException("VM reference was not found");
      const replay = await this.findReceipt(client, input, "retire", payloadSha256);
      if (replay) return { referenceSetId: input.referenceSetId, status: "retired" };
      if (Number(row.current_revision_no) !== input.expectedRevision) throw new ConflictException("stale_revision");
      if (row.lifecycle_status !== "closed") throw new ConflictException("retire_requires_closed_campaign");
      const unresolved = await client.query(`SELECT 1 FROM ops.visual_campaign_assignment
        WHERE visual_reference_set_id = $1::uuid
          AND deadline_status IN ('scheduled','open','operational_hold') LIMIT 1`, [input.referenceSetId]);
      if (unresolved.rows[0]) throw new ConflictException("campaign_requires_settlement_or_reconciliation");
      const missingPinnedRetention = await client.query(`
        SELECT 1
        FROM ops.visual_reference_item_asset reference_asset
        INNER JOIN ops.media_asset asset
          ON asset.media_asset_id = reference_asset.media_asset_id
        LEFT JOIN ops.evidence_retention_policy policy
          ON policy.retention_policy_id = asset.retention_policy_id
         AND policy.company_id = asset.company_id
         AND policy.version_no = asset.retention_policy_version
        WHERE reference_asset.visual_reference_set_id = $1::uuid
          AND reference_asset.company_id = $2::uuid
          AND asset.classification = 'vm_reference'
          AND policy.retention_policy_id IS NULL
        LIMIT 1
      `, [input.referenceSetId, input.companyId]);
      if (missingPinnedRetention.rows[0]) {
        throw new ConflictException("reference_retention_policy_missing");
      }
      await client.query(`UPDATE ops.visual_reference_set SET lifecycle_status = 'retired',
        retired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE visual_reference_set_id = $1::uuid`, [input.referenceSetId]);
      await client.query(`
        UPDATE ops.media_asset asset SET active_workflow_hold = FALSE,
          expires_at = CURRENT_TIMESTAMP + make_interval(days => policy.reference_retention_days),
          updated_at = CURRENT_TIMESTAMP
        FROM ops.visual_reference_item_asset reference_asset,
          ops.evidence_retention_policy policy
        WHERE reference_asset.media_asset_id = asset.media_asset_id
          AND reference_asset.visual_reference_set_id = $1::uuid
          AND reference_asset.company_id = $2::uuid
          AND asset.company_id = $2::uuid
          AND asset.classification = 'vm_reference'
          AND policy.retention_policy_id = asset.retention_policy_id
          AND policy.company_id = asset.company_id
          AND policy.version_no = asset.retention_policy_version
      `, [input.referenceSetId, input.companyId]);
      await this.insertReceipt(client, input, "retire", payloadSha256, "retired", input.referenceSetId);
      await this.insertPhotoAudit(client, { actorUserId: input.actorUserId,
        eventType: "checklist_photo_evidence.reference.retired",
        entityName: "visual_reference_set", entityId: input.referenceSetId,
        companyId: input.companyId, stateBefore: row.lifecycle_status,
        stateAfter: "retired", commandDigest: payloadSha256,
        idempotencyKey: input.idempotencyKey });
      return { referenceSetId: input.referenceSetId, status: "retired" };
    });
  }
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
