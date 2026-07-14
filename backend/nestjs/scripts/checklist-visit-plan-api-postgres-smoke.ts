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

  console.log(JSON.stringify({
    event: "checklist_visit_plan_api_postgres_smoke.completed",
    concurrentConflict: "verified",
    currentRevisionCount: afterRollback.currentRevisions,
    idempotentReplay: "verified",
    rollbackPreservedCurrent: true,
    statusDerivation: ["completed", "missed", "waiting"],
    waitingThroughCurrentDay,
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
      ($3, $4, $6, $9, 'Other Store', 'company')`,
    [
      storeOneId, storeTwoId, otherStoreId, companyId, regionId, otherRegionId,
      `VAPI1_${storeOneId.slice(0, 8)}`, `VAPI2_${storeTwoId.slice(0, 8)}`, `VAPI3_${otherStoreId.slice(0, 8)}`,
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
