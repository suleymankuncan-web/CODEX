import * as request from "supertest";
import { SignJWT } from "jose";
import { createIntegrationApp } from "./test-app";

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

describe("Auth scope integration", () => {
  const originalAuthEnv = {
    AUTH_MODE: process.env.AUTH_MODE,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_ISSUER: process.env.JWT_ISSUER,
    JWT_AUDIENCE: process.env.JWT_AUDIENCE,
    JWT_JWKS_URL: process.env.JWT_JWKS_URL,
  };

  beforeEach(() => {
    process.env.AUTH_MODE = "mock";
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.JWT_JWKS_URL;
  });

  afterAll(() => {
    restoreEnv("AUTH_MODE", originalAuthEnv.AUTH_MODE);
    restoreEnv("JWT_SECRET", originalAuthEnv.JWT_SECRET);
    restoreEnv("JWT_ISSUER", originalAuthEnv.JWT_ISSUER);
    restoreEnv("JWT_AUDIENCE", originalAuthEnv.JWT_AUDIENCE);
    restoreEnv("JWT_JWKS_URL", originalAuthEnv.JWT_JWKS_URL);
  });

  it("blocks company-scoped access to store headcount gap without explicit store scope", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("WITH active_assignments AS")) {
        return {
          rowCount: 1,
          rows: [
            {
              store_id: "11111111-1111-4111-8111-111111111111",
              planned_headcount: "10.00",
              active_headcount: "8.00",
              headcount_gap: "2.00",
              planned_fte: "10.00",
              active_fte: "8.00",
              fte_gap: "2.00",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/workforce/headcount-gap")
      .query({
        storeId: "11111111-1111-4111-8111-111111111111",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      })
      .set("x-user-id", "user-1")
      .set("x-company-ids", "00000000-0000-0000-0000-000000000001");

    expect(response.status).toBe(403);

    await app.close();
  });

  it("allows store-scoped access to headcount gap for the assigned store", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("WITH active_assignments AS")) {
        return {
          rowCount: 1,
          rows: [
            {
              store_id: "11111111-1111-4111-8111-111111111111",
              planned_headcount: "10.00",
              active_headcount: "8.00",
              headcount_gap: "2.00",
              planned_fte: "10.00",
              active_fte: "8.00",
              fte_gap: "2.00",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/workforce/headcount-gap")
      .query({
        storeId: "11111111-1111-4111-8111-111111111111",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      })
      .set("x-user-id", "user-1")
      .set("x-store-ids", "11111111-1111-4111-8111-111111111111");

    expect(response.status).toBe(200);

    await app.close();
  });

  it("rejects import batch creation when authenticated user lacks integration role", async () => {
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches")
      .set("x-user-id", "user-1")
      .set("x-company-ids", "00000000-0000-0000-0000-000000000001")
      .set("x-role-codes", "REPORT_VIEWER")
      .send({
        sourceCode: "hris",
        entityType: "employee",
        fileReference: "employees.csv",
        rows: [],
      });

    expect(response.status).toBe(403);

    await app.close();
  });

  it("rejects snapshot run creation when authenticated user lacks snapshot role", async () => {
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/snapshots/runs")
      .set("x-user-id", "user-1")
      .set("x-company-ids", "00000000-0000-0000-0000-000000000001")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .send({
        snapshotType: "monthly",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      });

    expect(response.status).toBe(403);

    await app.close();
  });

  it("rejects migration runs when authenticated user lacks super admin role", async () => {
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .post("/api/admin/migrations/run")
      .set("x-user-id", "user-1")
      .set("x-company-ids", "00000000-0000-0000-0000-000000000001")
      .set("x-role-codes", "REPORT_VIEWER");

    expect(response.status).toBe(403);

    await app.close();
  });

  it("allows reporting reads for report viewer role", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM rpt.snapshot_run")) {
        return { rowCount: 1, rows: [{ total_count: "1" }] };
      }

      if (sql.includes("FROM rpt.snapshot_run")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "completed",
              generated_at: "2026-04-17T00:00:00.000Z",
              generated_by: "user-1",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/reports/snapshot-runs")
      .set("x-user-id", "user-1")
      .set("x-company-ids", "00000000-0000-0000-0000-000000000001")
      .set("x-role-codes", "REPORT_VIEWER");

    expect(response.status).toBe(200);

    await app.close();
  });

  it("allows reporting reads with JWT auth mode", async () => {
    const previousAuthMode = process.env.AUTH_MODE;
    const previousJwtSecret = process.env.JWT_SECRET;
    const previousJwtIssuer = process.env.JWT_ISSUER;
    const previousJwtAudience = process.env.JWT_AUDIENCE;

    process.env.AUTH_MODE = "jwt";
    process.env.JWT_SECRET = "jwt-test-secret";
    process.env.JWT_ISSUER = "store-ops-auth";
    process.env.JWT_AUDIENCE = "store-ops-api";

    try {
      const token = await new SignJWT({
        roles: ["REPORT_VIEWER"],
        company_ids: ["00000000-0000-0000-0000-000000000001"],
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuer("store-ops-auth")
        .setAudience("store-ops-api")
        .sign(new TextEncoder().encode("jwt-test-secret"));

      const query = jest.fn(async (sql: string) => {
        if (sql.includes("FROM ops.user_account")) {
          return { rowCount: 0, rows: [] };
        }

        if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM rpt.snapshot_run")) {
          return { rowCount: 1, rows: [{ total_count: "1" }] };
        }

        if (sql.includes("FROM rpt.snapshot_run")) {
          return {
            rowCount: 1,
            rows: [
              {
                snapshot_run_id: "11111111-1111-4111-8111-111111111111",
                snapshot_date: "2026-04-17",
                snapshot_type: "monthly",
                period_start: "2026-04-01",
                period_end: "2026-04-30",
                run_status: "completed",
                generated_at: "2026-04-17T00:00:00.000Z",
                generated_by: "user-1",
              },
            ],
          };
        }

        return { rowCount: 0, rows: [] };
      });
      const app = await createIntegrationApp({
        databaseService: { query },
      });

      const response = await request(app.getHttpServer())
        .get("/api/reports/snapshot-runs")
        .set("authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      await app.close();
    } finally {
      process.env.AUTH_MODE = previousAuthMode;
      restoreEnv("JWT_SECRET", previousJwtSecret);
      restoreEnv("JWT_ISSUER", previousJwtIssuer);
      restoreEnv("JWT_AUDIENCE", previousJwtAudience);
    }
  });

  it("returns authenticated mock session context", async () => {
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/session")
      .set("x-user-id", "user-1")
      .set("x-company-ids", "company-1")
      .set("x-region-ids", "region-1")
      .set("x-store-ids", "store-1")
      .set("x-role-codes", "REPORT_VIEWER,AUDITOR");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      authMode: "mock",
      authenticated: true,
      user: {
        userId: "user-1",
        roleCodes: ["REPORT_VIEWER", "AUDITOR"],
        scope: {
          companyIds: ["company-1"],
          regionIds: ["region-1"],
          storeIds: ["store-1"],
        },
        readScope: {
          companyIds: ["company-1"],
          regionIds: ["region-1"],
          storeIds: ["store-1"],
        },
        actionScope: {
          assignedStoreIds: ["store-1"],
        },
        assignedStoreIds: ["store-1"],
      },
      scopeSummary: {
        companyCount: 1,
        regionCount: 1,
        storeCount: 1,
        assignedStoreCount: 1,
      },
    });

    await app.close();
  });

  it("returns authenticated JWT session context", async () => {
    const previousAuthMode = process.env.AUTH_MODE;
    const previousJwtSecret = process.env.JWT_SECRET;
    const previousJwtIssuer = process.env.JWT_ISSUER;
    const previousJwtAudience = process.env.JWT_AUDIENCE;

    process.env.AUTH_MODE = "jwt";
    process.env.JWT_SECRET = "jwt-test-secret";
    process.env.JWT_ISSUER = "store-ops-auth";
    process.env.JWT_AUDIENCE = "store-ops-api";

    try {
      const token = await new SignJWT({
        roles: ["REPORT_VIEWER"],
        company_ids: ["company-1"],
        region_ids: ["region-1"],
        store_ids: ["store-1"],
        employee_id: "employee-1",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuer("store-ops-auth")
        .setAudience("store-ops-api")
        .sign(new TextEncoder().encode("jwt-test-secret"));

      const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
      const app = await createIntegrationApp({
        databaseService: { query },
      });

      const response = await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        authMode: "jwt",
        authenticated: true,
        user: {
          userId: "user-1",
          employeeId: "employee-1",
          roleCodes: ["REPORT_VIEWER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: ["store-1"],
          },
          readScope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: ["store-1"],
          },
          actionScope: {
            assignedStoreIds: [],
          },
          assignedStoreIds: [],
        },
        scopeSummary: {
          companyCount: 1,
          regionCount: 1,
          storeCount: 1,
          assignedStoreCount: 0,
        },
      });

      await app.close();
    } finally {
      process.env.AUTH_MODE = previousAuthMode;
      restoreEnv("JWT_SECRET", previousJwtSecret);
      restoreEnv("JWT_ISSUER", previousJwtIssuer);
      restoreEnv("JWT_AUDIENCE", previousJwtAudience);
    }
  });

  it("keeps region scope restrictions on workforce reporting even with explicit store filter", async () => {
    const queries: Array<{ sql: string; params: unknown[] | undefined }> = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM rpt.store_workforce_snapshot")) {
        return { rowCount: 1, rows: [{ total_count: "1" }] };
      }

      if (sql.includes("FROM rpt.store_workforce_snapshot")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              store_id: "11111111-1111-4111-8111-111111111111",
              position_id: "22222222-2222-4222-8222-222222222222",
              active_headcount: "8.00",
              active_fte: "8.00",
              planned_headcount: "10.00",
              planned_fte: "10.00",
              gap_headcount: "2.00",
              gap_fte: "2.00",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/reports/workforce")
      .query({
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        storeId: "11111111-1111-4111-8111-111111111111",
      })
      .set("x-user-id", "user-1")
      .set("x-role-codes", "REPORT_VIEWER")
      .set("x-region-ids", "33333333-3333-4333-8333-333333333333");

    expect(response.status).toBe(200);
    const workforceQuery = queries.find((item) => item.sql.includes("FROM rpt.store_workforce_snapshot"));
    expect(workforceQuery?.sql).toContain("s.region_id = ANY($3::uuid[])");
    expect(workforceQuery?.params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
      ["33333333-3333-4333-8333-333333333333"],
      50,
      0,
    ]);

    await app.close();
  });

  it("keeps region scope restrictions on turnover reporting even with explicit store filter", async () => {
    const queries: Array<{ sql: string; params: unknown[] | undefined }> = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM rpt.turnover_snapshot")) {
        return { rowCount: 1, rows: [{ total_count: "1" }] };
      }

      if (sql.includes("FROM rpt.turnover_snapshot")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              scope_type: "store",
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "33333333-3333-4333-8333-333333333333",
              store_id: "11111111-1111-4111-8111-111111111111",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              opening_headcount: "12.00",
              closing_headcount: "10.00",
              avg_headcount: "11.00",
              leaver_count: 2,
              turnover_rate: "0.1818",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/reports/turnover")
      .query({
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        storeId: "11111111-1111-4111-8111-111111111111",
      })
      .set("x-user-id", "user-1")
      .set("x-role-codes", "REPORT_VIEWER")
      .set("x-region-ids", "33333333-3333-4333-8333-333333333333");

    expect(response.status).toBe(200);
    const turnoverQuery = queries.find((item) => item.sql.includes("FROM rpt.turnover_snapshot"));
    expect(turnoverQuery?.sql).toContain("ts.region_id = ANY($3::uuid[])");
    expect(turnoverQuery?.params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
      ["33333333-3333-4333-8333-333333333333"],
      50,
      0,
    ]);

    await app.close();
  });

  it("rejects invalid JWT tokens with 401", async () => {
    const previousAuthMode = process.env.AUTH_MODE;
    const previousJwtSecret = process.env.JWT_SECRET;
    const previousJwtIssuer = process.env.JWT_ISSUER;
    const previousJwtAudience = process.env.JWT_AUDIENCE;

    process.env.AUTH_MODE = "jwt";
    process.env.JWT_SECRET = "jwt-test-secret";
    process.env.JWT_ISSUER = "store-ops-auth";
    process.env.JWT_AUDIENCE = "store-ops-api";

    try {
      const token = await new SignJWT({
        roles: ["REPORT_VIEWER"],
        company_ids: ["00000000-0000-0000-0000-000000000001"],
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuer("wrong-issuer")
        .setAudience("store-ops-api")
        .sign(new TextEncoder().encode("jwt-test-secret"));

      const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
      const app = await createIntegrationApp({
        databaseService: { query },
      });

      const response = await request(app.getHttpServer())
        .get("/api/reports/snapshot-runs")
        .set("authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);

      await app.close();
    } finally {
      process.env.AUTH_MODE = previousAuthMode;
      restoreEnv("JWT_SECRET", previousJwtSecret);
      restoreEnv("JWT_ISSUER", previousJwtIssuer);
      restoreEnv("JWT_AUDIENCE", previousJwtAudience);
    }
  });
});
