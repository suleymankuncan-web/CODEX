import {
  resolveRankingAccess,
  sanitizeRankingPagination,
} from "./ranking-access.policy";

describe("ranking access policy", () => {
  it("caps store personnel to Top 100 summary-only rankings", () => {
    expect(
      resolveRankingAccess({
        roleCodes: ["STORE_PERSONNEL"],
        requestedLimit: 500,
        requestedOffset: 300,
      }),
    ).toEqual({
      isPrivileged: false,
      canSeeGlobalDetails: false,
      globalLimit: 100,
      globalOffset: 0,
      globalMode: "top100",
      canSeeManagedStorePersonnelDetails: false,
    });
  });

  it("allows store managers to see own-store personnel detail but keeps global Top 100 summary-only", () => {
    expect(
      resolveRankingAccess({
        roleCodes: ["STORE_MANAGER"],
        requestedLimit: 300,
        requestedOffset: 200,
      }),
    ).toEqual({
      isPrivileged: false,
      canSeeGlobalDetails: false,
      globalLimit: 100,
      globalOffset: 0,
      globalMode: "top100",
      canSeeManagedStorePersonnelDetails: true,
    });
  });

  it("allows region managers and super admins to page through full rankings with details", () => {
    expect(
      resolveRankingAccess({
        roleCodes: ["REGION_MANAGER"],
        requestedLimit: 700,
        requestedOffset: 200,
      }),
    ).toEqual({
      isPrivileged: true,
      canSeeGlobalDetails: true,
      globalLimit: 500,
      globalOffset: 200,
      globalMode: "full",
      canSeeManagedStorePersonnelDetails: true,
    });

    expect(
      resolveRankingAccess({
        roleCodes: ["SUPER_ADMIN"],
        requestedLimit: 50,
        requestedOffset: 100,
      }).globalMode,
    ).toBe("full");
  });

  it("normalizes pagination defaults", () => {
    expect(
      sanitizeRankingPagination({ limit: undefined, offset: undefined }),
    ).toEqual({
      limit: 100,
      offset: 0,
    });
    expect(sanitizeRankingPagination({ limit: 0, offset: -1 })).toEqual({
      limit: 100,
      offset: 0,
    });
  });
});
