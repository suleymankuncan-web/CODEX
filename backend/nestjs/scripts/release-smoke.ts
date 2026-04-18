import "reflect-metadata";
import { randomUUID } from "node:crypto";

type JsonValue = Record<string, unknown>;

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000/api";
const smokeUserId = process.env.SMOKE_USER_ID ?? "80000000-0000-0000-0000-000000000001";

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json().catch(() => ({}))) as JsonValue;

  if (!response.ok) {
    throw new Error(
      `Smoke check failed for ${path}: ${response.status} ${response.statusText} ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function requestJsonWithHeaders(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json().catch(() => ({}))) as JsonValue;

  if (!response.ok) {
    throw new Error(
      `Smoke check failed for ${path}: ${response.status} ${response.statusText} ${JSON.stringify(body)}`,
    );
  }

  return {
    body,
    headers: response.headers,
  };
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const smokeCorrelationId = `smoke-${randomUUID()}`;
  const smokeDay = new Date(
    Date.now() + (2 + Math.floor(Math.random() * 365)) * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const authHeaders = {
    "x-user-id": smokeUserId,
  };

  const health = await requestJson("/health");
  assertCondition(health.status === "ok", "Health endpoint did not return ok status");

  const importOverview = await requestJson("/integrations/import-batches/overview", {
    headers: authHeaders,
  });
  assertCondition(
    typeof importOverview === "object" && importOverview !== null && "totals" in importOverview,
    "Import overview response did not include totals",
  );

  const snapshotOverview = await requestJson("/snapshots/runs/overview", {
    headers: authHeaders,
  });
  assertCondition(
    typeof snapshotOverview === "object" && snapshotOverview !== null && "totals" in snapshotOverview,
    "Snapshot overview response did not include totals",
  );

  const reportingSummary = await requestJson("/reports/summary", {
    headers: authHeaders,
  });
  assertCondition(
    typeof reportingSummary === "object" && reportingSummary !== null,
    "Reporting summary response was empty",
  );

  const importCreate = await requestJson("/integrations/import-batches", {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
      "x-correlation-id": smokeCorrelationId,
    },
    body: JSON.stringify({
      sourceCode: "HRIS",
      entityType: "employee",
      fileReference: `release-smoke-${Date.now()}.json`,
      rows: [
        {
          sourceEmployeeId: `EMP-SMOKE-${Date.now()}`,
          companyId: "00000000-0000-0000-0000-000000000001",
          firstName: "Release",
          lastName: "Smoke",
          hireDate: "2026-04-18",
          employmentStatus: "active",
          employmentType: "full_time",
        },
      ],
    }),
  });

  const batchId =
    (importCreate.data as JsonValue | undefined)?.batch &&
    typeof (importCreate.data as JsonValue).batch === "object"
      ? (((importCreate.data as JsonValue).batch as JsonValue).batchId as string | undefined)
      : undefined;
  assertCondition(batchId, "Release smoke import command did not return batchId");

  const importAudit = await requestJson(`/integrations/import-batches/${batchId}/audit`, {
    headers: authHeaders,
  });
  const importAuditItems = Array.isArray(importAudit.items) ? importAudit.items : [];
  const importAuditMatch = importAuditItems.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "correlationId" in item &&
      item.correlationId === smokeCorrelationId,
  );
  assertCondition(
    importAuditMatch,
    "Import batch audit did not contain the smoke correlationId",
  );

  const snapshotCreate = await requestJson("/snapshots/runs", {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
      "x-correlation-id": smokeCorrelationId,
    },
    body: JSON.stringify({
      snapshotType: "custom",
      periodStart: smokeDay,
      periodEnd: smokeDay,
    }),
  });

  const snapshotRunId =
    (snapshotCreate.data as JsonValue | undefined)?.snapshotRun &&
    typeof (snapshotCreate.data as JsonValue).snapshotRun === "object"
      ? ((((snapshotCreate.data as JsonValue).snapshotRun as JsonValue).snapshotRunId ??
          ((snapshotCreate.data as JsonValue).snapshotRun as JsonValue).snapshot_run_id) as
          | string
          | undefined)
      : undefined;
  assertCondition(snapshotRunId, "Release smoke snapshot command did not return snapshotRunId");

  const snapshotAudit = await requestJson(`/snapshots/runs/${snapshotRunId}/audit`, {
    headers: authHeaders,
  });
  const snapshotAuditItems = Array.isArray(snapshotAudit.items) ? snapshotAudit.items : [];
  const snapshotAuditMatch = snapshotAuditItems.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "correlationId" in item &&
      item.correlationId === smokeCorrelationId,
  );
  assertCondition(
    snapshotAuditMatch,
    "Snapshot run audit did not contain the smoke correlationId",
  );

  const healthWithHeaders = await requestJsonWithHeaders("/health", {
    headers: {
      "x-correlation-id": smokeCorrelationId,
    },
  });
  assertCondition(
    healthWithHeaders.headers.get("x-correlation-id") === smokeCorrelationId,
    "Health response did not echo the smoke correlationId header",
  );

  console.log(
    JSON.stringify(
      {
        status: "ok",
        baseUrl,
        checks: {
          health: {
            status: health.status,
            database: (health.checks as JsonValue | undefined)?.database ?? null,
            redis: (health.checks as JsonValue | undefined)?.redis ?? null,
          },
          importOverview: {
            totals: importOverview.totals ?? null,
            healthTotals: importOverview.healthTotals ?? null,
          },
          snapshotOverview: {
            totals: snapshotOverview.totals ?? null,
            healthTotals: snapshotOverview.healthTotals ?? null,
          },
          reportingSummary: reportingSummary,
          auditTrace: {
            correlationId: smokeCorrelationId,
            importBatchId: batchId,
            snapshotRunId,
            importAuditMatched: true,
            snapshotAuditMatched: true,
          },
        },
      },
      null,
      2,
    ),
  );
}

void main();
