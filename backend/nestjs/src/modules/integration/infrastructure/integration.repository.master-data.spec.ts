import { ConflictException } from "@nestjs/common";
import { IntegrationRepository } from "./integration.repository";

describe("IntegrationRepository master data writes", () => {
  function createRepository(query: jest.Mock) {
    const withTransaction = jest.fn(async (callback) => callback({ query }));
    const repository = new IntegrationRepository(
      { withTransaction } as never,
      {} as never,
    );

    return { repository, withTransaction };
  }

  it("rejects stale store master saves before updating or writing audit", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ user_id: "actor-1" }] })
      .mockResolvedValueOnce({
        rows: [{ store_id: "store-1", is_current: false }],
      });
    const { repository } = createRepository(query);

    await expect(
      repository.updateKpiImportStoreScope({
        actorCompanyIds: ["company-1"],
        storeId: "store-1",
        storeType: "company",
        regionId: "region-1",
        status: "active",
        kpiImportEnabled: true,
        actorUserId: "actor-1",
        expectedUpdatedAt: "2026-06-30T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).not.toContain("UPDATE ops.store");
    expect(sql).not.toContain("store_master_data.updated");
  });

  it("writes store master audit when a direct save persists", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ user_id: "actor-1" }] })
      .mockResolvedValueOnce({
        rows: [{ store_id: "store-1", is_current: true }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            store_id: "store-1",
            store_code: "SM140",
            store_name: "Marmara Park",
            store_type: "company",
            status: "active",
            kpi_import_enabled: true,
            region_id: "region-1",
            region_name: "Marmara",
            updated_at: "2026-06-30T10:01:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    const { repository } = createRepository(query);

    await expect(
      repository.updateKpiImportStoreScope({
        actorCompanyIds: ["company-1"],
        storeId: "store-1",
        storeType: "company",
        regionId: "region-1",
        status: "active",
        kpiImportEnabled: true,
        actorUserId: "actor-1",
        expectedUpdatedAt: "2026-06-30T10:00:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        store_id: "store-1",
        updated_at: "2026-06-30T10:01:00.000Z",
      }),
    );

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("UPDATE ops.store");
    expect(sql).toContain("store_master_data.updated");
  });

  it("rejects stale personnel master saves before mutating employee rows", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ user_id: "actor-1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            employee_id: "employee-1",
            company_id: "company-1",
            updated_at: "2026-06-30T10:01:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            store_id: "store-1",
            region_id: "region-1",
            company_id: "company-1",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ position_id: "position-1" }] })
      .mockResolvedValueOnce({ rows: [{ assignment_id: "assignment-1" }] })
      .mockResolvedValueOnce({ rows: [{ is_current: false }] });
    const { repository } = createRepository(query);

    await expect(
      repository.updatePersonnelMaster({
        actorCompanyIds: ["company-1"],
        employeeId: "employee-1",
        firstName: "Ada",
        lastName: "Lovelace",
        externalEmployeeRef: "FM8375",
        employmentStatus: "active",
        employmentType: "full_time",
        hireDate: "2026-01-01",
        storeId: "store-1",
        positionId: "position-1",
        actorUserId: "actor-1",
        expectedUpdatedAt: "2026-06-30T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).not.toContain("UPDATE ops.employee\n          SET");
    expect(sql).not.toContain("personnel_master_data.updated");
  });
});
