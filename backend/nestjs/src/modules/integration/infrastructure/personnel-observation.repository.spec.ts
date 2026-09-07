import { PersonnelObservationRepository } from "./personnel-observation.repository";

const SOURCE = "00000000-0000-4000-8000-000000000001";
const STORE = "00000000-0000-4000-8000-000000000002";
const DAY = "2026-09-06";
function input() {
  return { sourceId: SOURCE, businessDate: DAY, generation: "2", digest: "a".repeat(64),
    observations: [{ storeCode: "001", personnelCode: "0009" }] };
}
function setup(acceptedGeneration = "0", digest: string | null = null) {
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes("FROM stg.integration_source")) return { rows: [{ integration_source_id: SOURCE }] };
    if (sql.includes("FOR UPDATE")) return { rows: [{ generation: "2", accepted_generation: acceptedGeneration, accepted_digest: digest }] };
    if (sql.includes("FROM ops.store")) return { rows: [{ store_id: STORE, store_code: "001" },
      { store_id: "00000000-0000-4000-8000-000000000003", store_code: "002" }] };
    if (sql.includes("RETURNING generation")) return { rows: [{ generation: "2" }] };
    if (sql.includes("SELECT count(*)::text AS count")) return { rows: [{ count: "1" }] };
    return { rows: [] };
  });
  const withTransaction = jest.fn(async (work) => work({ query }));
  return { repository: new PersonnelObservationRepository({ query, withTransaction } as never), query, withTransaction };
}
describe("PersonnelObservationRepository", () => {
  it("allocates attempts under the shared sales lock and active-source lock", async () => {
    const { repository, query } = setup();
    expect(await repository.beginAttempt(SOURCE, DAY)).toBe("2");
    expect(query.mock.calls[0][1]).toEqual([`company-daily-kpi:${SOURCE}:${DAY}:sales`]);
    expect(query.mock.calls[1][0]).toContain("FOR SHARE");
    expect(query.mock.calls[2][0]).toContain("generation + 1");
  });
  it("rejects malformed or private extra fields before any transaction", async () => {
    const { repository, withTransaction } = setup();
    await expect(repository.replace({ ...input(), observations: [
      { storeCode: "001", personnelCode: "0009", displayName: "private" } as never,
    ] })).rejects.toThrow("personnel_observation_invalid");
    await expect(repository.replace({ ...input(), generation: "02" })).rejects.toThrow();
    await expect(repository.replace({ ...input(), businessDate: "2026-02-30" })).rejects.toThrow();
    expect(withTransaction).not.toHaveBeenCalled();
  });
  it("rejects stale attempts and conflicting accepted digests before deletion", async () => {
    const stale = setup();
    await expect(stale.repository.replace({ ...input(), generation: "1" })).rejects.toThrow();
    const conflict = setup("2", "b".repeat(64));
    await expect(conflict.repository.replace(input())).rejects.toThrow();
    for (const query of [stale.query, conflict.query]) {
      expect(query.mock.calls.some(([sql]) => /DELETE|INSERT|UPDATE ops/.test(sql))).toBe(false);
    }
  });
  it("deduplicates exact pairs while preserving multi-store codes and excluding unavailable stores", async () => {
    const { repository, query } = setup();
    const result = await repository.replace({ ...input(), observations: [
      ...input().observations, ...input().observations,
      { storeCode: "002", personnelCode: "0009" },
      { storeCode: "disabled", personnelCode: "0009" },
      { storeCode: "missing", personnelCode: "0009" },
    ] });
    expect(result).toEqual({ acceptedCount: 2, excludedCount: 2, unchanged: false });
    const mapping = query.mock.calls.find(([sql]) => sql.includes("FROM ops.store"))!;
    expect(mapping[0]).toContain("status = 'active'");
    expect(mapping[0]).toContain("kpi_import_enabled = TRUE FOR SHARE");
    const write = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO ops.personnel_observation\n"))!;
    expect(JSON.parse(String(write[1]?.[2]))).toHaveLength(2);
    expect(write[1]?.[2]).toContain('"personnel_code":"0009"');
    expect(query.mock.calls.find(([sql]) => sql.includes("DELETE"))?.[1]).toEqual([SOURCE, DAY]);
    expect(query.mock.calls.map(([sql]) => sql).join()).not.toMatch(/ops\.employee|ops\.kpi_actual|auth\.|INSERT INTO ops\.store/);
  });
  it("makes an accepted matching retry a no-op", async () => {
    const { repository, query } = setup("2", "a".repeat(64));
    expect(await repository.replace(input())).toEqual({ acceptedCount: 1, excludedCount: 0, unchanged: true });
    expect(query.mock.calls.some(([sql]) => /DELETE|INSERT|UPDATE ops/.test(sql))).toBe(false);
  });
  it("clears only the selected day for an accepted empty set", async () => {
    const { repository, query } = setup();
    expect(await repository.replace({ ...input(), observations: [] })).toEqual({ acceptedCount: 0, excludedCount: 0, unchanged: false });
    expect(query.mock.calls.find(([sql]) => sql.includes("DELETE"))?.[1]).toEqual([SOURCE, DAY]);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO ops.personnel_observation\n"))).toBe(false);
  });
  it("propagates a fact-write failure to the transaction without accepting the generation", async () => {
    const { repository, query } = setup();
    const original = query.getMockImplementation()!;
    query.mockImplementation(async (sql, params) => {
      if (sql.includes("INSERT INTO ops.personnel_observation\n")) throw new Error("write_failure");
      return original(sql, params);
    });
    await expect(repository.replace(input())).rejects.toThrow("write_failure");
    expect(query.mock.calls.some(([sql]) => sql.includes("SET accepted_generation"))).toBe(false);
  });
  it("rejects empty company scope and binds scope plus pagination to one snapshot query", async () => {
    const { repository, query } = setup();
    const list = { actorCompanyIds: [], fromDate: DAY, toDate: DAY, limit: 10, offset: 20 };
    await expect(repository.list(list)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    query.mockResolvedValueOnce({ rows: [{ rows: [], total: "12" }] } as never);
    expect(await repository.list({ ...list, actorCompanyIds: [SOURCE], q: "%" })).toEqual({ rows: [], total: 12 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("s.company_id = ANY($1::uuid[])");
    expect(query.mock.calls[0][0]).toContain("WITH scoped AS MATERIALIZED");
    expect(query.mock.calls[0][1]).toEqual([[SOURCE], DAY, DAY, null, "%", 10, 20]);
  });
});
