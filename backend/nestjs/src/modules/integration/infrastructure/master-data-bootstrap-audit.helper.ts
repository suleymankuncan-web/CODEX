import type { PoolClient } from "pg";

type BootstrapAuditEntity = "store" | "personnel";

type BootstrapAuditSummary = {
  batch_status: string;
  row_count: number;
  valid_count: number;
  needs_review_count: number;
  invalid_count: number;
  promoted_count: number;
};

export async function auditBootstrapBatchCreated(
  client: PoolClient,
  input: {
    bootstrapEntity: BootstrapAuditEntity;
    companyId: string;
    fileReference?: string;
    rows: unknown[];
    sourceLabel: string;
    uploadedByUserId: string;
  },
  batchId: string,
) {
  await insertMasterDataBootstrapAuditEvent(client, {
    actorUserId: input.uploadedByUserId,
    batchId,
    companyId: input.companyId,
    eventType: "master_data_bootstrap.batch.created",
    metadata: {
      bootstrapEntity: input.bootstrapEntity,
      fileReference: input.fileReference ?? null,
      rowCount: input.rows.length,
      sourceLabel: input.sourceLabel,
    },
  });
}

export async function auditBootstrapBatchValidated(
  client: PoolClient,
  input: {
    actorUserId?: string;
    batchId: string;
    bootstrapEntity?: BootstrapAuditEntity;
    companyId?: string;
  },
  batch: BootstrapAuditSummary,
) {
  if (!input.actorUserId || !input.companyId || !input.bootstrapEntity) return;
  await insertMasterDataBootstrapAuditEvent(client, {
    actorUserId: input.actorUserId,
    batchId: input.batchId,
    companyId: input.companyId,
    eventType: "master_data_bootstrap.batch.validated",
    metadata: buildSummaryMetadata(batch, {
      bootstrapEntity: input.bootstrapEntity,
    }),
  });
}

export async function auditBootstrapRowsPromoted(
  client: PoolClient,
  input: {
    actorUserId?: string;
    batchId: string;
    companyId?: string;
  },
  batch: BootstrapAuditSummary,
  promotedRows: number,
  eventType: "master_data_bootstrap.stores.promoted" | "master_data_bootstrap.personnel.promoted",
) {
  if (!input.actorUserId || !input.companyId) return;
  await insertMasterDataBootstrapAuditEvent(client, {
    actorUserId: input.actorUserId,
    batchId: input.batchId,
    companyId: input.companyId,
    eventType,
    metadata: buildSummaryMetadata(batch, { promotedRows }),
  });
}

function buildSummaryMetadata(
  batch: BootstrapAuditSummary,
  extra: Record<string, unknown>,
) {
  return {
    batchStatus: batch.batch_status,
    invalidCount: batch.invalid_count,
    needsReviewCount: batch.needs_review_count,
    promotedCount: batch.promoted_count,
    rowCount: batch.row_count,
    validCount: batch.valid_count,
    ...extra,
  };
}

async function insertMasterDataBootstrapAuditEvent(
  client: PoolClient,
  input: {
    actorUserId: string;
    batchId: string;
    companyId: string;
    eventType: string;
    metadata: Record<string, unknown>;
  },
) {
  const actorResult = await client.query<{ user_id: string }>(
    `
      SELECT user_id::text AS user_id
      FROM ops.user_account
      WHERE user_id::text = $1
      LIMIT 1
    `,
    [input.actorUserId],
  );
  const actorUserId = actorResult?.rows?.[0]?.user_id ?? null;

  await client.query(
    `
      INSERT INTO audit.event_log (
        actor_user_id,
        event_type,
        entity_name,
        entity_id,
        scope_type,
        company_id,
        metadata_json
      )
      VALUES ($1::uuid, $2, $3, $4::uuid, 'company', $5::uuid, $6::jsonb)
    `,
    [
      actorUserId,
      input.eventType,
      "stg.master_data_bootstrap_batch",
      input.batchId,
      input.companyId,
      JSON.stringify({
        ...input.metadata,
        requestedActorUserId: input.actorUserId,
      }),
    ],
  );
}
