import { resolveCurrentStoreId } from "./ranking-list.helpers";

describe("resolveCurrentStoreId", () => {
  it("uses an explicitly requested authorized store before the first scope entry", () => {
    expect(
      resolveCurrentStoreId(
        {
          assignedStoreIds: ["store-a", "store-b"],
          storeIds: ["store-a", "store-b"],
          storeId: "store-b",
        },
        null,
      ),
    ).toBe("store-b");
  });

  it("ignores a requested store outside the caller's authorized store scope", () => {
    expect(
      resolveCurrentStoreId(
        {
          assignedStoreIds: ["store-a"],
          storeIds: ["store-a"],
          storeId: "store-other",
        },
        null,
      ),
    ).toBe("store-a");
  });
});
