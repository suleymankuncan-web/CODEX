import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("HealthController (integration)", () => {
  it("returns dependency-aware health when database is reachable and redis is skipped", async () => {
    const app = await createIntegrationApp({
      databaseService: {
        query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ "?column?": 1 }] }),
      },
      appConfigService: {
        appName: "store-ops-backend",
        queueBackend: "in-memory",
        redisUrl: "redis://localhost:6379",
      },
    });

    try {
      const response = await request(app.getHttpServer()).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.service).toBe("store-ops-backend");
      expect(response.headers["x-correlation-id"]).toBeDefined();
      expect(response.body.checks.database.status).toBe("ok");
      expect(response.body.checks.redis.status).toBe("skipped");
    } finally {
      await app.close();
    }
  });

  it("returns 503 when database health fails", async () => {
    const app = await createIntegrationApp({
      databaseService: {
        query: jest.fn().mockRejectedValue(new Error("database unavailable")),
      },
      appConfigService: {
        appName: "store-ops-backend",
        queueBackend: "in-memory",
        redisUrl: "redis://localhost:6379",
      },
    });

    try {
      const response = await request(app.getHttpServer())
        .get("/api/health")
        .set("x-correlation-id", "corr-health-test");

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("error");
      expect(response.headers["x-correlation-id"]).toBe("corr-health-test");
      expect(response.body.checks.database.status).toBe("error");
      expect(response.body.checks.database.message).toContain("database unavailable");
      expect(response.body.checks.redis.status).toBe("skipped");
    } finally {
      await app.close();
    }
  });

  it("does not echo invalid inbound correlation ids", async () => {
    const app = await createIntegrationApp({
      databaseService: {
        query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ "?column?": 1 }] }),
      },
      appConfigService: {
        appName: "store-ops-backend",
        queueBackend: "in-memory",
        redisUrl: "redis://localhost:6379",
      },
    });

    try {
      const response = await request(app.getHttpServer())
        .get("/api/health")
        .set("x-correlation-id", "bad id with spaces");

      expect(response.status).toBe(200);
      expect(response.headers["x-correlation-id"]).toMatch(UUID_PATTERN);
      expect(response.headers["x-correlation-id"]).not.toBe("bad id with spaces");
    } finally {
      await app.close();
    }
  });
});
