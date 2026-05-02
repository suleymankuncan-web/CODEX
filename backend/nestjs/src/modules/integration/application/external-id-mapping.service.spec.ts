import { ExternalIdMappingService } from "./external-id-mapping.service";

describe("ExternalIdMappingService", () => {
  it("resolves external ids through normalized fallback when exact mapping is missing", async () => {
    const databaseService = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ internal_id: "00000000-0000-4000-8000-000000000140" }],
        }),
    };
    const service = new ExternalIdMappingService(databaseService as never);

    const result = await service.resolveMappedInternalId(
      "00000000-0000-4000-8000-000000000001",
      "store",
      "SM-140",
    );

    expect(result).toBe("00000000-0000-4000-8000-000000000140");
    expect(databaseService.query).toHaveBeenCalledTimes(2);
    expect(databaseService.query.mock.calls[1][1]).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "store",
      "SM140",
    ]);
  });

  it("rejects ambiguous normalized external id mappings", async () => {
    const databaseService = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            { internal_id: "00000000-0000-4000-8000-000000000140" },
            { internal_id: "00000000-0000-4000-8000-000000000141" },
          ],
        }),
    };
    const service = new ExternalIdMappingService(databaseService as never);

    await expect(
      service.resolveMappedInternalId(
        "00000000-0000-4000-8000-000000000001",
        "store",
        "SM-140",
      ),
    ).rejects.toThrow("Ambiguous external id mapping");
  });

  it("keeps exact external id mapping precedence over normalized fallback", async () => {
    const databaseService = {
      query: jest.fn().mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ internal_id: "00000000-0000-4000-8000-000000000999" }],
      }),
    };
    const service = new ExternalIdMappingService(databaseService as never);

    const result = await service.resolveMappedInternalId(
      "00000000-0000-4000-8000-000000000001",
      "store",
      "SM-140",
    );

    expect(result).toBe("00000000-0000-4000-8000-000000000999");
    expect(databaseService.query).toHaveBeenCalledTimes(1);
  });
});

