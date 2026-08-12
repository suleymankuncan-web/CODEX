import { createPhotoMediaMaintenanceObjectOperations } from "./photo-media-maintenance-object-operations";

describe("photo media maintenance object operations", () => {
  const storage = {
    putObject: jest.fn(),
    headObject: jest.fn(),
    getObject: jest.fn(),
    deleteObject: jest.fn(),
    listObjectVersions: jest.fn(),
    listObjectVersionsByPrefix: jest.fn(),
  };
  const reserve = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    for (const mock of Object.values(storage)) mock.mockReset();
    reserve.mockReset().mockResolvedValue(undefined);
    storage.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => {
      const inventory = await storage.listObjectVersions({ objectKey: prefix });
      return { versions: inventory?.versions ?? [], deleteMarkers: inventory?.deleteMarkers ?? [] };
    });
  });

  it("reserves before invoking each provider operation", async () => {
    const calls: string[] = [];
    reserve.mockImplementation(async (classA: number, classB: number, enforceHardLimits?: boolean) => {
      calls.push(`reserve:${classA}:${classB}${enforceHardLimits === false ? ":false" : ""}`);
    });
    storage.headObject.mockImplementation(async () => {
      calls.push("head");
      return null;
    });
    storage.getObject.mockImplementation(async () => {
      calls.push("get");
      return Buffer.from("body");
    });
    storage.putObject.mockImplementation(async () => {
      calls.push("put");
      return { versionId: "v1" };
    });
    storage.listObjectVersions.mockImplementation(async () => {
      calls.push("list");
      return { versions: [] };
    });
    storage.deleteObject.mockImplementation(async () => {
      calls.push("delete");
      return { versionId: "v1", deleteMarker: false };
    });
    const operations = createPhotoMediaMaintenanceObjectOperations({
      provider: "seaweedfs",
      reserve,
    });

    await operations.put(storage as never, {
      objectKey: "locked/a",
      body: Buffer.from("body"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
    });
    await operations.head(storage as never, { objectKey: "locked/a", versionId: "v1" });
    await operations.get(storage as never, { objectKey: "locked/a", versionId: "v1" });
    await operations.listVersions(storage as never, { objectKey: "locked/a" });
    await operations.delete(storage as never, { objectKey: "locked/a", versionId: "v1" });

    expect(calls).toEqual([
      "reserve:1:0", "put",
      "reserve:0:1", "head",
      "reserve:0:1", "get",
      "reserve:1:0", "list",
      "reserve:1:1:false", "delete",
    ]);
  });

  it("does not reserve a post-delete HEAD for historical R2 key-only deletion", async () => {
    storage.deleteObject.mockResolvedValue({ deleteMarker: false });
    const operations = createPhotoMediaMaintenanceObjectOperations({ provider: "r2", reserve });

    await operations.delete(storage as never, "locked/a");

    expect(reserve).toHaveBeenCalledWith(1, 0, false);
    expect(storage.deleteObject).toHaveBeenCalledWith("locked/a");
  });

  it("reserves every page of local version inventory and rejects exact-key delete markers", async () => {
    storage.listObjectVersionsByPrefix
      .mockResolvedValueOnce({
        versions: [{ objectKey: "locked/a", versionId: "v1" }],
        deleteMarkers: [],
        nextCursor: { keyMarker: "locked/a", versionIdMarker: "v1" },
      })
      .mockResolvedValueOnce({
        versions: [{ objectKey: "locked/a", versionId: "v2" }],
        deleteMarkers: [],
      });
    const operations = createPhotoMediaMaintenanceObjectOperations({ provider: "seaweedfs", reserve });

    await expect(operations.listVersions(storage as never, { objectKey: "locked/a" })).resolves.toEqual({
      versions: [
        { objectKey: "locked/a", versionId: "v1" },
        { objectKey: "locked/a", versionId: "v2" },
      ],
    });
    expect(reserve).toHaveBeenNthCalledWith(1, 1, 0);
    expect(reserve).toHaveBeenNthCalledWith(2, 1, 0);
    expect(storage.listObjectVersionsByPrefix).toHaveBeenCalledTimes(2);
  });

  it("fails closed when local version inventory contains an exact-key delete marker", async () => {
    storage.listObjectVersionsByPrefix.mockResolvedValue({
      versions: [], deleteMarkers: [{ objectKey: "locked/a", versionId: "marker-v1" }],
    });
    const operations = createPhotoMediaMaintenanceObjectOperations({ provider: "seaweedfs", reserve });

    await expect(operations.listVersions(storage as never, { objectKey: "locked/a" }))
      .rejects.toThrow("delete marker");
  });

  it("propagates a hard-limit reservation failure before provider I/O", async () => {
    reserve.mockRejectedValue(new Error("limit"));
    const operations = createPhotoMediaMaintenanceObjectOperations({ provider: "seaweedfs", reserve });

    await expect(operations.put(storage as never, {
      objectKey: "locked/a",
      body: Buffer.from("body"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
    })).rejects.toThrow("limit");
    expect(storage.putObject).not.toHaveBeenCalled();
  });
});
