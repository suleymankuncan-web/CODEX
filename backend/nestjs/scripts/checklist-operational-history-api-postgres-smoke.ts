import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { ChecklistOperationalHistoryService } from "../src/modules/store-ops/application/checklist-operational-history.service";
import { ChecklistOperationalHistoryRepository } from "../src/modules/store-ops/infrastructure/checklist-operational-history.repository";
import { DatabaseService } from "../src/shared/database/database.service";
import { verifyChecklistAccountNames } from "./checklist-account-name-postgres-proof";

const databaseUrl = process.env.DATABASE_URL ?? "";
const parsedDatabaseUrl = new URL(databaseUrl);
if (!["localhost", "127.0.0.1"].includes(parsedDatabaseUrl.hostname)) {
  throw new Error("Operational history API PostgreSQL smoke requires a local disposable database");
}
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ""));
if (!/^store_ops_fresh_migration_smoke(_[a-z0-9_]+)?$/.test(databaseName)) {
  throw new Error("Operational history API PostgreSQL smoke refuses a non-disposable database");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const companyId = randomUUID();
const regionId = randomUUID();
const otherRegionId = randomUUID();
const storeId = randomUUID();
const otherStoreId = randomUUID();
const actorUserId = randomUUID();
const actorEmployeeId = randomUUID();
const storeRoleId = randomUUID();
const regionRoleId = randomUUID();
const templateId = randomUUID();
const checklistInstanceId = randomUUID();
const otherChecklistInstanceId = randomUUID();
const firstCompletionAt = "2026-07-01T07:00:00.000Z";
const firstAcknowledgementAt = "2026-07-02T07:00:00.000Z";
const sameTimestamp = "2026-07-03T07:00:00.000Z";
const longHistoryTaskCount = 5_000;
const sourceIds: string[] = [];
const privateCanaries = [
  "PRIVATE_ACK_NOTE_CANARY",
  "PRIVATE_AUDIT_METADATA_CANARY",
  "PRIVATE_CANCEL_CANARY",
  "PRIVATE_EMAIL_CANARY",
  "PRIVATE_RESOLUTION_CANARY",
  "PRIVATE_SOURCE_DEEP_LINK_CANARY",
  "PRIVATE_SOURCE_ID_CANARY",
  "PRIVATE_SUMMARY_CANARY",
  "PRIVATE_TASK_TITLE_CANARY",
  "PRIVATE_USERNAME_CANARY",
];

const roleScopes = {
  REGION_MANAGER: { companyIds: [], regionIds: [regionId], storeIds: [] },
};
const actorReadScope = roleScopes.REGION_MANAGER;

async function main() {
  try {
    await pool.query("BEGIN");
    await seedFixtures();

    let queryCount = 0;
    let capturedSql = "";
    let capturedValues: unknown[] = [];
    const countedDatabase = {
      query: async <Row extends Record<string, unknown>>(text: string, values?: unknown[]) => {
        queryCount += 1;
        capturedSql = text;
        capturedValues = values ?? [];
        return pool.query<Row>(text, values);
      },
    } as unknown as DatabaseService;
    const repository = new ChecklistOperationalHistoryRepository(countedDatabase);
    const service = new ChecklistOperationalHistoryService(repository);

    const start = performance.now();
    const firstPage = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope, roleScopes, storeId, range: "3m", kinds: "task_assigned",
    });
    const firstPageMs = performance.now() - start;
    assert(queryCount === 1, "history read must use one SQL roundtrip");
    assert(firstPage.items.length === 20 && firstPage.page.hasMore, "first same-timestamp page must contain 20 bounded events");
    assert(firstPage.page.nextCursor, "first page must expose a cursor");
    const cursorBytes = Buffer.from(firstPage.page.nextCursor, "base64url").toString("utf8");
    assert(sourceIds.every((sourceId) => !cursorBytes.includes(sourceId)), "cursor must not contain a raw source UUID");

    queryCount = 0;
    const secondPage = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope, roleScopes, storeId, range: "3m", kinds: "task_assigned",
      cursor: firstPage.page.nextCursor,
    });
    assert(queryCount === 1, "cursor page must use one SQL roundtrip");
    const pagedIds = [...firstPage.items, ...secondPage.items].map((item) => item.id);
    assert(pagedIds.length === 23, "same-timestamp keyset must return every assigned task");
    assert(new Set(pagedIds).size === pagedIds.length, "same-timestamp keyset must not duplicate events");
    assert(!secondPage.page.hasMore, "second same-timestamp page must terminate");

    queryCount = 0;
    const longHistoryStart = performance.now();
    const allHistory = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope, roleScopes, storeId, range: "all",
    });
    const longHistoryMs = performance.now() - longHistoryStart;
    const longHistorySql = capturedSql;
    const longHistoryValues = [...capturedValues];
    assert(queryCount === 1, "long-history read must use one SQL roundtrip");
    assert(allHistory.summary.assignedTaskCount === 23 + longHistoryTaskCount, "all-history summary must include the deterministic long-history fixture");
    const resolvedHistory = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope, roleScopes, storeId, range: "all", kinds: "task_resolved",
    });
    assert(resolvedHistory.items.length === 1, "only a closed task may emit resolution history");
    const completionHistory = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope, roleScopes, storeId, range: "all", kinds: "checklist_completed",
    });
    const acknowledgementHistory = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope, roleScopes, storeId, range: "all", kinds: "acknowledgement",
    });
    const completed = completionHistory.items[0];
    const acknowledged = acknowledgementHistory.items[0];
    assert(completed?.occurredAt === firstCompletionAt, "first immutable completion audit must win");
    assert(acknowledged?.occurredAt === firstAcknowledgementAt, "first immutable acknowledgement audit must win");
    assert(completed?.actorSnapshot.assignmentLabel === "History Store", "store assignment must outrank region assignment at event time");
    const planHistory = await service.read({
      actorRoleCodes: ["REGION_MANAGER"], actorReadScope, roleScopes, storeId, range: "all", kinds: "visit_plan_revised",
    });
    const planEvents = planHistory.items;
    assert(planEvents.some((event) => event.details.some((detail) => detail.label === "Revizyon" && detail.value === "2")), "a revision that removes the store must remain in its history");

    const serialized = JSON.stringify({ allHistory, completionHistory, acknowledgementHistory, resolvedHistory, planHistory });
    assert(sourceIds.every((sourceId) => !serialized.includes(sourceId)), "response must not serialize source UUIDs");
    assert(privateCanaries.every((canary) => !serialized.includes(canary)), "response must not serialize private fixture canaries");
    assert(!/email|username|acknowledgement_note|resolution_note|metadata_json|source_deep_link/i.test(serialized), "response must remain on the privacy allowlist");
    assert(serialized.length < 262_144, "history response must stay below 256 KiB");

    const outOfScope = await repository.read({
      companyIds: [], regionIds: [regionId], storeIds: [], storeId: otherStoreId,
      range: "all", kinds: ["checklist_completed"], cursor: null, limit: 21,
    });
    assert(outOfScope === null, "out-of-scope store must fail closed without existence disclosure");

    const explainStart = performance.now();
    const explain = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${longHistorySql}`, longHistoryValues);
    const explainMs = performance.now() - explainStart;
    const plan = explain.rows[0]?.["QUERY PLAN"]?.[0];
    const executionMs = Number(plan?.["Execution Time"] ?? Number.POSITIVE_INFINITY);
    const planEvidence = summarizePlan(plan?.Plan);
    assert(firstPageMs < 1_200 && longHistoryMs < 1_200 && explainMs < 1_200 && executionMs < 1_200, "disposable history query budget must stay below 1200 ms");

    await verifyChecklistAccountNames(pool, { companyId, storeId, otherStoreId, actorUserId, checklistInstanceId });

    console.log(JSON.stringify({
      event: "checklist_operational_history_api_postgres_smoke.completed",
      actorProjection: "bulk_store_precedence_verified",
      accountOnlyNames: "history_and_pdf_signatories_verified",
      cursorPrivacy: "verified",
      executionMs: Math.round(executionMs),
      firstPageMs: Math.round(firstPageMs),
      historyItems: pagedIds.length,
      longHistoryMs: Math.round(longHistoryMs),
      longHistoryRows: 23 + longHistoryTaskCount,
      planEvidence,
      planRemoval: "verified",
      scopeIsolation: "verified",
      sameTimestampPagination: "verified",
    }));
  } finally {
    await pool.query("ROLLBACK");
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function seedFixtures() {
  await pool.query(`INSERT INTO ops.company (company_id, company_code, company_name) VALUES ($1, $2, 'History Company')`, [companyId, `HIST_${companyId.slice(0, 8)}`]);
  await pool.query(
    `INSERT INTO ops.region (region_id, company_id, region_code, region_name) VALUES
      ($1, $3, 'HIST_R1', 'History Region'), ($2, $3, 'HIST_R2', 'Other Region')`,
    [regionId, otherRegionId, companyId],
  );
  await pool.query(
    `INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type) VALUES
      ($1, $3, $4, 'HIST_S1', 'History Store', 'company'),
      ($2, $3, $5, 'HIST_S2', 'Other Store', 'company')`,
    [storeId, otherStoreId, companyId, regionId, otherRegionId],
  );
  await pool.query(
    `INSERT INTO ops.employee (employee_id, company_id, first_name, last_name, hire_date, employment_type)
     VALUES ($1, $2, 'History', 'Actor', '2020-01-01', 'full_time')`,
    [actorEmployeeId, companyId],
  );
  await pool.query(
    `INSERT INTO ops.user_account (user_id, employee_id, username, email) VALUES ($1, $2, $3, $4)`,
    [actorUserId, actorEmployeeId, `PRIVATE_USERNAME_CANARY-${actorUserId}`, `PRIVATE_EMAIL_CANARY-${actorUserId}@example.invalid`],
  );
  await pool.query(
    `INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type) VALUES
      ($1, 'HISTORY_STORE', 'Store Role', 'store'), ($2, 'HISTORY_REGION', 'Region Role', 'region')`,
    [storeRoleId, regionRoleId],
  );
  await pool.query(
    `INSERT INTO ops.user_role_assignment (user_id, role_id, scope_type, region_id, store_id, start_at) VALUES
      ($1, $2, 'store', NULL, $4, '2020-01-01'),
      ($1, $3, 'region', $5, NULL, '2020-01-01')`,
    [actorUserId, storeRoleId, regionRoleId, storeId, regionId],
  );
  await pool.query(
    `INSERT INTO ops.checklist_template (
       checklist_template_id, company_id, template_code, template_type, template_name, category,
       version_no, status, effective_from, created_by
     ) VALUES ($1, $2, $3, 'BM_STORE_VISIT', 'History Visit', 'visit', 1, 'published', '2026-01-01', $4)`,
    [templateId, companyId, `HIST_${templateId.slice(0, 8)}`, actorUserId],
  );
  await pool.query(
    `INSERT INTO ops.checklist_instance (
       checklist_instance_id, checklist_template_id, store_id, status, completed_at, completed_by_user_id
     ) VALUES
       ($1, $3, $4, 'completed', '2026-07-01T07:05:00Z', $6),
       ($2, $3, $5, 'completed', '2026-07-01T07:05:00Z', $6)`,
    [checklistInstanceId, otherChecklistInstanceId, templateId, storeId, otherStoreId, actorUserId],
  );
  sourceIds.push(checklistInstanceId, otherChecklistInstanceId);
  await pool.query(
    `INSERT INTO audit.event_log (occurred_at, actor_user_id, event_type, entity_name, entity_id, scope_type, company_id, region_id, store_id, metadata_json) VALUES
      ($1, $3, 'checklist_instance.completed', 'ops.checklist_instance', $4, 'store', $5, $6, $7, '{"private":"PRIVATE_AUDIT_METADATA_CANARY"}'::jsonb),
      ('2026-07-01T07:01:00Z', $3, 'checklist_instance.completed', 'ops.checklist_instance', $4, 'store', $5, $6, $7, '{}'::jsonb),
      ($2, $3, 'checklist_instance.acknowledged', 'ops.checklist_instance', $4, 'store', $5, $6, $7, '{"private":"PRIVATE_AUDIT_METADATA_CANARY"}'::jsonb),
      ('2026-07-02T07:01:00Z', $3, 'checklist_instance.acknowledged', 'ops.checklist_instance', $4, 'store', $5, $6, $7, '{}'::jsonb),
      ('2026-07-01T07:00:00Z', $3, 'checklist_instance.completed', 'ops.checklist_instance', $8, 'store', $5, $9, $10, '{}'::jsonb)`,
    [firstCompletionAt, firstAcknowledgementAt, actorUserId, checklistInstanceId, companyId, regionId, storeId, otherChecklistInstanceId, otherRegionId, otherStoreId],
  );
  await pool.query(
    `INSERT INTO ops.checklist_acknowledgement (
       checklist_instance_id, store_id, acknowledged_by_user_id, acknowledgement_note, acknowledged_at
     ) VALUES ($1, $2, $3, 'PRIVATE_ACK_NOTE_CANARY', $4)`,
    [checklistInstanceId, storeId, actorUserId, firstAcknowledgementAt],
  );
  await seedTasks();
  await seedLongHistory();
  await seedPlanRemoval();
}

async function seedTasks() {
  const inserted = await pool.query<{ store_action_plan_id: string }>(
    `INSERT INTO ops.store_action_plan (
       company_id, region_id, store_id, owner_user_id, created_by_user_id, source_type, source_id,
       title, summary, priority, status, due_on, resolution_note, closed_by_user_id, closed_at,
       cancel_reason, cancelled_by_user_id, cancelled_at, created_at
     )
     SELECT $1, $2, $3, $4::uuid, $4::uuid, 'checklist_remediation',
       CASE WHEN value = 1 THEN 'PRIVATE_SOURCE_ID_CANARY' ELSE 'history-' || value::text END,
       CASE WHEN value = 1 THEN 'PRIVATE_TASK_TITLE_CANARY' ELSE 'History task ' || value::text END,
       CASE WHEN value = 1 THEN 'PRIVATE_SUMMARY_CANARY' ELSE NULL END,
       'medium',
       CASE value WHEN 1 THEN 'closed' WHEN 2 THEN 'cancelled' ELSE 'open' END,
       '2026-07-20', CASE WHEN value = 1 THEN 'PRIVATE_RESOLUTION_CANARY' ELSE NULL END,
       CASE WHEN value = 1 THEN $4::uuid ELSE NULL END, CASE WHEN value = 1 THEN $5::timestamptz + interval '1 day' ELSE NULL END,
       CASE WHEN value = 2 THEN 'PRIVATE_CANCEL_CANARY' ELSE NULL END,
       CASE WHEN value = 2 THEN $4::uuid ELSE NULL END, CASE WHEN value = 2 THEN $5::timestamptz + interval '1 day' ELSE NULL END,
       $5::timestamptz
     FROM generate_series(1, 23) AS value
     RETURNING store_action_plan_id`,
    [companyId, regionId, storeId, actorUserId, sameTimestamp],
  );
  sourceIds.push(...inserted.rows.map((row) => row.store_action_plan_id));
}

async function seedLongHistory() {
  const inserted = await pool.query<{ store_action_plan_id: string }>(
    `INSERT INTO ops.store_action_plan (
       company_id, region_id, store_id, owner_user_id, created_by_user_id, source_type, source_id,
       source_deep_link, title, priority, status, due_on, created_at
     )
     SELECT $1, $2, $3, $4, $4, 'checklist_remediation', 'long-history-' || value::text,
       CASE WHEN value = 1 THEN 'PRIVATE_SOURCE_DEEP_LINK_CANARY' ELSE NULL END,
       'Long history task ' || value::text, 'low', 'open', '2025-12-31',
       '2025-01-01T00:00:00Z'::timestamptz + value * interval '1 second'
     FROM generate_series(1, $5::integer) AS value
     RETURNING store_action_plan_id`,
    [companyId, regionId, storeId, actorUserId, longHistoryTaskCount],
  );
  sourceIds.push(...inserted.rows.map((row) => row.store_action_plan_id));
}

async function seedPlanRemoval() {
  const planId = randomUUID();
  const firstRevisionId = randomUUID();
  const secondRevisionId = randomUUID();
  await pool.query(
    `INSERT INTO ops.region_weekly_visit_plan (plan_id, region_id, week_start_date) VALUES ($1, $2, '2026-06-29')`,
    [planId, regionId],
  );
  await pool.query(
    `INSERT INTO ops.region_weekly_visit_plan_revision (
       revision_id, plan_id, region_id, week_start_date, revision_no, created_by_user_id,
       idempotency_key, request_sha256, is_current, created_at
     ) VALUES
      ($1, $3, $4, '2026-06-29', 1, $5, $6, repeat('a', 64), false, '2026-06-29T08:00:00Z'),
      ($2, $3, $4, '2026-06-29', 2, $5, $7, repeat('b', 64), true, '2026-06-30T08:00:00Z')`,
    [firstRevisionId, secondRevisionId, planId, regionId, actorUserId, randomUUID(), randomUUID()],
  );
  await pool.query(
    `INSERT INTO ops.region_weekly_visit_plan_item (
       revision_id, plan_id, region_id, week_start_date, store_id, planned_date, display_order
     ) VALUES ($1, $2, $3, '2026-06-29', $4, '2026-06-29', 0)`,
    [firstRevisionId, planId, regionId, storeId],
  );
  sourceIds.push(firstRevisionId, secondRevisionId);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function summarizePlan(root: Record<string, unknown> | undefined) {
  let nodes = 0;
  let sharedHitBlocks = 0;
  let sharedReadBlocks = 0;
  const visit = (node: Record<string, unknown> | undefined) => {
    if (!node) return;
    nodes += 1;
    sharedHitBlocks += Number(node["Shared Hit Blocks"] ?? 0);
    sharedReadBlocks += Number(node["Shared Read Blocks"] ?? 0);
    const children = Array.isArray(node.Plans) ? node.Plans as Array<Record<string, unknown>> : [];
    children.forEach(visit);
  };
  visit(root);
  return { nodes, sharedHitBlocks, sharedReadBlocks };
}
