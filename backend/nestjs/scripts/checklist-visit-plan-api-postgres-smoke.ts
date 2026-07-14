import "reflect-metadata";
import { ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { ChecklistVisitPlanService } from "../src/modules/store-ops/application/checklist-visit-plan.service";
import { ChecklistVisitPlanRepository } from "../src/modules/store-ops/infrastructure/checklist-visit-plan.repository";
import { DatabaseService } from "../src/shared/database/database.service";

const databaseUrl = process.env.DATABASE_URL ?? "";
const parsedDatabaseUrl = new URL(databaseUrl);
if (!["localhost", "127.0.0.1"].includes(parsedDatabaseUrl.hostname)) {
  throw new Error("Visit plan API PostgreSQL smoke requires a local disposable database");
}
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ""));
if (!/^store_ops_fresh_migration_smoke(_[a-z0-9_]+)?$/.test(databaseName)) {
  throw new Error("Visit plan API PostgreSQL smoke refuses a non-disposable database");
}

const pool = new Pool({ connectionString: databaseUrl });
const database = new DatabaseService(pool);
const repository = new ChecklistVisitPlanRepository(database);
const service = new ChecklistVisitPlanService(repository);

const companyId = randomUUID();
const regionId = randomUUID();
const otherRegionId = randomUUID();
const storeOneId = randomUUID();
const storeTwoId = randomUUID();
const otherStoreId = randomUUID();
const roundingWatchStoreId = randomUUID();
const roundingStrongStoreId = randomUUID();
const roundedResponseStoreId = randomUUID();
const actorUserId = randomUUID();
const bmTemplateId = randomUUID();
const vmTemplateId = randomUUID();
const today = istanbulDate();
const todayIsoDay = dayOfWeek(today);
const currentMonday = shiftDate(today, -((todayIsoDay + 6) % 7));
const previousMonday = shiftDate(currentMonday, -7);
const nextMonday = shiftDate(today, ((8 - todayIsoDay) % 7) || 7);
const previousTuesday = shiftDate(previousMonday, 1);
const previousWednesday = shiftDate(previousMonday, 2);

const actor = {
  actorUserId,
  actorRoleCodes: ["REGION_MANAGER"],
  actorReadScope: { companyIds: [], regionIds: [], storeIds: [] },
  roleScopes: {
    REGION_MANAGER: { companyIds: [], regionIds: [regionId], storeIds: [] },
  },
};

