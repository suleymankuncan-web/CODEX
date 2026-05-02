import "reflect-metadata";

type Sample = {
  label: string;
  method: "GET" | "POST";
  path: string;
  durationMs: number;
  status: number;
};

type EndpointSummary = {
  label: string;
  method: string;
  path: string;
  samples: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  avgMs: number;
};

const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3000/api";
const iterations = Number(process.env.PERF_ITERATIONS ?? "5");
const smokeUserId = process.env.PERF_USER_ID ?? "80000000-0000-0000-0000-000000000001";
const roleCodes =
  process.env.PERF_ROLE_CODES ??
  "SUPER_ADMIN,INTEGRATION_ADMIN,SNAPSHOT_OPERATOR,REPORT_VIEWER,AUDITOR";
const companyIds = process.env.PERF_COMPANY_IDS ?? "00000000-0000-0000-0000-000000000001";
const enableMutations = process.env.PERF_ENABLE_MUTATIONS === "true";
type JsonRecord = Record<string, any>;

async function main() {
  const health = await fetchJson("/health");

  if (!health.ok) {
    throw new Error(
      `Performance baseline aborted because health is not ready: ${health.status} ${health.statusText} ${health.text}`,
    );
  }

  const authHeaders = buildHeaders();
  const samples: Sample[] = [];

  const summaryResponse = await requestJson("/reports/summary", {
    headers: authHeaders,
  });
  const summaryBody = summaryResponse.body as JsonRecord;
  const latestSnapshotRunId =
    summaryBody.latestCompletedSnapshotRun?.snapshotRunId ??
    summaryBody.latestCompletedSnapshotRun?.snapshot_run_id ??
    null;

  const readEndpoints: Array<{
    label: string;
    method: "GET";
    path: string;
  }> = [
    { label: "import overview", method: "GET", path: "/integrations/import-batches/overview" },
    { label: "snapshot overview", method: "GET", path: "/snapshots/runs/overview" },
    { label: "reports summary", method: "GET", path: "/reports/summary" },
    { label: "integration needs-action", method: "GET", path: "/integrations/import-batches/needs-action?limit=12&offset=0" },
    { label: "snapshot needs-action", method: "GET", path: "/snapshots/runs/needs-action?limit=12&offset=0" },
  ];

  if (latestSnapshotRunId) {
    readEndpoints.push(
      {
        label: "reports workforce",
        method: "GET",
        path: `/reports/workforce?snapshotRunId=${latestSnapshotRunId}&limit=50&offset=0`,
      },
      {
        label: "reports kpis",
        method: "GET",
        path: `/reports/kpis?snapshotRunId=${latestSnapshotRunId}&limit=50&offset=0`,
      },
      {
        label: "reports checklists",
        method: "GET",
        path: `/reports/checklists?snapshotRunId=${latestSnapshotRunId}&limit=50&offset=0`,
      },
      {
        label: "reports turnover",
        method: "GET",
        path: `/reports/turnover?snapshotRunId=${latestSnapshotRunId}&limit=50&offset=0`,
      },
    );
  }

  for (const endpoint of readEndpoints) {
    await runMeasuredRequest(endpoint.label, endpoint.method, endpoint.path, { headers: authHeaders }, samples);
  }

  const mutationSamples: Array<Record<string, unknown>> = [];

  if (enableMutations) {
    mutationSamples.push(
      await measureImportCommand(authHeaders),
      await measureSnapshotCommand(authHeaders),
    );
  }

  const grouped = groupSamples(samples);

  console.log(
    JSON.stringify(
      {
        status: "ok",
        baseUrl,
        iterations,
        latestSnapshotRunId,
        environment: {
          enableMutations,
          userId: smokeUserId,
        },
        readBaseline: grouped,
        mutationBaseline: mutationSamples,
      },
      null,
      2,
    ),
  );
}

async function runMeasuredRequest(
  label: string,
  method: "GET" | "POST",
  path: string,
  init: RequestInit,
  samples: Sample[],
) {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      ...init,
    });
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Performance baseline failed for ${label} ${path}: ${response.status} ${response.statusText} ${text}`,
      );
    }

    samples.push({
      label,
      method,
      path,
      durationMs,
      status: response.status,
    });
  }
}

async function measureImportCommand(headers: HeadersInit) {
  const response = await requestJson("/integrations/import-batches", {
    method: "POST",
    headers: {
      ...asRecord(headers),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sourceCode: "HRIS",
      entityType: "employee",
      fileReference: `perf-baseline-${Date.now()}.json`,
      rows: [
        {
          sourceEmployeeId: `EMP-PERF-${Date.now()}`,
          companyId: companyIds.split(",")[0],
          firstName: "Perf",
          lastName: "Baseline",
          hireDate: "2026-04-01",
          employmentStatus: "active",
          employmentType: "full_time",
        },
      ],
    }),
  });

  return {
    label: "import command",
    durationMs: response.durationMs,
    status: response.status,
    batchId:
      (response.body as JsonRecord).data?.batch?.batchId ??
      (response.body as JsonRecord).batch?.batchId ??
      null,
  };
}

async function measureSnapshotCommand(headers: HeadersInit) {
  const response = await requestJson("/snapshots/runs", {
    method: "POST",
    headers: {
      ...asRecord(headers),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      snapshotType: "custom",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
    }),
  });

  return {
    label: "snapshot command",
    durationMs: response.durationMs,
    status: response.status,
    snapshotRunId:
      (response.body as JsonRecord).data?.snapshotRun?.snapshotRunId ??
      (response.body as JsonRecord).data?.snapshotRun?.snapshot_run_id ??
      null,
  };
}

function groupSamples(samples: Sample[]): EndpointSummary[] {
  const grouped = new Map<string, Sample[]>();

  for (const sample of samples) {
    const key = `${sample.method} ${sample.path}`;
    grouped.set(key, [...(grouped.get(key) ?? []), sample]);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const sorted = group.map((item) => item.durationMs).sort((left, right) => left - right);
    const avgMs = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const [method, ...rest] = key.split(" ");
    return {
      label: group[0]?.label ?? key,
      method,
      path: rest.join(" "),
      samples: sorted.length,
      minMs: sorted[0] ?? 0,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      maxMs: sorted[sorted.length - 1] ?? 0,
      avgMs: Number(avgMs.toFixed(2)),
    };
  });
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1));
  return values[index] ?? 0;
}

function buildHeaders(): HeadersInit {
  return {
    "x-user-id": smokeUserId,
    "x-role-codes": roleCodes,
    "x-company-ids": companyIds,
  };
}

function asRecord(headers: HeadersInit): Record<string, string> {
  return headers as Record<string, string>;
}

async function fetchJson(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text,
  };
}

async function requestJson(path: string, init: RequestInit) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, init);
  const durationMs = Number((performance.now() - startedAt).toFixed(2));
  const body = (await response.json().catch(() => ({}))) as JsonRecord;

  if (!response.ok) {
    throw new Error(
      `${path} failed with ${response.status} ${response.statusText} ${JSON.stringify(body)}`,
    );
  }

  return {
    body,
    durationMs,
    status: response.status,
  };
}

void main();
