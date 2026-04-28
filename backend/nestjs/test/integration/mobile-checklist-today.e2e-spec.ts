import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Mobile checklist today flow", () => {
  const storeId = "11111111-1111-4111-8111-111111111111";
  const otherStoreId = "99999999-9999-4999-8999-999999999999";
  const templateId = "22222222-2222-4222-8222-222222222222";

  it("lets region managers start a checklist only for assigned stores", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.checklist_instance")) {
        return {
          rows: [
            {
              checklist_instance_id: "instance-1",
              status: "in_progress",
              created_at: "2026-04-28T10:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const allowed = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId });

    expect(allowed.status).toBe(201);
    expect(allowed.body.data.checklistInstance.status).toBe("in_progress");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ct.status = 'published'"),
      [templateId, storeId, "region-user-1"],
    );

    const forbidden = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId: otherStoreId });

    expect(forbidden.status).toBe(403);

    await app.close();
  });

  it("rejects starting a checklist when the template is not available for the store", async () => {
    const query = jest.fn(async () => ({ rows: [] }));
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Checklist template is not available for this store");

    await app.close();
  });

  it("saves responses, completes with weighted score, and locks completed instances", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.checklist_instance ci") && sql.includes("cti.max_score")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              store_id: storeId,
              status: "in_progress",
              max_score: "10.00",
            },
          ],
        };
      }

      if (sql.includes("SELECT checklist_instance_id, store_id, status")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              store_id: storeId,
              status: "in_progress",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_response")) {
        return {
          rows: [
            {
              response_id: "response-1",
              responded_at: "2026-04-28T10:05:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.checklist_instance") && sql.includes("status = 'in_progress'")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              status: "in_progress",
            },
          ],
        };
      }

      if (sql.includes("SUM((COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0))")) {
        return {
          rows: [
            {
              total_score: "86.00",
              compliance_rate: "1.0000",
              missing_mandatory_count: "0",
            },
          ],
        };
      }

      if (sql.includes("locked_at = NOW()")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              status: "completed",
              total_score: "86.00",
              compliance_rate: "1.0000",
              completed_at: "2026-04-28T10:10:00.000Z",
              locked_at: "2026-04-28T10:10:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const save = await request(app.getHttpServer())
      .patch("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/responses")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({
        templateItemId: "55555555-5555-4555-8555-555555555555",
        scoreValue: 8,
        commentText: "Good",
      });

    expect(save.status).toBe(200);

    const complete = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/complete")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({});

    expect(complete.status).toBe(201);
    expect(complete.body.data.checklistInstance.total_score).toBe("86.00");
    expect(complete.body.data.checklistInstance.locked_at).toBe("2026-04-28T10:10:00.000Z");

    await app.close();
  });
});
