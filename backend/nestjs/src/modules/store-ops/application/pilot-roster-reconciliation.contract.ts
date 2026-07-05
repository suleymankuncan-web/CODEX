export const ROSTER_RECONCILIATION_SOURCE_KINDS = [
  "current_roster",
  "dealer_roster",
  "target",
  "sales_kpi",
] as const;

export type RosterReconciliationSourceKind =
  (typeof ROSTER_RECONCILIATION_SOURCE_KINDS)[number];

export type RosterReconciliationMatchStatus =
  | "pending"
  | "matched"
  | "missing_store"
  | "missing_employee"
  | "ambiguous"
  | "ignored"
  | "review_required";

export type RosterEmployeeCodeFamily =
  | "dealer_fm"
  | "company_or_operator"
  | "missing";

export type RosterRoleClassification =
  | "store_manager"
  | "assistant_manager"
  | "cashier"
  | "sales_personnel"
  | "unknown";

export type RosterSpecialStoreClass =
  | "standard"
  | "pop_up"
  | "garage"
  | "tent"
  | "temporary_operation";

export type RawRosterReconciliationInput = {
  sourceFile: string;
  sourceSheet: string;
  sourceKind: RosterReconciliationSourceKind;
  rowNumber: number;
  sourcePeriod?: string;
  rawStoreName?: string;
  rawStoreCode?: string;
  rawEmployeeCode?: string;
  rawEmployeeName?: string;
  rawPositionName?: string;
  targetAmount?: number | null;
  netSalesAmount?: number | null;
  rawPayload?: Record<string, unknown>;
};

export type NormalizedRosterReconciliationRow = RawRosterReconciliationInput & {
  normalizedStoreKey: string;
  normalizedEmployeeKey: string;
  employeeCodeFamily: RosterEmployeeCodeFamily;
  roleClassification: RosterRoleClassification;
  specialStoreClass: RosterSpecialStoreClass;
  matchStatus: RosterReconciliationMatchStatus;
  matchNotes: string[];
};

export type RosterReconciliationSummary = {
  totals: {
    rows: number;
    activeCompanyRoster: number;
    dealerReferenceRows: number;
    targetRows: number;
    salesKpiRows: number;
    cashiers: number;
    storeManagers: number;
    activeAdditions: number;
    monthlyLeavers: number;
    matchedTargets: number;
    unmatchedTargets: number;
    missingStores: number;
    riskyMatches: number;
  };
  sourceBreakdown: Record<RosterReconciliationSourceKind, number>;
  statusBreakdown: Record<RosterReconciliationMatchStatus, number>;
  sections: {
    activeCompanyRoster: NormalizedRosterReconciliationRow[];
    missingStores: NormalizedRosterReconciliationRow[];
    externalMapCandidates: NormalizedRosterReconciliationRow[];
    activeAdditions: NormalizedRosterReconciliationRow[];
    passiveCandidates: NormalizedRosterReconciliationRow[];
    monthlyLeavers: NormalizedRosterReconciliationRow[];
    targetMatches: NormalizedRosterReconciliationRow[];
    unmatchedTargets: NormalizedRosterReconciliationRow[];
    cashiers: NormalizedRosterReconciliationRow[];
    storeManagers: NormalizedRosterReconciliationRow[];
    riskyMatches: NormalizedRosterReconciliationRow[];
  };
};

