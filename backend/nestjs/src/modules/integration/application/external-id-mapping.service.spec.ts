import { ExternalIdMappingService } from "./external-id-mapping.service";

describe("ExternalIdMappingService", () => {
  function createRepositoryMock(input?: {
    findActiveMapping?: jest.Mock;
    findActiveMappingsByNormalizedExternalId?: jest.Mock;
    upsertMapping?: jest.Mock;
  }) {
    return {
      findActiveMapping: input?.findActiveMapping ?? jest.fn(async () => null),
      findActiveMappingsByNormalizedExternalId:
        input?.findActiveMappingsByNormalizedExternalId ?? jest.fn(async () => []),
      upsertMapping: input?.upsertMapping ?? jest.fn(async () => undefined),
    };
  }

  it("resolves external ids through normalized fallback when exact mapping is missing", async () => {
    const repository = createRepositoryMock({
      findActiveMappingsByNormalizedExternalId: jest.fn(async () => [
        { internalId: "00000000-0000-4000-8000-000000000140" },
      ]),
    });
    const service = new ExternalIdMappingService(repository as never);

    const result = await service.resolveMappedInternalId(
      "00000000-0000-4000-8000-000000000001",
      "store",
      "SM-140",
    );

    expect(result).toBe("00000000-0000-4000-8000-000000000140");
    expect(repository.findActiveMapping).toHaveBeenCalledWith({
      integrationSourceId: "00000000-0000-4000-8000-000000000001",
      entityType: "store",
      externalId: "SM-140",
    });
    expect(repository.findActiveMappingsByNormalizedExternalId).toHaveBeenCalledWith({
      integrationSourceId: "00000000-0000-4000-8000-000000000001",
      entityType: "store",
      normalizedExternalId: "SM140",
    });
  });

  it("rejects ambiguous normalized external id mappings", async () => {
    const repository = createRepositoryMock({
      findActiveMappingsByNormalizedExternalId: jest.fn(async () => [
        { internalId: "00000000-0000-4000-8000-000000000140" },
        { internalId: "00000000-0000-4000-8000-000000000141" },
      ]),
    });
    const service = new ExternalIdMappingService(repository as never);

    await expect(
      service.resolveMappedInternalId(
        "00000000-0000-4000-8000-000000000001",
        "store",
        "SM-140",
      ),
    ).rejects.toThrow("Ambiguous external id mapping");
  });

  it("keeps exact external id mapping precedence over normalized fallback", async () => {
    const repository = createRepositoryMock({
      findActiveMapping: jest.fn(async () => ({
        internalId: "00000000-0000-4000-8000-000000000999",
      })),
    });
    const service = new ExternalIdMappingService(repository as never);

    const result = await service.resolveMappedInternalId(
      "00000000-0000-4000-8000-000000000001",
      "store",
      "SM-140",
    );

    expect(result).toBe("00000000-0000-4000-8000-000000000999");
    expect(repository.findActiveMappingsByNormalizedExternalId).not.toHaveBeenCalled();
  });

  it("delegates mapping upserts to the command repository", async () => {
    const repository = createRepositoryMock();
    const service = new ExternalIdMappingService(repository as never);

    const input = {
      integrationSourceId: "00000000-0000-4000-8000-000000000001",
      entityType: "store",
      externalId: "SM-140",
      internalId: "00000000-0000-4000-8000-000000000140",
      internalTableName: "ops.store",
    };

    await service.upsertMapping(input);

    expect(repository.upsertMapping).toHaveBeenCalledWith(input);
  });
});

