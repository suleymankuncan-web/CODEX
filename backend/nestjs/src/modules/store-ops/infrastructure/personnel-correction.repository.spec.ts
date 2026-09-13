import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DatabaseService } from "../../../shared/database/database.service";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { correctionReviewCompanies } from "../application/personnel-correction-scope";
import { CreatePersonnelCorrectionDto } from "../web/dto/personnel-correction.dto";
import { PersonnelCorrectionRepository } from "./personnel-correction.repository";

const id = "10000000-0000-4000-8000-000000000001";
const storeId = "20000000-0000-4000-8000-000000000001";
const companyId = "30000000-0000-4000-8000-000000000001";
const values = { firstName: "Test", lastName: "Person", phoneNumber: "", hireDate: "2026-09-07", employmentType: "full_time" as const, positionId: id };
const manager = { readScope: { companyIds: [companyId], regionIds: [], storeIds: [storeId] }, assignedStoreIds: [storeId], userId: id, roleCodes: ["STORE_MANAGER"], scope: { companyIds: [companyId], regionIds: [], storeIds: [storeId] }, actionScope: { assignedStoreIds: [storeId], assignedStoreTypes: [] } } as AuthenticatedUser;
const hr = { ...manager, roleCodes: ["HR_ADMIN"] };
const state = { employee_id: id, company_id: companyId, region_id: id, store_id: storeId, assignment_id: id, employee_revision: "2026-09-07 00:00:00+00", assignment_revision: "2026-09-07 00:00:00+00", revision: "revision", values };
const row = { ...state, request_id: id, previous_values: values, proposed_values: { ...values, firstName: "Corrected" }, request_status: "pending_hr_approval" };
const input = { employeeId: id, storeId, expectedRevision: "revision", proposed: { ...values, phoneNumber: "05551234567", email: "person@example.test", nationalId: "12345678901" }, reason: "Correction" };

function setup() {
  const query = jest.fn(async (sql: string, _params?: unknown[]): Promise<{ rows: unknown[] }> => {
    if (sql.includes("SELECT employee_id FROM ops.employee")) return { rows: [{ employee_id: id }] };
    if (sql.includes("concat(e.updated_at")) return { rows: [state] };
    if (sql.includes("SELECT position_id FROM ops.position")) return { rows: [{ position_id: id }] };
    if (sql.includes("SELECT request_id FROM ops.personnel")) return { rows: [] };
    if (sql.includes("SELECT * FROM ops.personnel")) return { rows: [row] };
    if (sql.includes("AS matches")) return { rows: [{ matches: true }] };
    if (sql.includes("RETURNING *")) return { rows: [row] };
    return { rows: [] };
  });
  const withTransaction = jest.fn(async (work) => work({ query }));
  const repository = new PersonnelCorrectionRepository({ query, withTransaction } as unknown as DatabaseService);
  return { repository, query, withTransaction };
}

