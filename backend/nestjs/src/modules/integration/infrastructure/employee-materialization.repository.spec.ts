import { EmployeeMaterializationRepository } from "./employee-materialization.repository";

describe("EmployeeMaterializationRepository", () => {
  it("does not reactivate a separated employee when historical active data is replayed", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new EmployeeMaterializationRepository({ query } as never);
    await repository.upsertEmployee({
      employeeId: "00000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000002",
      externalEmployeeRef: "17", firstName: "Test", lastName: "Person",
      hireDate: "2025-01-01", employmentStatus: "active", employmentType: "full_time",
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("ops.employee.employment_status <> 'active'");
    expect(sql).toContain("ops.employee.termination_date IS NOT NULL");
    expect(sql).toContain("EXCLUDED.employment_status = 'active'");
  });
});
