import { ConflictException, ForbiddenException } from "@nestjs/common";
import { StoreActionPhotoReviewRepository } from "./store-action-photo-review.repository";

const ids = {
  plan: "10000000-0000-4000-8000-000000000001",
  company: "10000000-0000-4000-8000-000000000002",
  region: "10000000-0000-4000-8000-000000000003",
  store: "10000000-0000-4000-8000-000000000004",
  actor: "10000000-0000-4000-8000-000000000005",
  asset: "10000000-0000-4000-8000-000000000006",
  attempt: "10000000-0000-4000-8000-000000000007",
  key: "10000000-0000-4000-8000-000000000008",
};

const planRow = {
  store_action_plan_id: ids.plan, company_id: ids.company, region_id: ids.region,
  store_id: ids.store, owner_user_id: ids.actor, resolution_workflow_version: 2,
  status: "in_progress", photo_evidence_version: 0, current_solution_attempt_id: null,
};

function harness(handler: (sql: string, params: unknown[]) => { rows: unknown[] }) {
  const query = jest.fn((sql: string, params: unknown[] = []) => Promise.resolve(handler(sql, params)));
  const database = {
    withTransaction: jest.fn((callback: (client: { query: typeof query }) => unknown) => callback({ query })),
    query,
  };
  return { repository: new StoreActionPhotoReviewRepository(database as never), query };
}

function projection(status = "solution_review_pending", version = 1) {
  return { rows: [{ store_action_plan_id: ids.plan, status, photo_evidence_version: version,
    current_solution_attempt_id: ids.attempt, finding_media_asset_ids: [], attempts: [] }] };
}

describe("StoreActionPhotoReviewRepository", () => {
  it("[FR-05][NFR-03][EC-06] atomically submits bound ready evidence, applies hold and dual audit", async () => {
    const { repository, query } = harness((sql) => {
      if (sql.includes("SELECT * FROM ops.store_action_plan")) return { rows: [planRow] };
      if (sql.includes("SELECT attempt.*")) return { rows: [] };
      if (sql.includes("FROM ops.media_asset asset")) return { rows: [{ media_asset_id: ids.asset, canonical_sha256: "a".repeat(64) }] };
      if (sql.includes("COALESCE(MAX(attempt_no)")) return { rows: [{ attempt_no: 1 }] };
      if (sql.includes("RETURNING solution_attempt_id")) return { rows: [{ solution_attempt_id: ids.attempt }] };
      if (sql.includes("AS finding_media_asset_ids")) return projection();
      return { rows: [] };
    });
    await repository.submit({ actionPlanId: ids.plan, actorUserId: ids.actor,
      resolutionNote: "Düzeltildi", mediaAssetId: ids.asset, expectedVersion: 0,
      idempotencyKey: ids.key, actor: { displayName: "Store Manager" } });
    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("asset.state = 'ready'");
    expect(sql).toContain("active_workflow_hold = TRUE");
    expect(sql).toContain("INSERT INTO audit.photo_evidence_event");
    expect(sql).toContain("INSERT INTO audit.event_log");
  });

  it("[EC-02] rejects a reused submission key with a different payload", async () => {
    const { repository } = harness((sql) => {
      if (sql.includes("SELECT * FROM ops.store_action_plan")) return { rows: [planRow] };
      if (sql.includes("SELECT attempt.*")) return { rows: [{ resolution_note: "Original",
        media_asset_id: ids.asset, expected_version: 0 }] };
      return { rows: [] };
    });
    await expect(repository.submit({ actionPlanId: ids.plan, actorUserId: ids.actor,
      resolutionNote: "Changed", mediaAssetId: ids.asset, expectedVersion: 0,
      idempotencyKey: ids.key, actor: {} })).rejects.toBeInstanceOf(ConflictException);
  });

  it("[AC-02][EC-03] rechecks Region Manager scope before idempotent replay", async () => {
    const { repository, query } = harness((sql) => {
      if (sql.includes("SELECT * FROM ops.store_action_plan")) return { rows: [{ ...planRow,
        status: "closed", current_solution_attempt_id: ids.attempt, photo_evidence_version: 1 }] };
      return { rows: [{ solution_attempt_id: ids.attempt, decision: "approve", expected_version: 1 }] };
    });
    await expect(repository.review({ actionPlanId: ids.plan, solutionAttemptId: ids.attempt,
      actorUserId: ids.actor, actorRegionIds: [], actorStoreIds: [], decision: "approve",
      expectedVersion: 1, idempotencyKey: ids.key, actor: {} })).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("[FR-06][EC-05] rejects a superseded attempt before any review write", async () => {
    const { repository, query } = harness((sql) => {
      if (sql.includes("SELECT * FROM ops.store_action_plan")) return { rows: [{ ...planRow,
        status: "solution_review_pending", current_solution_attempt_id: "10000000-0000-4000-8000-000000000099",
        photo_evidence_version: 1 }] };
      if (sql.includes("store_action_solution_review")) return { rows: [] };
      return { rows: [] };
    });
    await expect(repository.review({ actionPlanId: ids.plan, solutionAttemptId: ids.attempt,
      actorUserId: ids.actor, actorRegionIds: [ids.region], actorStoreIds: [ids.store],
      decision: "approve", expectedVersion: 1, idempotencyKey: ids.key, actor: {} }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO ops.store_action_solution_review"))).toBe(false);
  });

  it("[FR-06][EC-06] approval closes with Region Manager identity and releases solution holds", async () => {
    const { repository, query } = harness((sql) => {
      if (sql.includes("SELECT * FROM ops.store_action_plan")) return { rows: [{ ...planRow,
        status: "solution_review_pending", current_solution_attempt_id: ids.attempt,
        photo_evidence_version: 1 }] };
      if (sql.includes("SELECT * FROM ops.store_action_solution_review")) return { rows: [] };
      if (sql.includes("SELECT evidence.media_asset_id")) return { rows: [{ media_asset_id: ids.asset,
        canonical_sha256: "a".repeat(64) }] };
      if (sql.includes("AS finding_media_asset_ids")) return projection("closed", 2);
      return { rows: [] };
    });
    await expect(repository.review({ actionPlanId: ids.plan, solutionAttemptId: ids.attempt,
      actorUserId: ids.actor, actorRegionIds: [ids.region], actorStoreIds: [ids.store],
      decision: "approve", expectedVersion: 1, idempotencyKey: ids.key,
      actor: { displayName: "Region Manager" } })).resolves.toMatchObject({ status: "closed" });
    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("closed_by_user_id");
    expect(sql).toContain("active_workflow_hold = FALSE");
    expect(sql).toContain("INSERT INTO audit.photo_evidence_event");
    expect(sql).toContain("content_sha256");
  });
});
