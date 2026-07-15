import type { SalesTargetIncentiveWorkspaceRateMetadata } from "./sales-target-incentive-workspace.contract";
import type {
  SalesTargetIncentiveWorkspaceClosedRateSnapshotRow,
  SalesTargetIncentiveWorkspaceRateRow,
} from "../infrastructure/sales-target-incentive-workspace-read.repository";

type ExpectedOpenVersions = {
  ruleVersionCode: string;
  manager: string;
  personnel: string;
};

type SnapshotBracket = {
  rate_table_version: string;
  audience: "manager" | "personnel";
  min_achievement_pct: string | null;
  max_achievement_pct: string | null;
  rate: string;
  sort_order: number;
};

export function resolveSalesTargetIncentiveRateMetadata(input: {
  periodTimezone: string;
  scopedStoreCount: number;
  closedSnapshots: SalesTargetIncentiveWorkspaceClosedRateSnapshotRow[];
  exactRateRows: SalesTargetIncentiveWorkspaceRateRow[];
  expectedOpenVersions: ExpectedOpenVersions | null;
}): SalesTargetIncentiveWorkspaceRateMetadata {
  if (input.closedSnapshots.length > 0) {
    return resolveClosedMetadata(input);
  }

  return resolveOpenMetadata(input);
}

function resolveClosedMetadata(input: {
  periodTimezone: string;
  scopedStoreCount: number;
  closedSnapshots: SalesTargetIncentiveWorkspaceClosedRateSnapshotRow[];
}) {
  if (input.closedSnapshots.length !== input.scopedStoreCount) {
    return unresolved(input.periodTimezone);
  }
  if (new Set(input.closedSnapshots.map((snapshot) => snapshot.store_id)).size !== input.scopedStoreCount) {
    return unresolved(input.periodTimezone);
  }

  const normalized = input.closedSnapshots.map(normalizeClosedSnapshot);
  if (normalized.some((snapshot) => snapshot === null)) {
    return unresolved(input.periodTimezone);
  }

  const [first, ...rest] = normalized as Array<NonNullable<(typeof normalized)[number]>>;
  if (
    !first ||
    rest.some((snapshot) => snapshot.canonical !== first.canonical) ||
    first.periodTimezone !== input.periodTimezone
  ) {
    return unresolved(input.periodTimezone);
  }

  return {
    status: "resolved" as const,
    ruleVersionCode: first.ruleVersionCode,
    effectiveFrom: null,
    periodTimezone: first.periodTimezone,
    bracketBoundaryPolicy: "lower_inclusive_upper_exclusive" as const,
    tables: first.tables,
  };
}

function resolveOpenMetadata(input: {
  periodTimezone: string;
  exactRateRows: SalesTargetIncentiveWorkspaceRateRow[];
  expectedOpenVersions: ExpectedOpenVersions | null;
}) {
  const expected = input.expectedOpenVersions;
  if (!expected) return unresolved(input.periodTimezone);

  const matchingRows = input.exactRateRows.filter(
    (row) =>
      row.rule_version_code === expected.ruleVersionCode &&
      ((row.audience === "manager" && row.rate_table_version === expected.manager) ||
        (row.audience === "personnel" && row.rate_table_version === expected.personnel)),
  );
  const tables = toTables(matchingRows);
  const first = matchingRows[0];
  if (
    !tables ||
    !first ||
    first.period_timezone !== input.periodTimezone ||
    matchingRows.some((row) =>
      row.effective_from !== first.effective_from ||
      row.period_timezone !== first.period_timezone ||
      row.bracket_boundary_policy !== first.bracket_boundary_policy
    ) ||
    tables.find((table) => table.audience === "manager")?.version !== expected.manager ||
    tables.find((table) => table.audience === "personnel")?.version !== expected.personnel
  ) {
    return unresolved(input.periodTimezone);
  }

  return {
    status: "resolved" as const,
    ruleVersionCode: expected.ruleVersionCode,
    effectiveFrom: first.effective_from,
    periodTimezone: first.period_timezone,
    bracketBoundaryPolicy: first.bracket_boundary_policy,
    tables,
  };
}

function normalizeClosedSnapshot(row: SalesTargetIncentiveWorkspaceClosedRateSnapshotRow) {
  if (
    !Array.isArray(row.rate_brackets_json) ||
    !Array.isArray(row.rate_table_versions) ||
    row.rate_table_versions.some((version) => typeof version !== "string" || version.length === 0) ||
    typeof row.rule_version_code !== "string" || row.rule_version_code.length === 0 ||
    typeof row.period_timezone !== "string" || row.period_timezone.length === 0
  ) return null;
  const brackets = row.rate_brackets_json
    .map(parseSnapshotBracket)
    .filter((item): item is SnapshotBracket => item !== null)
    .sort(compareBracket);
  if (brackets.length !== row.rate_brackets_json.length) return null;

  const tables = toTables(
    brackets.map((bracket) => ({
      rule_version_code: row.rule_version_code,
      effective_from: "",
      period_timezone: row.period_timezone,
      bracket_boundary_policy: "lower_inclusive_upper_exclusive" as const,
      audience: bracket.audience,
      rate_table_version: bracket.rate_table_version,
      min_achievement_pct: bracket.min_achievement_pct,
      max_achievement_pct: bracket.max_achievement_pct,
      rate: bracket.rate,
      display_label: formatBracketLabel(bracket),
      sort_order: bracket.sort_order,
    })),
  );
  if (!tables) return null;
  const declaredVersions = [...new Set(row.rate_table_versions)].sort();
  const embeddedVersions = [...new Set(tables.map((table) => table.version))].sort();
  if (
    declaredVersions.length !== 2 ||
    JSON.stringify(declaredVersions) !== JSON.stringify(embeddedVersions)
  ) {
    return null;
  }
  const canonical = JSON.stringify({
    ruleVersionCode: row.rule_version_code,
    periodTimezone: row.period_timezone,
    versions: declaredVersions,
    brackets,
  });

  return {
    canonical,
    ruleVersionCode: row.rule_version_code,
    periodTimezone: row.period_timezone,
    tables,
  };
}

