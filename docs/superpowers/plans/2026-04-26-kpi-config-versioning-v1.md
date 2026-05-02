# KPI Config Versioning V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immutable KPI config version history and anchor new reporting snapshots to the KPI config version used to calculate them.

**Architecture:** Keep KPI config ownership in `ops`, keep immutable reporting output in `rpt`, and keep traceability in `audit`. Publishing a KPI config draft creates an immutable version row; snapshot creation stores the active version id; snapshot execution reads the anchored version payload when materializing scores.

**Tech Stack:** PostgreSQL migrations/schema, NestJS services/repositories with Jest tests, React/Vite admin UI with Playwright checks.

---

## File Map

Create:

- `db/migrations/026_kpi_config_versioning.sql`
- `backend/nestjs/src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts`
- `admin-web/e2e/kpi-config-versioning.spec.ts`

Modify:

- `db/schema.sql`
- `backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/kpi-config.repository.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/snapshot-operations.repository.ts`
- `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- `backend/nestjs/src/modules/store-ops/application/snapshot.service.spec.ts`
- `admin-web/src/features/reports/api.ts`
- `admin-web/src/features/snapshots/api.ts`
- `admin-web/src/pages/AdminKpiConfigPage.tsx`
- `admin-web/src/pages/ReportsSnapshotRunsPage.tsx`
- `admin-web/src/pages/SnapshotRunDetailPage.tsx`
- `current-state.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-debt-ledger.md`

---

### Task 1: Add Versioning Schema

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts`
- Create: `db/migrations/026_kpi_config_versioning.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: Write the failing schema contract test**

Create `backend/nestjs/src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts`:

```typescript
import { readFileSync } from "fs";
import { join } from "path";

