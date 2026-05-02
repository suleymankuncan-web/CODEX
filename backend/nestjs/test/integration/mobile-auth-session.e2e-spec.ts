import * as request from "supertest";
import { buildAuthenticatedUser } from "../../src/modules/auth/auth-context.service";
import { createIntegrationApp } from "./test-app";

const user = buildAuthenticatedUser({
  userId: "11111111-1111-4111-8111-111111111111",
  employeeId: "22222222-2222-4222-8222-222222222222",
  roleCodes: ["STORE_MANAGER"],
  readScope: {
    companyIds: ["00000000-0000-0000-0000-000000000001"],
    regionIds: ["33333333-3333-4333-8333-333333333333"],
    storeIds: ["44444444-4444-4444-8444-444444444444"],
  },
  actionScope: {
    assignedStoreIds: ["44444444-4444-4444-8444-444444444444"],
  },
});

const activeSessionRow = {
  mobile_device_session_id: "55555555-5555-4555-8555-555555555555",
  user_id: user.userId,
  provider_subject: user.userId,
  device_id_hash: "hashed-device",
  platform: "android",
  device_name: "Pixel",
  app_version: "1.0.0",
  os_version: "14",
  status: "active",
  created_at: "2026-04-28T09:00:00.000Z",
  last_seen_at: "2026-04-28T09:00:00.000Z",
  expires_at: null,
  revoked_at: null,
  revoked_by_user_id: null,
  revocation_reason: null,
};

describe("Mobile auth session integration", () => {
  it("registers a mobile device session without a refresh token payload", async () => {
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const transactionQuery = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.mobile_device_session")) {
        return { rowCount: 1, rows: [activeSessionRow] };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => user),
      },
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof transactionQuery }) => Promise<T>) =>
          work({ query: transactionQuery }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/mobile/auth/sessions")
      .send({
        deviceId: "mobile-device-123",
        platform: "android",
        deviceName: "Pixel",
        appVersion: "1.0.0",
        osVersion: "14",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      mobileSession: {
        sessionId: activeSessionRow.mobile_device_session_id,
        status: "active",
        platform: "android",
      },
    });
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain("refresh");

    await app.close();
  });

  it("requires x-mobile-session-id for current mobile session reads", async () => {
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => user),
      },
      databaseService: {
        query: jest.fn(async () => ({ rowCount: 0, rows: [] })),
      },
    });

    const response = await request(app.getHttpServer()).get("/api/mobile/auth/session");

    expect(response.status).toBe(401);

    await app.close();
  });

  it("returns current auth scope only when the mobile session is active", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.mobile_device_session")) {
        return { rowCount: 1, rows: [activeSessionRow] };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => user),
      },
      databaseService: {
        query,
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/mobile/auth/session")
      .set("x-mobile-session-id", activeSessionRow.mobile_device_session_id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      authenticated: true,
      mobileSession: {
        sessionId: activeSessionRow.mobile_device_session_id,
        status: "active",
      },
      user: {
        userId: user.userId,
        roleCodes: ["STORE_MANAGER"],
        actionScope: {
          assignedStoreIds: ["44444444-4444-4444-8444-444444444444"],
        },
      },
    });

    await app.close();
  });

  it("logs out by revoking only the caller's active mobile session", async () => {
    const revokedSessionRow = {
      ...activeSessionRow,
      status: "revoked",
      revoked_at: "2026-04-28T10:00:00.000Z",
      revoked_by_user_id: user.userId,
      revocation_reason: "user_logout",
    };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.mobile_device_session")) {
        return { rowCount: 1, rows: [activeSessionRow] };
      }

      return { rowCount: 0, rows: [] };
    });
    const transactionQuery = jest.fn(async (sql: string) => {
      if (sql.includes("UPDATE ops.mobile_device_session")) {
        return { rowCount: 1, rows: [revokedSessionRow] };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => user),
      },
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof transactionQuery }) => Promise<T>) =>
          work({ query: transactionQuery }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/mobile/auth/logout")
      .set("x-mobile-session-id", activeSessionRow.mobile_device_session_id)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.mobileSession).toMatchObject({
      sessionId: activeSessionRow.mobile_device_session_id,
      status: "revoked",
      revocationReason: "user_logout",
    });

    await app.close();
  });
});
