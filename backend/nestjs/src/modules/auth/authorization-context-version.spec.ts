import { buildAuthorizationContextVersion } from "./authorization-context-version";

describe("buildAuthorizationContextVersion", () => {
  it("is order-independent, sanitized, and changes when a role partition changes", () => {
    const baseline = buildAuthorizationContextVersion({
      REPORT_VIEWER: { companyIds: ["company-b", "company-a"], regionIds: [], storeIds: [] },
      REGION_MANAGER: { companyIds: [], regionIds: ["region-a"], storeIds: ["store-a"] },
    }, {
      VM_REFERENCE_PUBLISHER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
    });
    const reordered = buildAuthorizationContextVersion({
      REGION_MANAGER: { companyIds: [], regionIds: ["region-a"], storeIds: ["store-a"] },
      REPORT_VIEWER: { companyIds: ["company-a", "company-b"], regionIds: [], storeIds: [] },
    }, {
      VM_REFERENCE_PUBLISHER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
    });
    const repartitioned = buildAuthorizationContextVersion({
      REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      REGION_MANAGER: { companyIds: ["company-b"], regionIds: ["region-a"], storeIds: ["store-a"] },
    }, {
      VM_REFERENCE_PUBLISHER: { companyIds: ["company-b"], regionIds: [], storeIds: [] },
    });

    const revokedPermission = buildAuthorizationContextVersion({
      REPORT_VIEWER: { companyIds: ["company-b", "company-a"], regionIds: [], storeIds: [] },
      REGION_MANAGER: { companyIds: [], regionIds: ["region-a"], storeIds: ["store-a"] },
    }, {});

    expect(reordered).toBe(baseline);
    expect(repartitioned).not.toBe(baseline);
    expect(revokedPermission).not.toBe(baseline);
    expect(baseline).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(baseline).not.toContain("company-a");
  });
});
