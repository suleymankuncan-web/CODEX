import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Personnel master administration", () => {
  const actorUserId = "90000000-0000-4000-8000-000000000001";
  const companyId = "10000000-0000-4000-8000-000000000001";
  const employeeId = "70000000-0000-4000-8000-000000000001";
  const storeId = "20000000-0000-4000-8000-000000000001";
  const positionId = "30000000-0000-4000-8000-000000000001";

  const headers = (call: request.Test) =>
    call
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-company-ids", companyId);

  it("creates personnel through the protected HTTP contract", async () => {
    const createPersonnelMaster = jest.fn().mockResolvedValue({
      command: { status: "created", message: "Personnel created" },
      data: { personnel: { employeeId } },
    });
    const app = await createIntegrationApp({
      integrationService: { createPersonnelMaster },
    });

    const response = await headers(
      request(app.getHttpServer()).post("/api/integrations/personnel-master"),
    ).send({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      externalEmployeeRef: "EMP-1001",
      nationalId: "10000000146",
      phoneNumber: "+90 532 111 22 33",
      username: "ayse.yilmaz",
      email: "ayse.yilmaz@example.com",
      employmentType: "full_time",
      hireDate: "2026-08-28",
      storeId,
      positionId,
    });

    expect(response.status).toBe(201);
    expect(createPersonnelMaster).toHaveBeenCalledWith({
      actorCompanyIds: [companyId],
      actorUserId,
      firstName: "Ayşe",
      lastName: "Yılmaz",
      externalEmployeeRef: "EMP-1001",
      nationalId: "10000000146",
      phoneNumber: "+90 532 111 22 33",
      username: "ayse.yilmaz",
      email: "ayse.yilmaz@example.com",
      employmentType: "full_time",
      hireDate: "2026-08-28",
      storeId,
      positionId,
    });

    await app.close();
  });

  it("updates personnel with optimistic concurrency evidence", async () => {
    const updatePersonnelMaster = jest.fn().mockResolvedValue({
      command: { status: "updated", message: "Personnel updated" },
      data: { personnel: { employeeId } },
    });
    const app = await createIntegrationApp({
      integrationService: { updatePersonnelMaster },
    });
    const expectedUpdatedAt = "2026-08-28T09:30:00.000Z";

    const response = await headers(
      request(app.getHttpServer()).patch(
        `/api/integrations/personnel-master/${employeeId}`,
      ),
    ).send({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      externalEmployeeRef: "EMP-1001",
      phoneNumber: "+90 532 111 22 33",
      employmentStatus: "active",
      employmentType: "full_time",
      hireDate: "2026-08-28",
      storeId,
      positionId,
      assignmentStartDate: "2026-08-28",
      expectedUpdatedAt,
    });

    expect(response.status).toBe(200);
    expect(updatePersonnelMaster).toHaveBeenCalledWith(
      expect.objectContaining({
        actorCompanyIds: [companyId],
        actorUserId,
        employeeId,
        expectedUpdatedAt,
      }),
    );

    await app.close();
  });

  it("terminates personnel through the protected HTTP contract", async () => {
    const terminatePersonnelMaster = jest.fn().mockResolvedValue({
      command: { status: "updated", message: "Personnel terminated" },
      data: { personnel: { employeeId, employmentStatus: "terminated" } },
    });
    const app = await createIntegrationApp({
      integrationService: { terminatePersonnelMaster },
    });

    const response = await headers(
      request(app.getHttpServer()).patch(
        `/api/integrations/personnel-master/${employeeId}/terminate`,
      ),
    ).send({
      terminationDate: "2026-08-29",
      reason: "İşten ayrıldı",
      expectedUpdatedAt: "2026-08-28T09:30:00.000Z",
    });

    expect(response.status).toBe(200);
    expect(terminatePersonnelMaster).toHaveBeenCalledWith({
      actorCompanyIds: [companyId],
      actorUserId,
      employeeId,
      terminationDate: "2026-08-29",
      reason: "İşten ayrıldı",
      expectedUpdatedAt: "2026-08-28T09:30:00.000Z",
    });

    await app.close();
  });

  it("rejects personnel writes without an authorized role", async () => {
    const createPersonnelMaster = jest.fn();
    const app = await createIntegrationApp({
      integrationService: { createPersonnelMaster },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/personnel-master")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "REPORT_VIEWER")
      .set("x-company-ids", companyId)
      .send({
        firstName: "Ayşe",
        lastName: "Yılmaz",
        nationalId: "10000000146",
        phoneNumber: "+90 532 111 22 33",
        employmentType: "full_time",
        hireDate: "2026-08-28",
        storeId,
        positionId,
      });

    expect(response.status).toBe(403);
    expect(createPersonnelMaster).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects unknown fields before invoking the personnel service", async () => {
    const createPersonnelMaster = jest.fn();
    const app = await createIntegrationApp({
      integrationService: { createPersonnelMaster },
    });

    const response = await headers(
      request(app.getHttpServer()).post("/api/integrations/personnel-master"),
    ).send({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      nationalId: "10000000146",
      phoneNumber: "+90 532 111 22 33",
      employmentType: "full_time",
      hireDate: "2026-08-28",
      storeId,
      positionId,
      rawNationalIdCopy: "must-not-be-accepted",
    });

    expect(response.status).toBe(400);
    expect(createPersonnelMaster).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects malformed employee UUIDs before invoking the personnel service or database", async () => {
    const updatePersonnelMaster = jest.fn();
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: { query },
      integrationService: { updatePersonnelMaster },
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: actorUserId,
          roleCodes: ["HR_ADMIN"],
          scope: { companyIds: [companyId], regionIds: [], storeIds: [] },
        })),
      },
    });

    const response = await headers(
      request(app.getHttpServer()).patch(
        "/api/integrations/personnel-master/not-a-uuid",
      ),
    ).send({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      phoneNumber: "+90 532 111 22 33",
      employmentStatus: "active",
      employmentType: "full_time",
      hireDate: "2026-08-28",
      storeId,
      positionId,
    });

    expect(response.status).toBe(400);
    expect(updatePersonnelMaster).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    await app.close();
  });
});