function compact(value?: string | number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeRosterKey(value?: string | number | null) {
  return compact(value)
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/[^A-Z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function classifyEmployeeCode(value?: string | null): RosterEmployeeCodeFamily {
  const code = compact(value).toLocaleUpperCase("tr-TR");
  if (!code) {
    return "missing";
  }

  if (code.startsWith("FM")) {
    return "dealer_fm";
  }

  if (code.startsWith("DNMSL") || /^\d[\d-]*$/u.test(code)) {
    return "company_or_operator";
  }

  return "company_or_operator";
}

export function classifyRole(value?: string | null): RosterRoleClassification {
  const role = normalizeRosterKey(value);
  if (!role) {
    return "unknown";
  }

  if (role.includes("KASIYER") || role.includes("KASA")) {
    return "cashier";
  }

  if (
    role.includes("MAGAZA MUDUR YARDIMCISI") ||
    role.includes("MUDUR YARDIMCISI") ||
    role.includes("ASSISTANT")
  ) {
    return "assistant_manager";
  }

  if (role.includes("MAGAZA MUDURU") || role === "MUDUR") {
    return "store_manager";
  }

  if (
    role.includes("DANISMAN") ||
    role.includes("MODA") ||
    role.includes("SATIS")
  ) {
    return "sales_personnel";
  }

  return "unknown";
}

export function classifySpecialStore(value?: string | null): RosterSpecialStoreClass {
  const store = normalizeRosterKey(value);
  if (!store) {
    return "standard";
  }

  if (store.includes("POP UP") || store.includes("POPUP")) {
    return "pop_up";
  }

  if (store.includes("GARAJ")) {
    return "garage";
  }

  if (store.includes("CADIR")) {
    return "tent";
  }

  if (store.includes("GECICI") || store.includes("TEMPORARY")) {
    return "temporary_operation";
  }

  return "standard";
}

export function normalizeRosterReconciliationRow(
  input: RawRosterReconciliationInput,
): NormalizedRosterReconciliationRow {
  const normalizedStoreKey = normalizeRosterKey(input.rawStoreName ?? input.rawStoreCode);
  const normalizedEmployeeKey = normalizeRosterKey(
    input.rawEmployeeCode || input.rawEmployeeName,
  );
  const employeeCodeFamily = classifyEmployeeCode(input.rawEmployeeCode);
  const roleClassification = classifyRole(input.rawPositionName);
  const specialStoreClass = classifySpecialStore(input.rawStoreName);
  const matchNotes: string[] = [];
  let matchStatus: RosterReconciliationMatchStatus = "matched";

  if (!normalizedStoreKey) {
    matchStatus = "missing_store";
    matchNotes.push("missing_store");
  }

  if (!normalizedEmployeeKey && input.sourceKind !== "target") {
    matchStatus = "missing_employee";
    matchNotes.push("missing_employee");
  }

  if (specialStoreClass !== "standard") {
    matchStatus = "review_required";
    matchNotes.push(`temporary_store:${specialStoreClass}`);
  }

  if (input.sourceKind === "dealer_roster" && employeeCodeFamily !== "dealer_fm") {
    matchStatus = "review_required";
    matchNotes.push("dealer_file_non_fm_code");
  }

  if (
    input.sourceKind === "current_roster" &&
    employeeCodeFamily === "dealer_fm"
  ) {
    matchStatus = "review_required";
    matchNotes.push("company_roster_fm_code");
  }

  return {
    ...input,
    rawStoreName: compact(input.rawStoreName) || undefined,
    rawStoreCode: compact(input.rawStoreCode) || undefined,
    rawEmployeeCode: compact(input.rawEmployeeCode) || undefined,
    rawEmployeeName: compact(input.rawEmployeeName) || undefined,
    rawPositionName: compact(input.rawPositionName) || undefined,
    normalizedStoreKey,
    normalizedEmployeeKey,
    employeeCodeFamily,
    roleClassification,
    specialStoreClass,
    matchStatus,
    matchNotes,
  };
}

function increment<T extends string>(record: Record<T, number>, key: T) {
  record[key] = (record[key] ?? 0) + 1;
}

function firstRows(rows: NormalizedRosterReconciliationRow[], limit = 25) {
  return rows.slice(0, limit);
}

function employeeLookupKeys(row: RawRosterReconciliationInput) {
  return [
    normalizeRosterKey(row.rawEmployeeCode),
    normalizeRosterKey(row.rawEmployeeName),
  ].filter(Boolean);
}

export function buildRosterReconciliationDryRun(
  inputs: RawRosterReconciliationInput[],
): RosterReconciliationSummary {
  const rows = inputs.map(normalizeRosterReconciliationRow);
  const activeKeys = new Set(
    rows
      .filter((row) => row.sourceKind === "current_roster")
      .flatMap(employeeLookupKeys),
  );
  const activeStoreKeys = new Set(
    rows
      .filter((row) => row.sourceKind === "current_roster")
      .map((row) => row.normalizedStoreKey)
      .filter(Boolean),
  );

  const sourceBreakdown = Object.fromEntries(
    ROSTER_RECONCILIATION_SOURCE_KINDS.map((kind) => [kind, 0]),
  ) as Record<RosterReconciliationSourceKind, number>;
  const statusBreakdown: Record<RosterReconciliationMatchStatus, number> = {
    pending: 0,
    matched: 0,
    missing_store: 0,
    missing_employee: 0,
    ambiguous: 0,
    ignored: 0,
    review_required: 0,
  };

  for (const row of rows) {
    increment(sourceBreakdown, row.sourceKind);
    increment(statusBreakdown, row.matchStatus);
  }

  const targetRows = rows.filter((row) => row.sourceKind === "target");
  const historicalRows = rows.filter((row) =>
    row.sourceKind === "target" || row.sourceKind === "sales_kpi",
  );
  const monthlyLeavers = historicalRows.filter(
    (row) =>
      employeeLookupKeys(row).length > 0 &&
      employeeLookupKeys(row).every((lookupKey) => !activeKeys.has(lookupKey)),
  );
  const unmatchedTargets = targetRows.filter((row) => {
    if (!row.normalizedEmployeeKey) {
      return true;
    }

    if (employeeLookupKeys(row).some((lookupKey) => activeKeys.has(lookupKey))) {
      return false;
    }

    return !row.rawEmployeeCode;
  });
  const missingStores = rows.filter(
    (row) =>
      row.sourceKind !== "dealer_roster" &&
      (row.matchStatus === "missing_store" ||
        (row.normalizedStoreKey && !activeStoreKeys.has(row.normalizedStoreKey))),
  );
  const riskyMatches = rows.filter(
    (row) =>
      row.matchStatus === "review_required" ||
      row.specialStoreClass !== "standard" ||
      (row.sourceKind === "target" && !row.rawEmployeeCode),
  );

  const sections = {
    activeCompanyRoster: firstRows(rows.filter((row) => row.sourceKind === "current_roster")),
    missingStores: firstRows(missingStores),
    externalMapCandidates: firstRows(
      rows.filter(
        (row) =>
          row.sourceKind !== "dealer_roster" &&
          row.normalizedStoreKey &&
          !activeStoreKeys.has(row.normalizedStoreKey) &&
          row.sourceKind !== "current_roster",
      ),
    ),
    activeAdditions: firstRows(rows.filter((row) => row.sourceKind === "current_roster")),
    passiveCandidates: firstRows([]),
    monthlyLeavers: firstRows(monthlyLeavers),
    targetMatches: firstRows(
      targetRows.filter((row) =>
        employeeLookupKeys(row).some((lookupKey) => activeKeys.has(lookupKey)),
      ),
    ),
    unmatchedTargets: firstRows(unmatchedTargets),
    cashiers: firstRows(rows.filter((row) => row.roleClassification === "cashier")),
    storeManagers: firstRows(rows.filter((row) => row.roleClassification === "store_manager")),
    riskyMatches: firstRows(riskyMatches),
  };

  return {
    totals: {
      rows: rows.length,
      activeCompanyRoster: sourceBreakdown.current_roster,
      dealerReferenceRows: sourceBreakdown.dealer_roster,
      targetRows: sourceBreakdown.target,
      salesKpiRows: sourceBreakdown.sales_kpi,
      cashiers: rows.filter((row) => row.roleClassification === "cashier").length,
      storeManagers: rows.filter((row) => row.roleClassification === "store_manager").length,
      activeAdditions: sourceBreakdown.current_roster,
      monthlyLeavers: monthlyLeavers.length,
      matchedTargets: targetRows.length - unmatchedTargets.length,
      unmatchedTargets: unmatchedTargets.length,
      missingStores: missingStores.length,
      riskyMatches: riskyMatches.length,
    },
    sourceBreakdown,
    statusBreakdown,
    sections,
  };
}