describe("KPI config versioning schema contract", () => {
  const root = join(__dirname, "../../../../../..");
  const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
  const migrationSql = readFileSync(
    join(root, "db/migrations/026_kpi_config_versioning.sql"),
    "utf8",
  );

  it("defines immutable KPI config versions in ops", () => {
    expect(schemaSql).toContain("CREATE TABLE ops.kpi_config_version");
    expect(schemaSql).toContain("kpi_config_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(schemaSql).toContain("version_no INTEGER NOT NULL");
    expect(schemaSql).toContain("lifecycle_state TEXT NOT NULL DEFAULT 'published'");
    expect(schemaSql).toContain("config_payload JSONB NOT NULL");
    expect(schemaSql).toContain("UNIQUE (version_no)");
  });

  it("anchors snapshot runs to KPI config versions", () => {
    expect(schemaSql).toContain(
      "kpi_config_version_id UUID REFERENCES ops.kpi_config_version(kpi_config_version_id)",
    );
  });

  it("ships an additive migration for version history and snapshot anchoring", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS ops.kpi_config_version");
    expect(migrationSql).toContain("INSERT INTO ops.kpi_config_version");
    expect(migrationSql).toContain("ALTER TABLE rpt.snapshot_run");
    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS kpi_config_version_id UUID");
  });
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts --runInBand
```

Expected: FAIL because `db/migrations/026_kpi_config_versioning.sql` and `ops.kpi_config_version` do not exist yet.

- [ ] **Step 3: Add the migration**

Create `db/migrations/026_kpi_config_versioning.sql`:

```sql
CREATE TABLE IF NOT EXISTS ops.kpi_config_version (
    kpi_config_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_no INTEGER NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'published',
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by UUID REFERENCES ops.user_account(user_id),
    change_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    config_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (version_no),
    CHECK (lifecycle_state IN ('published', 'retired')),
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

WITH published_config AS (
    SELECT
        jsonb_build_object(
            'storeProfile', MAX(config_payload) FILTER (WHERE config_key = 'store_profile'),
            'personnelProfile', MAX(config_payload) FILTER (WHERE config_key = 'personnel_profile'),
            'ownershipMatrix', MAX(config_payload) FILTER (WHERE config_key = 'ownership_matrix'),
            'gradingBands', MAX(config_payload) FILTER (WHERE config_key = 'grading_bands')
        ) AS config_payload
    FROM ops.kpi_score_profile_config
    WHERE config_key IN ('store_profile', 'personnel_profile', 'ownership_matrix', 'grading_bands')
)
INSERT INTO ops.kpi_config_version (
    version_no,
    lifecycle_state,
    effective_from,
    published_at,
    published_by,
    change_summary,
    config_payload
)
SELECT
    1,
    'published',
    NOW(),
    NOW(),
    NULL,
    '{"seededFrom":"ops.kpi_score_profile_config"}'::jsonb,
    config_payload
FROM published_config
WHERE config_payload ? 'storeProfile'
  AND config_payload ? 'personnelProfile'
  AND config_payload ? 'ownershipMatrix'
  AND config_payload ? 'gradingBands'
ON CONFLICT (version_no) DO NOTHING;

ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS kpi_config_version_id UUID
REFERENCES ops.kpi_config_version(kpi_config_version_id);

CREATE INDEX IF NOT EXISTS snapshot_run_kpi_config_version_idx
    ON rpt.snapshot_run (kpi_config_version_id);

COMMENT ON TABLE ops.kpi_config_version IS 'Immutable published KPI score configuration versions used to anchor reporting snapshots.';
COMMENT ON COLUMN rpt.snapshot_run.kpi_config_version_id IS 'KPI config version used to calculate this snapshot run. Null means pre-governance or no published version was available.';
```

- [ ] **Step 4: Update canonical schema**

In `db/schema.sql`, add the same `ops.kpi_config_version` table after `ops.kpi_score_profile_config`, then add `kpi_config_version_id` to `rpt.snapshot_run` before the `CHECK (period_end >= period_start)` line.

The `rpt.snapshot_run` table should include:

```sql
    source_batch_no TEXT,
    kpi_config_version_id UUID REFERENCES ops.kpi_config_version(kpi_config_version_id),
    CHECK (period_end >= period_start)
```

Add the index near the existing snapshot indexes:

```sql
CREATE INDEX snapshot_run_kpi_config_version_idx
    ON rpt.snapshot_run (kpi_config_version_id);
```

- [ ] **Step 5: Run the contract test and verify it passes**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add db/schema.sql db/migrations/026_kpi_config_versioning.sql backend/nestjs/src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts
git commit -m "feat: add kpi config version schema"
```

---

### Task 2: Add KPI Config Version Contracts And Repository Operations

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/kpi-config.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts`

- [ ] **Step 1: Write failing service tests for version metadata**

Create `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts` with the first two tests:

```typescript
import { ReportingService } from "./reporting.service";

const validStoreProfile = {
  profileCode: "store",
  title: "Store Score",
  summary: "Store summary",
  futureMetricRule: "Add through config",
  metrics: [
    {
      code: "TARGET_ACHIEVEMENT",
      label: "Target",
      weightPercent: 100,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "task_candidate",
    },
  ],
};

const validPersonnelProfile = {
  profileCode: "personnel",
  title: "Personnel Score",
  summary: "Personnel summary",
  futureMetricRule: "Add through config",
  metrics: [
    {
      code: "UPT",
      label: "UPT",
      weightPercent: 100,
      ownerRole: "STORE_PERSONNEL",
      scoreBehavior: "warning_first",
    },
  ],
};

const validOwnershipMatrix = [
  {
    code: "TARGET_ACHIEVEMENT",
    label: "Target",
    visibleTo: ["STORE_MANAGER"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store"],
    taskCandidate: true,
  },
  {
    code: "UPT",
    label: "UPT",
    visibleTo: ["STORE_PERSONNEL"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["personnel"],
    taskCandidate: false,
  },
];

const validGradingBands = [
  { code: "A", label: "Strong", emoji: "A", tone: "calm", minScore: 1 },
  { code: "D", label: "Critical", emoji: "D", tone: "danger", minScore: 0 },
];

function createService(repositoryOverrides: Record<string, unknown>) {
  return new ReportingService(
    {} as never,
    {
      getKpiConfigRows: jest.fn(async () => [
        { config_key: "store_profile", config_payload: validStoreProfile },
        { config_key: "personnel_profile", config_payload: validPersonnelProfile },
        { config_key: "ownership_matrix", config_payload: validOwnershipMatrix },
        { config_key: "grading_bands", config_payload: validGradingBands },
      ]),
      getDraftKpiConfigRows: jest.fn(async () => []),
      listKpiConfigAudit: jest.fn(async () => []),
      getLatestPublishedKpiConfigVersion: jest.fn(async () => null),
      publishKpiConfigDraft: jest.fn(async () => null),
      ...repositoryOverrides,
    } as never,
  );
}

describe("ReportingService KPI config versioning", () => {
  it("returns latest KPI config version metadata with the public config", async () => {
    const service = createService({
      getLatestPublishedKpiConfigVersion: jest.fn(async () => ({
        kpi_config_version_id: "11111111-1111-4111-8111-111111111111",
        version_no: 3,
        effective_from: "2026-04-26T10:00:00.000Z",
        effective_to: null,
        published_at: "2026-04-26T10:00:00.000Z",
        published_by: "22222222-2222-4222-8222-222222222222",
      })),
    });

    const result = await service.getKpiConfig();

    expect(result.metadata).toEqual({
      kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
      versionNo: 3,
      effectiveFrom: "2026-04-26T10:00:00.000Z",
      effectiveTo: null,
      publishedAt: "2026-04-26T10:00:00.000Z",
      publishedBy: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("returns the newly published KPI config version metadata after publish", async () => {
    const publishKpiConfigDraft = jest.fn(async () => ({
      kpi_config_version_id: "33333333-3333-4333-8333-333333333333",
      version_no: 4,
      effective_from: "2026-04-26T12:00:00.000Z",
      effective_to: null,
      published_at: "2026-04-26T12:00:00.000Z",
      published_by: "44444444-4444-4444-8444-444444444444",
    }));
    const service = createService({
      publishKpiConfigDraft,
      getLatestPublishedKpiConfigVersion: jest.fn(async () => ({
        kpi_config_version_id: "33333333-3333-4333-8333-333333333333",
        version_no: 4,
        effective_from: "2026-04-26T12:00:00.000Z",
        effective_to: null,
        published_at: "2026-04-26T12:00:00.000Z",
        published_by: "44444444-4444-4444-8444-444444444444",
      })),
    });

    const result = await service.publishKpiConfigDraft(
      "44444444-4444-4444-8444-444444444444",
    );

    expect(publishKpiConfigDraft).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
    );
    expect(result.latestPublishedVersion?.versionNo).toBe(4);
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts --runInBand
```

Expected: FAIL because config responses do not expose `metadata` or `latestPublishedVersion`.

- [ ] **Step 3: Add backend contract types**

Append these types to `backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts`:

```typescript
export type KpiConfigPackage = {
  storeProfile: KpiScoreProfile;
  personnelProfile: KpiScoreProfile;
  ownershipMatrix: KpiOwnershipMatrixRow[];
  gradingBands: KpiGradingBand[];
};

export type KpiConfigVersionMetadata = {
  kpiConfigVersionId: string | null;
  versionNo: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
};

export type KpiConfigResponse = KpiConfigPackage & {
  metadata: KpiConfigVersionMetadata;
};

export type KpiConfigEditorResponse = {
  draftConfig: KpiConfigPackage;
  publishedConfig: KpiConfigPackage;
  hasUnpublishedChanges: boolean;
  latestPublishedVersion: KpiConfigVersionMetadata;
};
```

- [ ] **Step 4: Add repository version methods**

In `backend/nestjs/src/modules/store-ops/infrastructure/kpi-config.repository.ts`, add a `Queryable` type near the imports:

```typescript
type Queryable = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: T[] }>;
};
```

Add these methods to `KpiConfigRepository`:

```typescript
async getLatestPublishedKpiConfigVersion(client?: Queryable) {
  const runner = client ?? this.databaseService;
  const result = await runner.query<{
    kpi_config_version_id: string;
    version_no: number;
    effective_from: string;
    effective_to: string | null;
    published_at: string;
    published_by: string | null;
    config_payload: {
      storeProfile?: unknown;
      personnelProfile?: unknown;
      ownershipMatrix?: unknown;
      gradingBands?: unknown;
    };
  }>(
    `
      SELECT
        kpi_config_version_id,
        version_no,
        effective_from,
        effective_to,
        published_at,
        published_by,
        config_payload
      FROM ops.kpi_config_version
      WHERE lifecycle_state = 'published'
        AND effective_from <= NOW()
        AND (effective_to IS NULL OR effective_to > NOW())
      ORDER BY version_no DESC
      LIMIT 1
    `,
  );

  return result.rows[0] ?? null;
}

async getKpiConfigVersionById(kpiConfigVersionId: string, client?: Queryable) {
  const runner = client ?? this.databaseService;
  const result = await runner.query<{
    kpi_config_version_id: string;
    version_no: number;
    effective_from: string;
    effective_to: string | null;
    published_at: string;
    published_by: string | null;
    config_payload: {
      storeProfile?: unknown;
      personnelProfile?: unknown;
      ownershipMatrix?: unknown;
      gradingBands?: unknown;
    };
  }>(
    `
      SELECT
        kpi_config_version_id,
        version_no,
        effective_from,
        effective_to,
        published_at,
        published_by,
        config_payload
      FROM ops.kpi_config_version
      WHERE kpi_config_version_id = $1::uuid
      LIMIT 1
    `,
    [kpiConfigVersionId],
  );

  return result.rows[0] ?? null;
}
```

Update `publishKpiConfigDraft(actorUserId)` so it returns the inserted version row and includes `kpiConfigVersionId` / `versionNo` in audit metadata:

```typescript
const versionResult = await client.query<{
  kpi_config_version_id: string;
  version_no: number;
  effective_from: string;
  effective_to: string | null;
  published_at: string;
  published_by: string | null;
}>(
  `
    INSERT INTO ops.kpi_config_version (
      version_no,
      lifecycle_state,
      effective_from,
      published_at,
      published_by,
      change_summary,
      config_payload
    )
    VALUES (
      COALESCE((SELECT MAX(version_no) + 1 FROM ops.kpi_config_version), 1),
      'published',
      NOW(),
      NOW(),
      $1::uuid,
      $2::jsonb,
      $3::jsonb
    )
    RETURNING
      kpi_config_version_id,
      version_no,
      effective_from,
      effective_to,
      published_at,
      published_by
  `,
  [
    actorUserId,
    JSON.stringify(diffSummary),
    JSON.stringify({
      storeProfile: draftConfig.storeProfile,
      personnelProfile: draftConfig.personnelProfile,
      ownershipMatrix: draftConfig.ownershipMatrix,
      gradingBands: draftConfig.gradingBands,
    }),
  ],
);
```

Use a local `diffSummary` constant before the insert so the same object is reused for version and audit metadata.

- [ ] **Step 5: Run the service tests again**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts --runInBand
```

Expected: still FAIL until `ReportingService` maps metadata in Task 3.

---

### Task 3: Return KPI Config Version Metadata From ReportingService

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts`

- [ ] **Step 1: Add metadata mapper**

In `ReportingService`, add:

```typescript
private mapKpiConfigVersionMetadata(version: {
  kpi_config_version_id: string;
  version_no: number;
  effective_from: string;
  effective_to: string | null;
  published_at: string;
  published_by: string | null;
} | null) {
  return {
    kpiConfigVersionId: version?.kpi_config_version_id ?? null,
    versionNo: version?.version_no ?? null,
    effectiveFrom: version?.effective_from ?? null,
    effectiveTo: version?.effective_to ?? null,
    publishedAt: version?.published_at ?? null,
    publishedBy: version?.published_by ?? null,
  };
}
```

- [ ] **Step 2: Update `getKpiConfig()`**

Change `getKpiConfig()` so it returns config plus metadata:

```typescript
async getKpiConfig() {
  try {
    const [rows, latestVersion] = await Promise.all([
      this.kpiConfigRepository.getKpiConfigRows(),
      this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(),
    ]);
    return {
      ...this.resolveKpiConfigFromRows(rows),
      metadata: this.mapKpiConfigVersionMetadata(latestVersion),
    };
  } catch {
    return {
      ...this.getDefaultKpiConfig(),
      metadata: this.mapKpiConfigVersionMetadata(null),
    };
  }
}
```

Because existing score code expects the package shape, update internal call sites that do `const config = await this.getKpiConfig()` to continue using `config.storeProfile` / `config.personnelProfile`; the new `metadata` property is additive.

- [ ] **Step 3: Update editor and publish responses**

Change `getKpiConfigEditor()`:

```typescript
async getKpiConfigEditor() {
  const [publishedRows, draftRows, latestVersion] = await Promise.all([
    this.kpiConfigRepository.getKpiConfigRows(),
    this.kpiConfigRepository.getDraftKpiConfigRows(),
    this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(),
  ]);
  const publishedConfig = this.resolveKpiConfigFromRows(publishedRows);
  const draftConfig =
    draftRows.length > 0 ? this.resolveKpiConfigFromRows(draftRows) : publishedConfig;

  return {
    draftConfig,
    publishedConfig,
    hasUnpublishedChanges:
      JSON.stringify(draftConfig) !== JSON.stringify(publishedConfig),
    latestPublishedVersion: this.mapKpiConfigVersionMetadata(latestVersion),
  };
}
```

Keep `publishKpiConfigDraft(actorUserId)` returning `this.getKpiConfigEditor()` after repository publish; the editor response will then expose the latest version metadata.

- [ ] **Step 4: Run targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Tasks 2 and 3**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts backend/nestjs/src/modules/store-ops/infrastructure/kpi-config.repository.ts backend/nestjs/src/modules/store-ops/application/reporting.service.ts backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts
git commit -m "feat: version kpi config publishes"
```

---

### Task 4: Anchor Snapshot Runs To KPI Config Versions

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/snapshot-operations.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.spec.ts`

- [ ] **Step 1: Add failing snapshot service tests**

Add these tests to `backend/nestjs/src/modules/store-ops/application/snapshot.service.spec.ts`:

```typescript
it("anchors new snapshot runs to the latest KPI config version", async () => {
  const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
  const databaseService = {
    query,
    withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
      work({ query }),
  };
  const dispatch = jest.fn(async () => ({
    status: "queued" as const,
    jobType: "snapshot-run" as const,
    backend: "bullmq",
  }));
  const snapshotOperationsRepository = {
    createSnapshotRun: jest.fn(async () => ({
      snapshot_run_id: "snapshot-versioned",
      snapshot_date: "2026-04-26",
      generated_at: "2026-04-26T00:00:00.000Z",
      run_status: "queued",
      started_at: null,
      finished_at: null,
      failure_reason: null,
      rerun_of_snapshot_run_id: null,
      kpi_config_version_id: "11111111-1111-4111-8111-111111111111",
      kpi_config_version_no: 7,
    })),
    recordSnapshotAuditEvent: jest.fn(async () => undefined),
  };
  const kpiConfigRepository = {
    getLatestPublishedKpiConfigVersion: jest.fn(async () => ({
      kpi_config_version_id: "11111111-1111-4111-8111-111111111111",
      version_no: 7,
    })),
  };

  const service = new SnapshotService(
    databaseService as never,
    { dispatch } as never,
    snapshotOperationsRepository as never,
    kpiConfigRepository as never,
  );

  await service.enqueueSnapshotRun({
    snapshotType: "daily",
    periodStart: "2026-04-26",
    periodEnd: "2026-04-26",
    actorUserId: "user-1",
  });

  expect(snapshotOperationsRepository.createSnapshotRun).toHaveBeenCalledWith(
    expect.objectContaining({
      kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
    }),
    expect.anything(),
  );
  expect(snapshotOperationsRepository.recordSnapshotAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      metadata: expect.objectContaining({
        kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
        versionNo: 7,
      }),
    }),
    expect.anything(),
  );
});

it("reruns failed snapshots with the parent KPI config version", async () => {
  const query = jest.fn(async () => ({ rowCount: 1, rows: [] }));
  const databaseService = {
    query,
    withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
      work({ query }),
  };
  const dispatch = jest.fn(async () => ({
    status: "queued" as const,
    jobType: "snapshot-run" as const,
    backend: "bullmq",
  }));
  const snapshotOperationsRepository = {
    findSnapshotRunById: jest.fn(async () => ({
      snapshot_run_id: "snapshot-parent",
      snapshot_date: "2026-04-26",
      snapshot_type: "daily",
      period_start: "2026-04-26",
      period_end: "2026-04-26",
      run_status: "failed",
      generated_at: "2026-04-26T00:00:00.000Z",
      generated_by: "user-1",
      started_at: "2026-04-26T00:00:00.000Z",
      finished_at: "2026-04-26T00:01:00.000Z",
      failure_reason: "timeout",
      rerun_of_snapshot_run_id: null,
      kpi_config_version_id: "22222222-2222-4222-8222-222222222222",
      kpi_config_version_no: 8,
    })),
    countActiveReruns: jest.fn(async () => 0),
    createSnapshotRun: jest.fn(async () => ({
      snapshot_run_id: "snapshot-rerun",
      snapshot_date: "2026-04-26",
      generated_at: "2026-04-26T00:02:00.000Z",
      run_status: "queued",
      started_at: null,
      finished_at: null,
      failure_reason: null,
      rerun_of_snapshot_run_id: "snapshot-parent",
      kpi_config_version_id: "22222222-2222-4222-8222-222222222222",
      kpi_config_version_no: 8,
    })),
    recordSnapshotAuditEvent: jest.fn(async () => undefined),
  };

  const service = new SnapshotService(
    databaseService as never,
    { dispatch } as never,
    snapshotOperationsRepository as never,
    { getLatestPublishedKpiConfigVersion: jest.fn() } as never,
  );

  await service.rerunSnapshotRun("snapshot-parent", "user-2");

  expect(snapshotOperationsRepository.createSnapshotRun).toHaveBeenCalledWith(
    expect.objectContaining({
      kpiConfigVersionId: "22222222-2222-4222-8222-222222222222",
    }),
    expect.anything(),
  );
});
```

- [ ] **Step 2: Run snapshot tests and verify they fail**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/snapshot.service.spec.ts --runInBand
```

Expected: FAIL because snapshot creation does not pass `kpiConfigVersionId`.

- [ ] **Step 3: Update snapshot repository selects and inserts**

In `SnapshotOperationsRepository`, add `kpi_config_version_id` and `kpi_config_version_no` to all snapshot row result types and SELECT lists.

Use this select shape wherever snapshot runs are selected:

```sql
SELECT
  rpt.snapshot_run.snapshot_run_id,
  rpt.snapshot_run.snapshot_date,
  rpt.snapshot_run.snapshot_type,
  rpt.snapshot_run.period_start,
  rpt.snapshot_run.period_end,
  rpt.snapshot_run.run_status,
  rpt.snapshot_run.generated_at,
  rpt.snapshot_run.generated_by,
  rpt.snapshot_run.started_at,
  rpt.snapshot_run.finished_at,
  rpt.snapshot_run.failure_reason,
  rpt.snapshot_run.rerun_of_snapshot_run_id,
  rpt.snapshot_run.kpi_config_version_id,
  version.version_no AS kpi_config_version_no
FROM rpt.snapshot_run
LEFT JOIN ops.kpi_config_version version
  ON version.kpi_config_version_id = rpt.snapshot_run.kpi_config_version_id
```

Update `createSnapshotRun` input:

```typescript
input: {
  snapshotType: string;
  periodStart: string;
  periodEnd: string;
  actorUserId: string;
  idempotencyKey: string | null;
  rerunOfSnapshotRunId?: string | null;
  kpiConfigVersionId?: string | null;
}
```

Update the insert:

```sql
INSERT INTO rpt.snapshot_run (
  snapshot_date,
  snapshot_type,
  period_start,
  period_end,
  run_status,
  idempotency_key,
  generated_by,
  rerun_of_snapshot_run_id,
  kpi_config_version_id
)
VALUES (CURRENT_DATE, $1, $2::date, $3::date, 'queued', $4, $5, $6::uuid, $7::uuid)
RETURNING
  snapshot_run_id,
  snapshot_date,
  generated_at,
  run_status,
  started_at,
  finished_at,
  failure_reason,
  rerun_of_snapshot_run_id,
  kpi_config_version_id,
  (
    SELECT version_no
    FROM ops.kpi_config_version
    WHERE kpi_config_version_id = $7::uuid
  ) AS kpi_config_version_no
```

- [ ] **Step 4: Resolve version at snapshot creation**

In `SnapshotService.enqueueSnapshotRun`, before `createSnapshotRun`, resolve:

```typescript
const latestKpiConfigVersion =
  await this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(client);
```

Pass:

```typescript
kpiConfigVersionId: latestKpiConfigVersion?.kpi_config_version_id ?? null
```

Add audit metadata:

```typescript
kpiConfigVersionId: latestKpiConfigVersion?.kpi_config_version_id ?? null,
versionNo: latestKpiConfigVersion?.version_no ?? null,
```

- [ ] **Step 5: Reuse parent version on rerun**

In `rerunSnapshotRun`, pass:

```typescript
kpiConfigVersionId: existing.kpi_config_version_id ?? null
```

If `existing.kpi_config_version_id` is null, resolve latest active version inside the transaction and pass that id if available.

- [ ] **Step 6: Use anchored config during daily snapshot execution**

Replace `getPublishedPersonnelProfile()` with a method that accepts the snapshot run row:

```typescript
private async getPersonnelProfileForSnapshotRun(snapshotRun: {
  kpi_config_version_id: string | null;
}) {
  try {
    if (snapshotRun.kpi_config_version_id) {
      const version = await this.kpiConfigRepository.getKpiConfigVersionById(
        snapshotRun.kpi_config_version_id,
      );
      const profile = version?.config_payload?.personnelProfile;
      if (profile) {
        return profile as KpiScoreProfile;
      }
    }

    const rows = await this.kpiConfigRepository.getKpiConfigRows();
    const profileRow = rows.find((row) => row.config_key === "personnel_profile");
    if (profileRow) {
      return profileRow.config_payload as KpiScoreProfile;
    }
  } catch {
    return personnelKpiScoreProfile;
  }

  return personnelKpiScoreProfile;
}
```

In `executeSnapshotRun`, use:

```typescript
const personnelProfile =
  snapshotRun?.snapshot_type === "daily"
    ? await this.getPersonnelProfileForSnapshotRun(snapshotRun)
    : null;
```

- [ ] **Step 7: Map version metadata in snapshot API**

Update `mapSnapshotRun` to return:

```typescript
kpiConfigVersion: {
  kpiConfigVersionId: item.kpi_config_version_id ?? null,
  versionNo: item.kpi_config_version_no ?? null,
  state: item.kpi_config_version_id ? "versioned" : "pre_governance",
},
```

- [ ] **Step 8: Run targeted backend tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/snapshot.service.spec.ts src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/infrastructure/snapshot-operations.repository.ts backend/nestjs/src/modules/store-ops/application/snapshot.service.ts backend/nestjs/src/modules/store-ops/application/snapshot.service.spec.ts
git commit -m "feat: anchor snapshots to kpi config versions"
```

---

### Task 5: Surface Version Metadata In Admin UI

**Files:**

- Modify: `admin-web/src/features/reports/api.ts`
- Modify: `admin-web/src/features/snapshots/api.ts`
- Modify: `admin-web/src/pages/AdminKpiConfigPage.tsx`
- Modify: `admin-web/src/pages/ReportsSnapshotRunsPage.tsx`
- Modify: `admin-web/src/pages/SnapshotRunDetailPage.tsx`
- Create: `admin-web/e2e/kpi-config-versioning.spec.ts`

- [ ] **Step 1: Write failing Playwright tests**

Create `admin-web/e2e/kpi-config-versioning.spec.ts`:

```typescript
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-versioning-user',
        mockRoleCodes: 'SUPER_ADMIN,REPORT_VIEWER,AUDITOR,SNAPSHOT_OPERATOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeVersioningApi(page)
})

test('admin KPI config page shows latest version metadata', async ({ page }) => {
  await page.goto('/admin/kpi-config')

  await expect(page.getByText('Versioned schema')).toBeVisible()
  await expect(page.getByText('Active')).toBeVisible()
  await expect(page.getByText('Latest version')).toBeVisible()
  await expect(page.getByText('v7')).toBeVisible()
  await expect(page.getByText('Rollback not active in V1')).toBeVisible()
})

test('snapshot runs page shows KPI config version for reporting context', async ({ page }) => {
  await page.goto('/admin/reports/snapshots')

  await expect(page.getByText('KPI config version')).toBeVisible()
  await expect(page.getByText('v7')).toBeVisible()
  await expect(page.getByText('Pre-governance snapshot')).toBeVisible()
})

async function routeVersioningApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })
  await page.route('**/api/reports/kpi-config/editor', async (route) => {
    await route.fulfill({ json: kpiConfigEditorFixture })
  })
  await page.route('**/api/reports/kpi-config/audit', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 20, offset: 0 } } })
  })
  await page.route('**/api/reports/snapshot-runs?**', async (route) => {
    await route.fulfill({ json: snapshotRunsFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-versioning-user',
    roleCodes: ['SUPER_ADMIN', 'REPORT_VIEWER', 'AUDITOR', 'SNAPSHOT_OPERATOR'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const config = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Store summary',
    futureMetricRule: 'Add through config',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target',
        weightPercent: 100,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'task_candidate',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Personnel summary',
    futureMetricRule: 'Add through config',
    metrics: [
      {
        code: 'UPT',
        label: 'UPT',
        weightPercent: 100,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  ownershipMatrix: [],
  gradingBands: [
    { code: 'A', label: 'Strong', emoji: 'A', tone: 'calm', minScore: 1 },
    { code: 'D', label: 'Critical', emoji: 'D', tone: 'danger', minScore: 0 },
  ],
}

const latestPublishedVersion = {
  kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
  versionNo: 7,
  effectiveFrom: '2026-04-26T10:00:00.000Z',
  effectiveTo: null,
  publishedAt: '2026-04-26T10:00:00.000Z',
  publishedBy: 'super-admin-versioning-user',
}

const kpiConfigEditorFixture = {
  draftConfig: config,
  publishedConfig: config,
  hasUnpublishedChanges: false,
  latestPublishedVersion,
}

const snapshotRunsFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-versioned',
      snapshotDate: '2026-04-26',
      snapshotType: 'daily',
      periodStart: '2026-04-26',
      periodEnd: '2026-04-26',
      runStatus: 'completed',
      generatedAt: '2026-04-26T23:59:00.000Z',
      generatedBy: 'system',
      kpiConfigVersion: {
        kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
        versionNo: 7,
        state: 'versioned',
      },
    },
    {
      snapshotRunId: 'snapshot-legacy',
      snapshotDate: '2026-04-25',
      snapshotType: 'daily',
      periodStart: '2026-04-25',
      periodEnd: '2026-04-25',
      runStatus: 'completed',
      generatedAt: '2026-04-25T23:59:00.000Z',
      generatedBy: 'system',
      kpiConfigVersion: {
        kpiConfigVersionId: null,
        versionNo: null,
        state: 'pre_governance',
      },
    },
  ],
  meta: { count: 2, total: 2, limit: 8, offset: 0 },
}
```

- [ ] **Step 2: Run Playwright test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/kpi-config-versioning.spec.ts
```

Expected: FAIL because UI does not display active version metadata yet.

- [ ] **Step 3: Update frontend API types**

In `admin-web/src/features/reports/api.ts`, add:

```typescript
export type KpiConfigVersionMetadata = {
  kpiConfigVersionId: string | null
  versionNo: number | null
  effectiveFrom: string | null
  effectiveTo: string | null
  publishedAt: string | null
  publishedBy: string | null
}
```

Update `KpiConfig`:

```typescript
export type KpiConfig = {
  storeProfile: KpiScoreProfile
  personnelProfile: KpiScoreProfile
  ownershipMatrix: KpiOwnershipMatrixRow[]
  gradingBands: KpiGradingBand[]
  metadata?: KpiConfigVersionMetadata
}
```

Update `KpiConfigEditorState`:

```typescript
export type KpiConfigEditorState = {
  draftConfig: KpiConfig
  publishedConfig: KpiConfig
  hasUnpublishedChanges: boolean
  latestPublishedVersion: KpiConfigVersionMetadata
}
```

Update `ReportingSnapshotRun`:

```typescript
export type ReportingSnapshotRun = {
  snapshotRunId: string
  snapshotDate: string
  snapshotType: string
  periodStart: string
  periodEnd: string
  runStatus: string
  generatedAt: string
  generatedBy: string
  kpiConfigVersion?: {
    kpiConfigVersionId: string | null
    versionNo: number | null
    state: 'versioned' | 'pre_governance'
  }
}
```

Apply the same snapshot run type addition in `admin-web/src/features/snapshots/api.ts` for detail responses.

- [ ] **Step 4: Update admin KPI config page**

In `AdminKpiConfigPage`, add version metadata cards inside the governance preview panel:

```tsx
<KeyValue
  label="Versioned schema"
  value={configQuery.data?.latestPublishedVersion?.versionNo ? 'Active' : 'Pre-governance'}
/>
<KeyValue
  label="Latest version"
  value={
    configQuery.data?.latestPublishedVersion?.versionNo
      ? `v${configQuery.data.latestPublishedVersion.versionNo}`
      : 'No version yet'
  }
/>
<KeyValue
  label="Published at"
  value={
    configQuery.data?.latestPublishedVersion?.publishedAt
      ? formatDateTime(configQuery.data.latestPublishedVersion.publishedAt)
      : 'Not published'
  }
/>
<KeyValue label="Rollback" value="Rollback not active in V1" />
```

- [ ] **Step 5: Update snapshot runs page**

In `ReportsSnapshotRunsPage`, add one `KeyValue` to each run row:

```tsx
<KeyValue
  label="KPI config version"
  value={
    run.kpiConfigVersion?.state === 'versioned' && run.kpiConfigVersion.versionNo
      ? `v${run.kpiConfigVersion.versionNo}`
      : 'Pre-governance snapshot'
  }
/>
```

- [ ] **Step 6: Update snapshot detail page**

In `SnapshotRunDetailPage`, add a row to the execution summary:

```tsx
[
  'KPI config version',
  detail.snapshotRun.kpiConfigVersion?.state === 'versioned' &&
  detail.snapshotRun.kpiConfigVersion.versionNo
    ? `v${detail.snapshotRun.kpiConfigVersion.versionNo}`
    : 'Pre-governance snapshot',
]
```

- [ ] **Step 7: Run frontend targeted checks**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/kpi-config-versioning.spec.ts e2e/admin-kpi-config.spec.ts
```

Expected: build PASS; Playwright tests PASS.

- [ ] **Step 8: Commit Task 5**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add admin-web/src/features/reports/api.ts admin-web/src/features/snapshots/api.ts admin-web/src/pages/AdminKpiConfigPage.tsx admin-web/src/pages/ReportsSnapshotRunsPage.tsx admin-web/src/pages/SnapshotRunDetailPage.tsx admin-web/e2e/kpi-config-versioning.spec.ts
git commit -m "feat: show kpi config version metadata"
```

---

### Task 6: Documentation And Release Verification

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Update project docs**

Add a completion note that says:

```text
KPI Config Versioning V1 is implemented.

- `ops.kpi_config_version` stores immutable published KPI config versions.
- New `rpt.snapshot_run` rows are anchored to `kpi_config_version_id`.
- Daily snapshot execution reads the anchored config version when available.
- Snapshot reruns reuse parent config version when present.
- Admin KPI config and snapshot report surfaces show version/pre-governance metadata.
- Rollback UI, future effective scheduling, approval workflow, and DB-managed interpretation copy remain out of V1.
```

Update debt counts:

- Strategic investment backlog decreases by one if this feature is fully implemented and release verified.
- Silent untracked quality debt remains `0` only if root release passes.

- [ ] **Step 2: Run full release check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected: PASS for root script tests, backend lint/test/build/audit, frontend lint/script/build/Playwright/audit.

- [ ] **Step 3: Commit docs**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add current-state.md docs/plans/active-next-actions.md docs/plans/project-debt-ledger.md
git commit -m "docs: record kpi config versioning v1"
```

---

## Self-Review Checklist

- [ ] Schema task creates additive migration only.
- [ ] No new `dm` or global `config` schema is introduced.
- [ ] Publish creates immutable version history.
- [ ] Config API metadata is additive and does not break existing store/admin readers.
- [ ] Snapshot creation anchors active version.
- [ ] Snapshot execution uses anchored version when present.
- [ ] Snapshot rerun reuses parent version when present.
- [ ] Legacy snapshots remain readable as pre-governance.
- [ ] UI displays version metadata without claiming rollback/future scheduling is active.
- [ ] Full root release check is the final gate.

## Execution Options

After review, execute with one of these:

1. **Subagent-Driven (recommended):** one fresh worker per task, review after each task.
2. **Inline Execution:** implement in this session with checkpoints after schema, backend, snapshot, frontend, and docs.
