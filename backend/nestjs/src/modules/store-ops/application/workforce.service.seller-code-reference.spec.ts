import { WorkforceService } from "./workforce.service";

describe("seller code reference", () => {
  it("takes the latest code and next preview from one bounded history snapshot", async () => {
    const codes = ["FM922337203685477580899", "FM9007199254740993", "FM99"];
    const repository = { getRecentFranchiseSellerCodes: jest.fn().mockResolvedValue(codes) };
    const service = new WorkforceService({} as never, repository as never);
    await expect(service.getSellerCodeReference("franchise")).resolves.toEqual({
      storeType: "franchise", prefix: "FM", lastSellerCode: codes[0], recentSellerCodes: codes,
      nextSellerCodePreview: "FM922337203685477580900",
    });
    expect(repository.getRecentFranchiseSellerCodes).toHaveBeenCalledTimes(1);
  });
  it("preserves the empty namespace preview", async () => {
    const service = new WorkforceService({} as never, { getRecentFranchiseSellerCodes: async () => [] } as never);
    await expect(service.getSellerCodeReference("franchise")).resolves.toEqual({
      storeType: "franchise", prefix: "FM", lastSellerCode: null, recentSellerCodes: [], nextSellerCodePreview: "FM1",
    });
  });
});
