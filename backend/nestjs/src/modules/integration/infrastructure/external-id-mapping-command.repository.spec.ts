import { ExternalIdMappingCommandRepository } from "./external-id-mapping-command.repository";

describe("ExternalIdMappingCommandRepository", () => {
  it("finds active exact mappings", async () => {
    const query = jest.fn(async () => ({
      rowCount: 1,
      rows: [{ internal_id: "00000000-0000-4000-8000-000000000140" }],
    }));
    const repository = new ExternalIdMappingCommandRepository({ query } as never);

    const result = await repository.findActiveMapping({
      integrationSourceId: "00000000-0000-4000-8000-000000000001",
      entityType: "store",
      externalId: "SM-140",
    });

    expect(result).toEqual({ internalId: "00000000-0000-4000-8000-000000000140" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("FROM stg.external_id_map"), [
      "00000000-0000-4000-8000-000000000001",
      "store",
      "SM-140",
    ]);
  });

  it("finds active mappings by normalized external id", async () => {
    const query = jest.fn(async () => ({
      rowCount: 2,
      rows: [
        { internal_id: "00000000-0000-4000-8000-000000000140" },
        { internal_id: "00000000-0000-4000-8000-000000000141" },
      ],
    }));
    const repository = new ExternalIdMappingCommandRepository({ query } as never);

    const result = await repository.findActiveMappingsByNormalizedExternalId({
      integrationSourceId: "00000000-0000-4000-8000-000000000001",
      entityType: "store",
      normalizedExternalId: "SM140",
    });

    expect(result).toEqual([
      { internalId: "00000000-0000-4000-8000-000000000140" },
      { internalId: "00000000-0000-4000-8000-000000000141" },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPPER(REGEXP_REPLACE"),
      [
        "00000000-0000-4000-8000-000000000001",
        "store",
        "SM140",
      ],
    );
  });

  it("upserts mappings without changing conflict semantics", async () => {
    const query = jest.fn(async () => ({ rowCount: 1, rows: [] }));
    const repository = new ExternalIdMappingCommandRepository({ query } as never);

    await repository.upsertMapping({
      integrationSourceId: "00000000-0000-4000-8000-000000000001",
      entityType: "store",
      externalId: "SM-140",
      internalId: "00000000-0000-4000-8000-000000000140",
      internalTableName: "ops.store",
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT"), [
      "00000000-0000-4000-8000-000000000001",
      "store",
      "SM-140",
      "00000000-0000-4000-8000-000000000140",
      "ops.store",
    ]);
  });
});