function parseSnapshotBracket(value: unknown): SnapshotBracket | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    (row.audience !== "manager" && row.audience !== "personnel") ||
    typeof row.rate_table_version !== "string" || row.rate_table_version.length === 0 ||
    typeof row.rate !== "string" ||
    !isDecimal(row.rate) ||
    !Number.isSafeInteger(row.sort_order) ||
    (row.min_achievement_pct !== null && typeof row.min_achievement_pct !== "string") ||
    (row.max_achievement_pct !== null && typeof row.max_achievement_pct !== "string") ||
    (row.min_achievement_pct !== null && !isDecimal(row.min_achievement_pct)) ||
    (row.max_achievement_pct !== null && !isDecimal(row.max_achievement_pct))
  ) {
    return null;
  }

  return row as SnapshotBracket;
}

function toTables(rows: SalesTargetIncentiveWorkspaceRateRow[]) {
  const tables = (["manager", "personnel"] as const)
    .map((audience) => {
      const audienceRows = rows
        .filter((row) => row.audience === audience)
        .sort((left, right) => left.sort_order - right.sort_order);
      const [first] = audienceRows;
      if (
        !first ||
        audienceRows.some((row) => row.rate_table_version !== first.rate_table_version) ||
        !hasCompleteBoundaryCoverage(audienceRows)
      ) {
        return null;
      }
      return {
        audience,
        version: first.rate_table_version,
        brackets: audienceRows.map((row) => ({
          minAchievementPct: row.min_achievement_pct,
          maxAchievementPct: row.max_achievement_pct,
          rate: row.rate,
          displayLabel: row.display_label,
        })),
      };
    });
  return tables.some((table) => table === null)
    ? null
    : tables as Array<NonNullable<(typeof tables)[number]>>;
}

function hasCompleteBoundaryCoverage(rows: SalesTargetIncentiveWorkspaceRateRow[]) {
  if (rows.length < 2 || rows[0].min_achievement_pct !== null || rows.at(-1)?.max_achievement_pct !== null) {
    return false;
  }
  const keys = new Set<string>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const key = `${row.audience}:${row.rate_table_version}:${row.sort_order}`;
    if (keys.has(key) || !Number.isSafeInteger(row.sort_order) || !isDecimal(row.rate)) return false;
    keys.add(key);
    if (index > 0 && row.sort_order <= rows[index - 1].sort_order) return false;
    if (row.min_achievement_pct !== null && !isDecimal(row.min_achievement_pct)) return false;
    if (row.max_achievement_pct !== null && !isDecimal(row.max_achievement_pct)) return false;
    if (
      row.min_achievement_pct !== null &&
      row.max_achievement_pct !== null &&
      compareDecimals(row.min_achievement_pct, row.max_achievement_pct) >= 0
    ) return false;
    if (index > 0) {
      const previousMax = rows[index - 1].max_achievement_pct;
      const currentMin = row.min_achievement_pct;
      if (previousMax === null || currentMin === null || compareDecimals(previousMax, currentMin) !== 0) {
        return false;
      }
    }
  }
  return true;
}

function isDecimal(value: string) {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}

function compareDecimals(left: string, right: string) {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const leftValue = BigInt(`${leftParts.whole}${leftParts.fraction.padEnd(scale, "0")}`) * leftParts.sign;
  const rightValue = BigInt(`${rightParts.whole}${rightParts.fraction.padEnd(scale, "0")}`) * rightParts.sign;
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function decimalParts(value: string) {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return { sign: negative ? -1n : 1n, whole, fraction };
}

function compareBracket(left: SnapshotBracket, right: SnapshotBracket) {
  return left.audience.localeCompare(right.audience) || left.sort_order - right.sort_order;
}

function formatBracketLabel(bracket: SnapshotBracket) {
  if (bracket.min_achievement_pct === null) return `< ${bracket.max_achievement_pct}%`;
  if (bracket.max_achievement_pct === null) return `>= ${bracket.min_achievement_pct}%`;
  return `>= ${bracket.min_achievement_pct}% and < ${bracket.max_achievement_pct}%`;
}

function unresolved(periodTimezone: string): SalesTargetIncentiveWorkspaceRateMetadata {
  return {
    status: "unresolved",
    ruleVersionCode: null,
    effectiveFrom: null,
    periodTimezone,
    bracketBoundaryPolicy: null,
    tables: [],
  };
}
