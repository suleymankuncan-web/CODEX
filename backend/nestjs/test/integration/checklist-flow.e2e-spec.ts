import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Checklist flow integration", () => {
  const storeId = "11111111-1111-4111-8111-111111111111";
  const otherStoreId = "99999999-9999-4999-8999-999999999999";
  const checklistInstanceId = "33333333-3333-4333-8333-333333333333";

  it("creates a checklist instance through the HTTP API", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.checklist_instance")) {
        return {
          rowCount: 1,
          rows: [
            {
              checklist_instance_id: "instance-1",
              status: "planned",
              created_at: "2026-04-17T00:00:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/checklists/instances")
      .set("x-user-id", "user-1")
      .set("x-store-ids", storeId)
      .send({
        templateId: "22222222-2222-4222-8222-222222222222",
        storeId,
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Checklist instance created",
    });
    expect(response.body.data.checklistInstance.checklist_instance_id).toBe("instance-1");

    await app.close();
  });

  it("adds checklist responses for an assigned checklist instance store", async () => {
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes("SELECT checklist_instance_id, store_id") &&
        sql.includes("FROM ops.checklist_instance")
      ) {
        return {
          rowCount: 1,
          rows: [{ checklist_instance_id: checklistInstanceId, store_id: storeId }],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_response")) {
        return {
          rowCount: 1,
          rows: [
            {
              response_id: "44444444-4444-4444-8444-444444444444",
              responded_at: "2026-04-17T00:05:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/checklists/instances/${checklistInstanceId}/responses`)
      .set("x-user-id", "user-1")
      .set("x-role-codes", "AUDITOR")
      .set("x-assigned-store-ids", storeId)
      .send({
        templateItemId: "55555555-5555-4555-8555-555555555555",
        responseValue: "ok",
        scoreValue: 5,
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "saved",
      message: "Checklist response saved",
    });

    await app.close();
  });

  it("rejects checklist responses outside assigned action stores", async () => {
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes("SELECT checklist_instance_id, store_id") &&
        sql.includes("FROM ops.checklist_instance")
      ) {
        return {
          rowCount: 1,
          rows: [{ checklist_instance_id: checklistInstanceId, store_id: otherStoreId }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/checklists/instances/${checklistInstanceId}/responses`)
      .set("x-user-id", "user-1")
      .set("x-role-codes", "AUDITOR")
      .set("x-assigned-store-ids", storeId)
      .send({
        templateItemId: "55555555-5555-4555-8555-555555555555",
        responseValue: "ok",
      });

    expect(response.status).toBe(403);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FROM ops.checklist_instance"),
      [checklistInstanceId],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.checklist_response"),
      expect.anything(),
    );

    await app.close();
  });

  it("completes checklist instances for an assigned checklist instance store", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT checklist_instance_id, status") && sql.includes("FOR UPDATE")) {
        return {
          rowCount: 1,
          rows: [{
            checklist_instance_id: checklistInstanceId,
            status: "in_progress",
            total_score: null,
            compliance_rate: null,
          }],
        };
      }

      if (sql.includes("missing_required_evidence_count")) {
        return { rowCount: 1, rows: [{ missing_required_evidence_count: "0" }] };
      }

      if (
        sql.includes("SELECT checklist_instance_id, store_id") &&
        sql.includes("FROM ops.checklist_instance")
      ) {
        return {
          rowCount: 1,
          rows: [{ checklist_instance_id: checklistInstanceId, store_id: storeId }],
        };
      }

      if (sql.includes("COALESCE(SUM(COALESCE(cr.score_value, 0))")) {
        return {
          rowCount: 1,
          rows: [{ total_score: "5.00", compliance_rate: "1.0000" }],
        };
      }

      if (sql.includes("UPDATE ops.checklist_instance")) {
        return {
          rowCount: 1,
          rows: [
            {
              checklist_instance_id: checklistInstanceId,
              status: "completed",
              total_score: "5.00",
              compliance_rate: "1.0000",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/checklists/instances/${checklistInstanceId}/complete`)
      .set("x-user-id", "user-1")
      .set("x-role-codes", "AUDITOR")
      .set("x-assigned-store-ids", storeId)
      .send({
        auditorEmployeeId: "66666666-6666-4666-8666-666666666666",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "completed",
      message: "Checklist instance completed",
    });

    await app.close();
  });

  it("rejects checklist completion outside assigned action stores", async () => {
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes("SELECT checklist_instance_id, store_id") &&
        sql.includes("FROM ops.checklist_instance")
      ) {
        return {
          rowCount: 1,
          rows: [{ checklist_instance_id: checklistInstanceId, store_id: otherStoreId }],
        };
      }

      if (sql.includes("COALESCE(SUM(COALESCE(cr.score_value, 0))")) {
        return {
          rowCount: 1,
          rows: [{ total_score: "5.00", compliance_rate: "1.0000" }],
        };
      }

      if (sql.includes("UPDATE ops.checklist_instance")) {
        return {
          rowCount: 1,
          rows: [
            {
              checklist_instance_id: checklistInstanceId,
              status: "completed",
              total_score: "5.00",
              compliance_rate: "1.0000",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/checklists/instances/${checklistInstanceId}/complete`)
      .set("x-user-id", "user-1")
      .set("x-role-codes", "AUDITOR")
      .set("x-assigned-store-ids", storeId)
      .send({
        auditorEmployeeId: "66666666-6666-4666-8666-666666666666",
      });

    expect(response.status).toBe(403);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FROM ops.checklist_instance"),
      [checklistInstanceId],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE ops.checklist_instance"),
      expect.anything(),
    );

    await app.close();
  });
});
