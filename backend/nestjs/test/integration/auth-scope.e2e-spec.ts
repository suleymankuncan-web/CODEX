import * as request from "supertest";
import { SignJWT } from "jose";
import { createIntegrationApp } from "./test-app";

describe("Auth scope integration", () => {
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
      process.env.JWT_SECRET = previousJwtSecret;
      process.env.JWT_ISSUER = previousJwtIssuer;
      process.env.JWT_AUDIENCE = previousJwtAudience;
    }
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
      process.env.JWT_SECRET = previousJwtSecret;
      process.env.JWT_ISSUER = previousJwtIssuer;
      process.env.JWT_AUDIENCE = previousJwtAudience;
    }
  });

  it("rejects checklist creation when authenticated user is out of store scope", async () => {
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["AUDITOR"],
          scope: {
            companyIds: [],
            regionIds: [],
            storeIds: [],
          },
        })),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/checklists/instances")
      .send({
        templateId: "22222222-2222-4222-8222-222222222222",
        storeId: "11111111-1111-4111-8111-111111111111",
      });

    expect(response.status).toBe(403);

    await app.close();
  });
});