async function main() {
try {
  await seedFixtures();

  const items = [
    { storeId: storeOneId, plannedDate: previousMonday, displayOrder: 0 },
    { storeId: storeOneId, plannedDate: previousTuesday, displayOrder: 1 },
    { storeId: storeTwoId, plannedDate: previousWednesday, displayOrder: 2 },
  ];
  const firstKey = randomUUID();
  const secondKey = randomUUID();
  const concurrent = await Promise.allSettled([
    service.saveWeeklyPlan({ ...actor, regionId, weekStart: previousMonday, expectedRevision: 0, idempotencyKey: firstKey, items }),
    service.saveWeeklyPlan({ ...actor, regionId, weekStart: previousMonday, expectedRevision: 0, idempotencyKey: secondKey, items }),
  ]);
  assert(concurrent.filter((result) => result.status === "fulfilled").length === 1, "concurrent save must have one success");
  const rejected = concurrent.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
  assert(rejected?.reason instanceof ConflictException, "concurrent stale save must return a conflict");

  const winningKey = concurrent[0].status === "fulfilled" ? firstKey : secondKey;
  const beforeReplay = await counts(previousMonday);
  const replay = await service.saveWeeklyPlan({
    ...actor, regionId, weekStart: previousMonday, expectedRevision: 0, idempotencyKey: winningKey, items,
  });
  const afterReplay = await counts(previousMonday);
  assert(replay.revision === 1, "same-key replay must return the original revision");
  assert(beforeReplay.revisions === afterReplay.revisions, "same-key replay must not add a revision");
  assert(beforeReplay.audits === afterReplay.audits, "same-key replay must not add an audit event");

  await expectConflict(() => service.saveWeeklyPlan({
    ...actor,
    regionId,
    weekStart: previousMonday,
    expectedRevision: 1,
    idempotencyKey: winningKey,
    items: items.slice(0, 1),
  }), "same key with different content");

  await expectConflict(() => service.saveWeeklyPlan({
    ...actor,
    regionId,
    weekStart: previousMonday,
    expectedRevision: 1,
    idempotencyKey: randomUUID(),
    items: [...items, { storeId: otherStoreId, plannedDate: shiftDate(previousMonday, 3), displayOrder: 3 }],
  }), "cross-region snapshot");
  const afterRollback = await counts(previousMonday);
  assert(afterRollback.revisions === 1 && afterRollback.currentRevisions === 1, "failed snapshot must preserve one current revision");

  await seedChecklistEvidence();
  const pastPlan = await service.getWeeklyPlan({ ...actor, regionId, weekStart: previousMonday });
  const statuses = new Map(pastPlan.items.map((item) => [`${item.storeId}:${item.plannedDate}`, item.status]));
  assert(statuses.get(`${storeOneId}:${previousMonday}`) === "completed", "same-day completed BM checklist must complete the plan item");
  assert(statuses.get(`${storeOneId}:${previousTuesday}`) === "missed", "VM or next-Istanbul-day completion must not complete the plan item");
  assert(statuses.get(`${storeTwoId}:${previousWednesday}`) === "missed", "past uncompleted plan item must be missed");

  const future = await service.saveWeeklyPlan({
    ...actor,
    regionId,
    weekStart: nextMonday,
    expectedRevision: 0,
    idempotencyKey: randomUUID(),
    items: [{ storeId: storeTwoId, plannedDate: nextMonday, displayOrder: 0 }],
  });
  assert(future.items[0]?.status === "waiting", "future/local-current plan item must remain waiting");

  let waitingThroughCurrentDay: true | "not_applicable_sunday" = "not_applicable_sunday";
  if (todayIsoDay !== 0) {
    const current = await service.saveWeeklyPlan({
      ...actor,
      regionId,
      weekStart: currentMonday,
      expectedRevision: 0,
      idempotencyKey: randomUUID(),
      items: [{ storeId: storeTwoId, plannedDate: today, displayOrder: 0 }],
    });
    assert(current.items[0]?.status === "waiting", "an uncompleted item must wait through its Istanbul local plan day");
    waitingThroughCurrentDay = true;
  }

  await seedPeriodReadFixtures();
  const periodReadEvidence = await verifyPeriodReadBudgets();

  console.log(JSON.stringify({
    event: "checklist_visit_plan_api_postgres_smoke.completed",
    concurrentConflict: "verified",
    currentRevisionCount: afterRollback.currentRevisions,
    idempotentReplay: "verified",
    rollbackPreservedCurrent: true,
    statusDerivation: ["completed", "missed", "waiting"],
    waitingThroughCurrentDay,
    periodReadEvidence,
  }));
} finally {
  await pool.end();
}
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function seedFixtures() {
  await pool.query(
    `INSERT INTO ops.company (company_id, company_code, company_name) VALUES ($1, $2, 'Visit API Smoke')`,
    [companyId, `VISIT_API_${companyId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO ops.region (region_id, company_id, region_code, region_name) VALUES
      ($1, $3, 'VISIT_API_R1', 'Region One'), ($2, $3, 'VISIT_API_R2', 'Region Two')`,
    [regionId, otherRegionId, companyId],
  );
  await pool.query(
    `INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type) VALUES
      ($1, $4, $5, $7, 'Store One', 'company'),
      ($2, $4, $5, $8, 'Store Two', 'company'),
      ($3, $4, $6, $9, 'Other Store', 'company'),
      ($10, $4, $5, $11, 'Rounding Watch', 'company'),
      ($12, $4, $5, $13, 'Rounding Strong', 'company'),
      ($14, $4, $5, $15, 'Rounded Response', 'company')`,
    [
      storeOneId, storeTwoId, otherStoreId, companyId, regionId, otherRegionId,
      `VAPI1_${storeOneId.slice(0, 8)}`, `VAPI2_${storeTwoId.slice(0, 8)}`, `VAPI3_${otherStoreId.slice(0, 8)}`,
      roundingWatchStoreId, `VAPIW_${roundingWatchStoreId.slice(0, 8)}`,
      roundingStrongStoreId, `VAPIS_${roundingStrongStoreId.slice(0, 8)}`,
      roundedResponseStoreId, `VAPIR_${roundedResponseStoreId.slice(0, 8)}`,
    ],
  );
  await pool.query(
    `INSERT INTO ops.user_account (user_id, username, email) VALUES ($1, $2, $3)`,
    [actorUserId, `visit-api-${actorUserId}`, `visit-api-${actorUserId}@example.invalid`],
  );
  await pool.query(
    `INSERT INTO ops.checklist_template (
      checklist_template_id, company_id, template_code, template_type, template_name,
      category, version_no, status, effective_from, created_by
    ) VALUES
      ($1, $3, $4, 'BM_STORE_VISIT', 'BM Smoke', 'visit', 1, 'published', $6::date, $7),
      ($2, $3, $5, 'VM_STORE_VISIT', 'VM Smoke', 'visit', 1, 'published', $6::date, $7)`,
    [bmTemplateId, vmTemplateId, companyId, `VAPI_BM_${bmTemplateId.slice(0, 8)}`, `VAPI_VM_${vmTemplateId.slice(0, 8)}`, previousMonday, actorUserId],
  );
}

async function seedPeriodReadFixtures() {
  await pool.query(
    `INSERT INTO ops.store (company_id, region_id, store_code, store_name, store_type)
     SELECT $1::uuid, $2::uuid, 'VAPIB_' || value::text, 'Budget Store ' || value::text, 'company'
     FROM generate_series(1, 200) value`,
    [companyId, regionId],
  );
  const item = await pool.query<{ template_item_id: string }>(
    `INSERT INTO ops.checklist_template_item (
       checklist_template_id, section_name, item_no, item_text, response_type, max_score
     ) VALUES ($1, 'Risk boundary', 1, 'Rounded response fixture', 'score', 100)
     RETURNING template_item_id`,
    [bmTemplateId],
  );
  const instances = await pool.query<{ checklist_instance_id: string; store_id: string }>(
    `INSERT INTO ops.checklist_instance (
       checklist_template_id, store_id, status, total_score, completed_at
     ) VALUES
       ($1, $2, 'completed', 69.99, $5::date + time '09:00'),
       ($1, $2, 'completed', 70.00, $5::date + time '10:00'),
       ($1, $3, 'completed', 84.99, $5::date + time '11:00'),
       ($1, $3, 'completed', 85.00, $5::date + time '12:00'),
       ($1, $4, 'completed', 90.00, $5::date + time '13:00')
     RETURNING checklist_instance_id, store_id`,
    [bmTemplateId, roundingWatchStoreId, roundingStrongStoreId, roundedResponseStoreId, today],
  );
  await pool.query(
    `INSERT INTO ops.checklist_acknowledgement (
       checklist_instance_id, store_id, acknowledged_by_user_id
     )
     SELECT checklist_instance_id, store_id, $1
     FROM unnest($2::uuid[], $3::uuid[]) AS fixture(checklist_instance_id, store_id)`,
    [
      actorUserId,
      instances.rows.slice(0, 4).map((row) => row.checklist_instance_id),
      instances.rows.slice(0, 4).map((row) => row.store_id),
    ],
  );
  const roundedResponseInstance = instances.rows.find((row) => row.store_id === roundedResponseStoreId);
  assert(roundedResponseInstance, "rounded response fixture must exist");
  await pool.query(
    `INSERT INTO ops.checklist_response (
       checklist_instance_id, template_item_id, score_value
     ) VALUES ($1, $2, 69.50)`,
    [roundedResponseInstance.checklist_instance_id, item.rows[0].template_item_id],
  );
}

async function verifyPeriodReadBudgets() {
  let queryCount = 0;
  const countedDatabase = {
    query: async <Row extends Record<string, unknown>>(text: string, values?: unknown[]) => {
      queryCount += 1;
      return pool.query<Row>(text, values);
    },
  } as unknown as DatabaseService;
  const countedService = new ChecklistVisitPlanService(new ChecklistVisitPlanRepository(countedDatabase));
  const currentPeriod = today.slice(0, 7);

  const start30 = performance.now();
  const page30 = await countedService.listPeriod({
    ...actor, regionId, period: currentPeriod, limit: 30, offset: 0,
  });
  const page30Ms = performance.now() - start30;
  assert(queryCount === 1, "30-row period read must use one SQL roundtrip");
  assert(page30.metrics.totalStores === 205, "period metrics must cover all 205 active scoped stores");
  assert(page30.items.length === 30, "30-row period page must remain bounded");

  queryCount = 0;
  const start200 = performance.now();
  const page200Scope = await countedService.listPeriod({
    ...actor, regionId, period: currentPeriod, limit: 100, offset: 0,
  });
  const page200Ms = performance.now() - start200;
  assert(queryCount === 1, "200-store scoped period read must use one SQL roundtrip");
  assert(page200Scope.page.total === 205, "200-store scoped period read must expose the full filtered total");
  assert(page200Scope.items.length === 100, "200-store scoped period response must remain server-paged");
  assert(JSON.stringify(page200Scope).length < 262_144, "period response must stay below 256 KiB");

  const boundaryRows = await countedService.listPeriod({
    ...actor, regionId, period: currentPeriod, query: "Round", limit: 10, offset: 0,
  });
  const byStore = new Map(boundaryRows.items.map((row) => [row.storeId, row]));
  assert(byStore.get(roundingWatchStoreId)?.bmScore === 70, "69.995 monthly average must round to 70.00");
  assert(byStore.get(roundingWatchStoreId)?.risk === "medium", "rounded 70.00 score must be watch risk");
  assert(byStore.get(roundingStrongStoreId)?.bmScore === 85, "84.995 monthly average must round to 85.00");
  assert(byStore.get(roundingStrongStoreId)?.risk === "low", "rounded 85.00 score must be strong/low risk");
  assert(byStore.get(roundedResponseStoreId)?.risk === "medium", "rounded 69.5 response must not become low-score high risk");

  queryCount = 0;
  const candidateStart = performance.now();
  const candidates = await countedService.listCandidates({
    ...actor, regionId, query: "Budget Store", limit: 50, offset: 0,
  });
  const candidateMs = performance.now() - candidateStart;
  assert(queryCount === 1, "candidate search must use one SQL roundtrip");
  assert(candidates.page.total === 200 && candidates.items.length === 50, "candidate search must page 200 matches");
  assert(JSON.stringify(candidates).length < 262_144, "candidate response must stay below 256 KiB");
  assert(Math.max(page30Ms, page200Ms, candidateMs) < 1_200, "disposable read budgets must stay below 1200 ms");

  return {
    candidateMs: Math.round(candidateMs),
    candidateTotal: candidates.page.total,
    page30Ms: Math.round(page30Ms),
    page200Ms: Math.round(page200Ms),
    scopedStoreTotal: page200Scope.page.total,
  };
}

async function seedChecklistEvidence() {
  await pool.query(
    `INSERT INTO ops.checklist_instance (
      checklist_template_id, store_id, status, completed_at
    ) VALUES
      ($1, $3, 'completed', ($4::date + time '10:00') AT TIME ZONE 'Europe/Istanbul'),
      ($1, $3, 'completed', ($6::date + time '00:30') AT TIME ZONE 'Europe/Istanbul'),
      ($2, $3, 'completed', ($5::date + time '11:00') AT TIME ZONE 'Europe/Istanbul')`,
    [bmTemplateId, vmTemplateId, storeOneId, previousMonday, previousTuesday, shiftDate(previousTuesday, 1)],
  );
}

async function counts(weekStart: string) {
  const result = await pool.query<{ revisions: number; current_revisions: number; audits: number }>(
    `SELECT
      count(DISTINCT revision.revision_id)::int AS revisions,
      count(DISTINCT revision.revision_id) FILTER (WHERE revision.is_current)::int AS current_revisions,
      count(DISTINCT event.event_log_id)::int AS audits
    FROM ops.region_weekly_visit_plan plan
    LEFT JOIN ops.region_weekly_visit_plan_revision revision ON revision.plan_id = plan.plan_id
    LEFT JOIN audit.event_log event ON event.entity_id = plan.plan_id AND event.event_type = 'region_weekly_visit_plan.revised'
    WHERE plan.region_id = $1 AND plan.week_start_date = $2::date`,
    [regionId, weekStart],
  );
  return {
    revisions: Number(result.rows[0].revisions),
    currentRevisions: Number(result.rows[0].current_revisions),
    audits: Number(result.rows[0].audits),
  };
}

async function expectConflict(work: () => Promise<unknown>, label: string) {
  try {
    await work();
  } catch (error) {
    if (error instanceof ConflictException) return;
    throw error;
  }
  throw new Error(`${label} was expected to return a conflict`);
}

function istanbulDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function dayOfWeek(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getUTCDay();
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
