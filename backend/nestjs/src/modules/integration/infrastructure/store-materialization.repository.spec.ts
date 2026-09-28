import { StoreMaterializationRepository } from "./store-materialization.repository";

describe("StoreMaterializationRepository", () => {
  it("does not overwrite ownership for an existing store", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ store_id: "00000000-0000-4000-8000-000000000001" }],
      rowCount: 1,
    });
    const repository = new StoreMaterializationRepository({ query } as never);

    await expect(repository.upsertStore({
      storeId: "00000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000002",
      regionId: "00000000-0000-4000-8000-000000000003",
      storeCode: "SM140",
      storeName: "Marmara Park",
      storeType: "company",
      status: "active",
      timezone: "Europe/Istanbul",
    })).resolves.toBe("00000000-0000-4000-8000-000000000001");

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("ON CONFLICT (store_code) DO UPDATE");
    expect(sql).not.toContain("store_type = EXCLUDED.store_type");
    expect(sql).toContain("ops.store.company_id = EXCLUDED.company_id");
    expect(sql).toContain("ops.store.store_type = EXCLUDED.store_type");
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(["company"]));
  });

  it("rejects an imported ownership mismatch instead of marking it processed", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = new StoreMaterializationRepository({ query } as never);

    await expect(repository.upsertStore({
      storeId: "00000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000002",
      regionId: "00000000-0000-4000-8000-000000000003",
      storeCode: "SM140",
      storeName: "Marmara Park",
      storeType: "franchise",
      status: "active",
      timezone: "Europe/Istanbul",
    })).rejects.toThrow("record an explicit master-data transition first");
  });
});