describe("Personnel correction boundaries", () => {
  it("denies a manager using read-only store scope before querying", async () => {
    const { repository, query } = setup();
    await expect(repository.submit({ ...manager, actionScope: { assignedStoreIds: [], assignedStoreTypes: [] } }, input)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
  it("denies a region manager even with a store assignment", async () => {
    const { repository, query } = setup();
    await expect(repository.submit({ ...manager, roleCodes: ["REGION_MANAGER"] }, input)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
  it("does not borrow another role's company permissions for HR approval", () => {
    expect(correctionReviewCompanies({ ...hr, roleScopes: { HR_ADMIN: { companyIds: [], regionIds: [], storeIds: [] }, REPORT_VIEWER: manager.scope } })).toEqual([]);
    expect(correctionReviewCompanies(manager)).toEqual([]);
  });
  it("submits a staged request and audit without changing personnel", async () => {
    const { repository, query, withTransaction } = setup();
    await repository.submit(manager, input);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO ops.personnel_correction_request"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO audit.event_log"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE ops.employee"))).toBe(false);
  });
  it("hashes national ID before staging and never exposes its hash", async () => {
    const { repository, query } = setup();
    const output = await repository.submit(manager, { ...input, proposed: { ...values, email: "person@example.test", nationalId: "12345678901" } });
    const serialized = JSON.stringify(query.mock.calls);
    expect(serialized).not.toContain("12345678901");
    expect(serialized).toContain("8901");
    expect(output).not.toHaveProperty("proposed_national_id_hash");
  });
  it("rejects stale form data before staging", async () => {
    const { repository, query } = setup();
    await expect(repository.submit(manager, { ...input, expectedRevision: "old" })).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(false);
  });
  it("rejects missing or other-store personnel", async () => {
    const { repository, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ employee_id: id }] }).mockResolvedValueOnce({ rows: [] });
    await expect(repository.submit(manager, input)).rejects.toBeInstanceOf(NotFoundException);
  });
  it("rejects duplicate pending requests", async () => {
    const { repository, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ employee_id: id }] }).mockResolvedValueOnce({ rows: [state] })
      .mockResolvedValueOnce({ rows: [{ position_id: id }] }).mockResolvedValueOnce({ rows: [row] });
    await expect(repository.submit(manager, input)).rejects.toBeInstanceOf(ConflictException);
  });
  it("scopes HR lookup to allowed companies and rejects invisible requests", async () => {
    const { repository, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.review(hr, id, { decision: "approve", note: "Checked" })).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("company_id=ANY($2::uuid[])"), [id, [companyId]]);
  });
  it("blocks duplicate review without applying personnel writes", async () => {
    const { repository, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ ...row, request_status: "approved" }] });
    await expect(repository.review(hr, id, { decision: "approve", note: "Checked" })).rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("rejects approval if either employee or assignment revision changed", async () => {
    const { repository, query } = setup();
    query.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [{ employee_id: id }] })
      .mockResolvedValueOnce({ rows: [state] }).mockResolvedValueOnce({ rows: [{ matches: false }] });
    await expect(repository.review(hr, id, { decision: "approve", note: "Checked" })).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE ops.employee"))).toBe(false);
  });
  it("applies correction, finalizes request and audits in the same transaction", async () => {
    const { repository, query, withTransaction } = setup();
    await repository.review(hr, id, { decision: "approve", note: "Checked" });
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls.filter(([sql]) => sql.includes("UPDATE ops.employee"))).toHaveLength(2);
    expect(query.mock.calls.some(([sql]) => sql.includes("external_employee_ref="))).toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO audit.event_log"))).toBe(true);
  });
  it("rejects with an audit and no master-data mutation", async () => {
    const { repository, query } = setup();
    await repository.review(hr, id, { decision: "reject", note: "Needs correction" });
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE ops.employee"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO audit.event_log"))).toBe(true);
  });
});

describe("Personnel correction input validation", () => {
  it("accepts complete authorized fields", async () => {
    expect(await validate(plainToInstance(CreatePersonnelCorrectionDto, input))).toHaveLength(0);
  });
  it.each([
    { proposed: undefined }, { proposed: { ...input.proposed, email: undefined } }, { proposed: { ...input.proposed, nationalId: undefined } }, { proposed: { ...input.proposed, phoneNumber: "" } }, { proposed: { ...values, firstName: " " } },
    { proposed: { ...values, phoneNumber: "abc" } }, { proposed: { ...values, hireDate: "2026-02-30" } },
    { proposed: { ...values, employmentType: "owner" } }, { proposed: { ...values, positionId: "bad" } },
    { proposed: { ...values, email: "bad" } }, { proposed: { ...values, nationalId: "123" } },
    { reason: " " }, { storeId: "bad" }, { employeeId: "bad" },
  ])("rejects invalid input %#", async (patch) => {
    expect((await validate(plainToInstance(CreatePersonnelCorrectionDto, { ...input, ...patch }))).length).toBeGreaterThan(0);
  });
});
