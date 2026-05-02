import { StoreOpsRepository } from "./store-ops.repository";

describe("StoreOpsRepository", () => {
  it("does not let a requested store filter bypass an empty actor scope", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new StoreOpsRepository({ query } as never);

    await repository.listStoresByScope({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      requestedStoreId: "00000000-0000-0000-0000-000000000100",
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE FALSE"), [
      "00000000-0000-0000-0000-000000000100",
    ]);
  });

  it("intersects requested company filters with the actor company scope", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new StoreOpsRepository({ query } as never);

    await repository.listStoresByScope({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [],
      requestedCompanyId: "00000000-0000-0000-0000-000000000002",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("s.company_id = ANY($1::uuid[]) AND s.company_id = $2"),
      [
        ["00000000-0000-0000-0000-000000000001"],
        "00000000-0000-0000-0000-000000000002",
      ],
    );
  });
});
