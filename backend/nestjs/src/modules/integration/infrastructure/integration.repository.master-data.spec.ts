import { ConflictException } from "@nestjs/common";
import { IntegrationRepository } from "./integration.repository";

describe("IntegrationRepository master data writes", () => {
  function createRepository(query: jest.Mock) {
    const withTransaction = jest.fn(async (callback) => callback({ query }));
    const deactivateUserAccessInTransaction = jest.fn().mockResolvedValue({
      user: { user_id: "user-1" },
      closedRoleAssignments: 2,
      closedActionStoreAssignments: 1,
      revokedMobileSessions: 1,
    });
    const repository = new IntegrationRepository(
      { withTransaction } as never,
      {} as never,
      { deactivateUserAccessInTransaction } as never,
    );

    return { repository, withTransaction, deactivateUserAccessInTransaction };
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
        regionManagerUserId: "manager-1",
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
      .mockResolvedValueOnce({ rows: [{ is_valid: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const { repository } = createRepository(query);

    await expect(
      repository.updateKpiImportStoreScope({
        actorCompanyIds: ["company-1"],
        storeId: "store-1",
        storeType: "company",
        regionId: "region-1",
        regionManagerUserId: "manager-1",
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
    expect(sql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(sql).toContain("UPDATE ops.user_action_store_assignment manager_store");
    expect(sql).toContain("INSERT INTO ops.user_action_store_assignment");
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
        phoneNumber: "+90 555 111 22 33",
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

  it("updates personnel contact data with the guarded master record", async () => {
    const updatedRow = {
      employee_id: "employee-1",
      external_employee_ref: "FM8375",
      first_name: "Ada",
      last_name: "Lovelace",
      national_id_last4: "8901",
      phone_number: "+90 555 222 33 44",
      hire_date: "2026-01-01",
      termination_date: null,
      employment_status: "active",
      employment_type: "full_time",
      assignment_id: "assignment-1",
      assignment_start_date: "2026-01-01",
      store_id: "store-1",
      store_code: "STORE-1",
      store_name: "Store One",
      region_id: "region-1",
      region_name: "Region One",
      position_id: "position-1",
      position_code: "SALES",
      position_name: "Sales",
      updated_at: "2026-08-28T14:00:00.000Z",
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ user_id: "actor-1" }] })
      .mockResolvedValueOnce({ rows: [{ employee_id: "employee-1", company_id: "company-1", updated_at: "2026-08-28T13:00:00.000Z" }] })
      .mockResolvedValueOnce({ rows: [{ store_id: "store-1", region_id: "region-1", company_id: "company-1" }] })
      .mockResolvedValueOnce({ rows: [{ position_id: "position-1" }] })
      .mockResolvedValueOnce({ rows: [{ assignment_id: "assignment-1" }] })
      .mockResolvedValueOnce({ rows: [{ is_current: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [updatedRow] });
    const { repository } = createRepository(query);

    await expect(repository.updatePersonnelMaster({
      actorCompanyIds: ["company-1"],
      employeeId: "employee-1",
      firstName: "Ada",
      lastName: "Lovelace",
      externalEmployeeRef: "FM8375",
      phoneNumber: "+90 555 222 33 44",
      employmentStatus: "active",
      employmentType: "full_time",
      hireDate: "2026-01-01",
      storeId: "store-1",
      positionId: "position-1",
      actorUserId: "actor-1",
      expectedUpdatedAt: "2026-08-28T13:00:00.000Z",
    })).resolves.toEqual(updatedRow);

    const employeeUpdate = query.mock.calls.find(([statement]) => String(statement).includes("UPDATE ops.employee\n          SET"));
    expect(String(employeeUpdate?.[0])).toContain("phone_number = COALESCE(NULLIF(BTRIM($8), ''), phone_number)");
    expect(employeeUpdate?.[1]).toContain("+90 555 222 33 44");
  });

  it("persists only hashed personnel identity and returns masked contact fields", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ user_id: "actor-1" }] })
      .mockResolvedValueOnce({
        rows: [{ store_id: "store-1", region_id: "region-1", company_id: "company-1" }],
      })
      .mockResolvedValueOnce({ rows: [{ position_id: "position-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ employee_id: "employee-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          employee_id: "employee-1",
          external_employee_ref: null,
          first_name: "Ada",
          last_name: "Lovelace",
          national_id_last4: "8901",
          phone_number: "+90 555 111 22 33",
          hire_date: "2026-08-28",
          termination_date: null,
          employment_status: "active",
          employment_type: "full_time",
          assignment_id: "assignment-1",
          assignment_start_date: "2026-08-28",
          store_id: "store-1",
          store_code: "STORE-1",
          store_name: "Store One",
          region_id: "region-1",
          region_name: "Region One",
          position_id: "position-1",
          position_code: "SALES",
          position_name: "Sales",
          updated_at: "2026-08-28T10:00:00.000Z",
        }],
      });
    const { repository } = createRepository(query);

    await expect(repository.createPersonnelMaster({
      actorCompanyIds: ["company-1"],
      actorUserId: "actor-1",
      firstName: "Ada",
      lastName: "Lovelace",
      nationalIdHash: "hash-direct",
      nationalIdAlternateHash: "hash-prefixed",
      nationalIdLast4: "8901",
      phoneNumber: "+90 555 111 22 33",
      employmentType: "full_time",
      hireDate: "2026-08-28",
      storeId: "store-1",
      positionId: "position-1",
    })).resolves.toEqual(expect.objectContaining({
      employee_id: "employee-1",
      national_id_last4: "8901",
      phone_number: "+90 555 111 22 33",
    }));

    const statements = query.mock.calls.map(([statement]) => String(statement));
    const insertIndex = statements.findIndex((statement) => statement.includes("INSERT INTO ops.employee"));
    expect(statements[insertIndex]).toContain("national_id_hash, national_id_last4, phone_number");
    expect(query.mock.calls[insertIndex]?.[1]).toEqual(expect.arrayContaining([
      "hash-direct",
      "8901",
      "+90 555 111 22 33",
    ]));
    const auditIndex = statements.findIndex((statement) => statement.includes("personnel_master_data.created"));
    expect(JSON.stringify(query.mock.calls[auditIndex]?.[1])).not.toContain("12345678901");
  });

  it("terminates personnel, closes active assignments and linked access atomically", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ user_id: "actor-1" }] })
      .mockResolvedValueOnce({
        rows: [{
          employee_id: "employee-1",
          company_id: "company-1",
          hire_date: "2025-01-01",
          employment_status: "active",
          is_current: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          assignment_id: "assignment-1",
          store_id: "store-1",
          region_id: "region-1",
          start_date: "2025-01-01",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          employee_id: "employee-1",
          external_employee_ref: "EMP-1",
          first_name: "Ada",
          last_name: "Lovelace",
          hire_date: "2025-01-01",
          termination_date: "2026-08-28",
          employment_status: "terminated",
          employment_type: "full_time",
          assignment_id: "assignment-1",
          assignment_start_date: "2025-01-01",
          store_id: "store-1",
          store_code: "STORE-1",
          store_name: "Store One",
          region_id: "region-1",
          region_name: "Region One",
          position_id: "position-1",
          position_code: "SALES",
          position_name: "Sales",
          updated_at: "2026-08-28T10:00:00.000Z",
        }],
      });
    const { repository, deactivateUserAccessInTransaction } = createRepository(query);

    await expect(repository.terminatePersonnelMaster({
      actorCompanyIds: ["company-1"],
      actorUserId: "actor-1",
      employeeId: "employee-1",
      terminationDate: "2026-08-28",
      reason: "Employment ended",
    })).resolves.toEqual(expect.objectContaining({
      employee_id: "employee-1",
      employment_status: "terminated",
      accessClosure: expect.objectContaining({
        userAccessClosed: true,
        closedRoleAssignments: 2,
        closedActionStoreAssignments: 1,
        revokedMobileSessions: 1,
      }),
    }));

    expect(deactivateUserAccessInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ query }),
      expect.objectContaining({
        userId: "user-1",
        actorUserId: "actor-1",
        reason: "employee_offboarding",
      }),
    );
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("employment_status = 'terminated'");
    expect(sql).toContain("assignment_status = 'inactive'");
    expect(sql).toContain("INSERT INTO ops.turnover_event");
    expect(sql).toContain("personnel_master_data.terminated");
  });
});
