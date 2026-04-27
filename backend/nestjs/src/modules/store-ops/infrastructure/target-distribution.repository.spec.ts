import { TargetDistributionRepository } from "./target-distribution.repository";

describe("TargetDistributionRepository", () => {
  it("does not list all target requests when actor scope is empty", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetDistributionRepository({ query } as never);

    await repository.listRequests({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      statuses: ["pending"],
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE FALSE"), [
      ["pending"],
      50,
      0,
    ]);
  });

  it("uses the narrowest available actor scope before status filters", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetDistributionRepository({ query } as never);

    await repository.listRequests({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: ["00000000-0000-0000-0000-000000000010"],
      storeIds: ["00000000-0000-0000-0000-000000000100"],
      statuses: ["pending"],
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("tdr.store_id = ANY($1::uuid[]) AND tdr.request_status = ANY($2::text[])"),
      [
        ["00000000-0000-0000-0000-000000000100"],
        ["pending"],
        50,
        0,
      ],
    );
  });
});
