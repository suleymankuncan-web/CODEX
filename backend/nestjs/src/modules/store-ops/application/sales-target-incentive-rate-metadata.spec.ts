import { resolveSalesTargetIncentiveRateMetadata } from "./sales-target-incentive-rate-metadata";

// Traceability: INC-FR-004, NFR-007, AC-INC-008, EC-014.

const closedBrackets = [
  { rate_table_version: "manager-v1", audience: "manager", min_achievement_pct: null, max_achievement_pct: "80.0000", rate: "0.0000", sort_order: 10 },
  { rate_table_version: "manager-v1", audience: "manager", min_achievement_pct: "80.0000", max_achievement_pct: null, rate: "0.0100", sort_order: 20 },
  { rate_table_version: "personnel-v1", audience: "personnel", min_achievement_pct: null, max_achievement_pct: "80.0000", rate: "0.0000", sort_order: 10 },
  { rate_table_version: "personnel-v1", audience: "personnel", min_achievement_pct: "80.0000", max_achievement_pct: null, rate: "0.0100", sort_order: 20 },
];

const openRows = closedBrackets.map((bracket) => ({
  rule_version_code: "rule-v1",
  effective_from: "2026-01-01",
  period_timezone: "Europe/Istanbul",
  bracket_boundary_policy: "lower_inclusive_upper_exclusive" as const,
  audience: bracket.audience as "manager" | "personnel",
  rate_table_version: bracket.rate_table_version,
  min_achievement_pct: bracket.min_achievement_pct,
  max_achievement_pct: bracket.max_achievement_pct,
  rate: bracket.rate,
  display_label: "band",
  sort_order: bracket.sort_order,
}));

describe("resolveSalesTargetIncentiveRateMetadata", () => {
  it("uses one consistent immutable snapshot for a fully closed store set", () => {
    const result = resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul",
      scopedStoreCount: 2,
      closedSnapshots: ["store-a", "store-b"].map((storeId) => ({
        store_id: storeId,
        final_snapshot_id: `snapshot-${storeId}`,
        rule_version_code: "rule-v1",
        period_timezone: "Europe/Istanbul",
        rate_table_versions: ["manager-v1", "personnel-v1"],
        rate_brackets_json: closedBrackets,
      })),
      exactRateRows: [],
      expectedOpenVersions: null,
    });

    expect(result.status).toBe("resolved");
    expect(result.ruleVersionCode).toBe("rule-v1");
    expect(result.effectiveFrom).toBeNull();
    expect(result.tables.map((table) => table.version)).toEqual(["manager-v1", "personnel-v1"]);
  });

  it("does not substitute open-period rates when only part of the store set is closed", () => {
    expect(
      resolveSalesTargetIncentiveRateMetadata({
        periodTimezone: "Europe/Istanbul",
        scopedStoreCount: 2,
        closedSnapshots: [{
          store_id: "store-a",
          final_snapshot_id: "snapshot-a",
          rule_version_code: "rule-v1",
          period_timezone: "Europe/Istanbul",
          rate_table_versions: ["manager-v1", "personnel-v1"],
          rate_brackets_json: closedBrackets,
        }],
        exactRateRows: [],
        expectedOpenVersions: null,
      }).status,
    ).toBe("unresolved");
  });

  it("rejects duplicate closed-store snapshots and malformed declared versions", () => {
    const snapshot = {
      store_id: "store-a", final_snapshot_id: "snapshot-a", rule_version_code: "rule-v1",
      period_timezone: "Europe/Istanbul", rate_table_versions: ["manager-v1", "personnel-v1"],
      rate_brackets_json: closedBrackets,
    };
    expect(resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul", scopedStoreCount: 2,
      closedSnapshots: [snapshot, { ...snapshot, final_snapshot_id: "snapshot-b" }],
      exactRateRows: [], expectedOpenVersions: null,
    }).status).toBe("unresolved");
    expect(resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul", scopedStoreCount: 1,
      closedSnapshots: [{ ...snapshot, rate_table_versions: null } as never],
      exactRateRows: [], expectedOpenVersions: null,
    }).status).toBe("unresolved");
  });

  it("resolves open-period rates only when both exact emitted versions are complete", () => {
    const result = resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul",
      scopedStoreCount: 1,
      closedSnapshots: [],
      expectedOpenVersions: {
        ruleVersionCode: "rule-v1",
        manager: "manager-v1",
        personnel: "personnel-v1",
      },
      exactRateRows: openRows,
    });

    expect(result.status).toBe("resolved");
    expect(result.tables).toHaveLength(2);
  });

  it.each([
    {
      name: "declared and embedded versions disagree",
      versions: ["manager-v2", "personnel-v1"],
      brackets: closedBrackets,
    },
    {
      name: "a duplicate audience/version/sort order exists",
      versions: ["manager-v1", "personnel-v1"],
      brackets: [...closedBrackets, closedBrackets[0]],
    },
    {
      name: "a bracket boundary has a gap",
      versions: ["manager-v1", "personnel-v1"],
      brackets: closedBrackets.map((row, index) => index === 1 ? { ...row, min_achievement_pct: "81.0000" } : row),
    },
  ])("rejects a closed snapshot when $name", ({ versions, brackets }) => {
    const result = resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul",
      scopedStoreCount: 1,
      closedSnapshots: [{
        store_id: "store-a",
        final_snapshot_id: "snapshot-a",
        rule_version_code: "rule-v1",
        period_timezone: "Europe/Istanbul",
        rate_table_versions: versions,
        rate_brackets_json: brackets,
      }],
      exactRateRows: [],
      expectedOpenVersions: null,
    });

    expect(result.status).toBe("unresolved");
  });

  it("rejects incomplete open-period bracket coverage", () => {
    const result = resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul",
      scopedStoreCount: 1,
      closedSnapshots: [],
      expectedOpenVersions: { ruleVersionCode: "rule-v1", manager: "manager-v1", personnel: "personnel-v1" },
      exactRateRows: openRows.filter((row) => !(row.audience === "manager" && row.sort_order === 20)),
    });

    expect(result.status).toBe("unresolved");
  });

  it("fails closed when the exact open rate timezone conflicts with the workspace timezone", () => {
    const result = resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul",
      scopedStoreCount: 1,
      closedSnapshots: [],
      expectedOpenVersions: { ruleVersionCode: "rule-v1", manager: "manager-v1", personnel: "personnel-v1" },
      exactRateRows: openRows.map((row) => ({ ...row, period_timezone: "UTC" })),
    });

    expect(result.status).toBe("unresolved");
  });

  it("returns unresolved for missing or mismatched historical metadata", () => {
    const result = resolveSalesTargetIncentiveRateMetadata({
      periodTimezone: "Europe/Istanbul",
      scopedStoreCount: 1,
      closedSnapshots: [],
      expectedOpenVersions: {
        ruleVersionCode: "rule-v1",
        manager: "manager-v1",
        personnel: "personnel-v1",
      },
      exactRateRows: [{
        rule_version_code: "rule-v1", effective_from: "2026-01-01", period_timezone: "Europe/Istanbul", bracket_boundary_policy: "lower_inclusive_upper_exclusive", audience: "manager", rate_table_version: "wrong-manager", min_achievement_pct: null, max_achievement_pct: "80.0000", rate: "0.0000", display_label: "< 80%", sort_order: 10,
      }],
    });

    expect(result).toEqual(expect.objectContaining({
      status: "unresolved",
      ruleVersionCode: null,
      tables: [],
    }));
  });
});
