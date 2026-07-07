import { createHash } from "node:crypto";

import { Pool } from "pg";

import {
  normalizeRosterKey,
  type RosterRoleClassification,
} from "../src/modules/store-ops/application/pilot-roster-reconciliation.contract";
import { PilotRosterReconciliationService } from "../src/modules/store-ops/application/pilot-roster-reconciliation.service";
import {
  PilotRosterReconciliationRepository,
  type ResolvedPilotRosterActiveAssignment,
  type ResolvedPilotRosterInactiveAssignment,
  type ResolvedPilotRosterKpiActual,
  type ResolvedPilotRosterTargetReference,
  type ResolvedPilotRosterTurnoverEvent,
} from "../src/modules/store-ops/infrastructure/pilot-roster-reconciliation.repository";
import { DatabaseService } from "../src/shared/database/database.service";
import {
  parseRosterReconciliationArgs,
  parseRosterReconciliationInputFile,
} from "./pilot-roster-reconciliation-dry-run";

type StoreLookupRow = {
  store_id: string;
  company_id: string;
  region_id: string;
  store_code: string | null;
  store_name: string;
};

type EmployeeLookupRow = {
  employee_id: string;
  company_id: string;
  external_employee_ref: string | null;
  full_name: string;
};

type PositionLookupRow = {
  position_id: string;
  company_id: string;
  position_code: string;
  position_name: string;
};

type ActiveCompanyAssignmentLookupRow = {
  company_id: string;
  employee_id: string;
  store_id: string;
  position_id: string;
};

type ReferenceData = {
  storesByKey: Map<string, StoreLookupRow>;
  storesByTightKey: Map<string, StoreLookupRow[]>;
  stores: StoreLookupRow[];
  employeesByCompanyAndKey: Map<string, EmployeeLookupRow>;
  positionsByCompanyAndCode: Map<string, PositionLookupRow>;
  activeCompanyAssignments: ActiveCompanyAssignmentLookupRow[];
};

type ResolveIssue = {
  kind: string;
  key: string;
  reason: string;
  candidates?: string[];
};

type ResolvedPlan = {
  activeAssignments: ResolvedPilotRosterActiveAssignment[];
  inactiveAssignments: ResolvedPilotRosterInactiveAssignment[];
  targetReferences: ResolvedPilotRosterTargetReference[];
  turnoverEvents: ResolvedPilotRosterTurnoverEvent[];
  kpiActuals: ResolvedPilotRosterKpiActual[];
  issues: ResolveIssue[];
};

function readOption(args: string[], index: number) {
  const current = args[index] ?? "";
  const equalIndex = current.indexOf("=");
  if (equalIndex !== -1) {
    return {
      value: current.slice(equalIndex + 1),
      nextIndex: index,
    };
  }

  return {
    value: args[index + 1] ?? "",
    nextIndex: index + 1,
  };
}

function parseApplyArgs(args: string[]) {
  const forwardedArgs: string[] = [];
  let shouldApply = false;
  let actorUserId = process.env.PILOT_ROSTER_ACTOR_USER_ID ?? "pilot-roster-reconciliation";
  let approvalToken = process.env.PILOT_ROSTER_APPROVAL_TOKEN;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const name = current.split("=")[0];

    if (name === "--apply") {
      shouldApply = true;
      continue;
    }

    if (name === "--dry-run") {
      shouldApply = false;
      continue;
    }

    if (name === "--actor-user-id") {
      const option = readOption(args, index);
      actorUserId = option.value;
      index = option.nextIndex;
      continue;
    }

    if (name === "--approval-token") {
      const option = readOption(args, index);
      approvalToken = option.value;
      index = option.nextIndex;
      continue;
    }

    forwardedArgs.push(current);
  }

  return {
    ...parseRosterReconciliationArgs(forwardedArgs),
    actorUserId,
    approvalToken,
    shouldApply,
  };
}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required for pilot roster apply resolution.");
  }
  return value;
}

function periodStart(period: string) {
  return `${period}-01`;
}

function periodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function sourceHash(input: ResolvedPilotRosterKpiActual) {
  return createHash("sha256")
    .update(
      [
        input.sourceBatchId,
        input.scopeType,
        input.storeId,
        input.employeeId ?? "",
        input.kpiCode,
        input.periodStart,
        input.actualValue,
      ].join("|"),
    )
    .digest("hex");
}

function mapPositionCode(role: RosterRoleClassification) {
  switch (role) {
    case "store_manager":
      return "STORE_MANAGER";
    case "assistant_manager":
      return "ASSISTANT_MANAGER";
    case "cashier":
      return "CASHIER";
    case "sales_personnel":
      return "SALES_ASSOCIATE";
    default:
      return null;
  }
}

function companyEmployeeKey(companyId: string, value: string | null | undefined) {
  return `${companyId}:${normalizeRosterKey(value)}`;
}

function assignmentKey(input: {
  employeeId: string;
  storeId: string;
  positionId: string;
}) {
  return `${input.employeeId}:${input.storeId}:${input.positionId}`;
}

function tightRosterKey(value: string | null | undefined) {
  return normalizeRosterKey(value).replace(/\s+/g, "");
}

const STORE_MATCH_STOPWORDS = new Set(["AVM", "OUTLET", "MAGAZA", "MAGAZASI"]);

const PILOT_STORE_CODE_ALIASES = new Map([
  ["SM135", "SAKARYA AGORA AVM"],
  ["SM139", "IZMIR AGORA AVM"],
]);

function storeMatchTokens(value: string) {
  return normalizeRosterKey(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STORE_MATCH_STOPWORDS.has(token));
}

function resolveStore(
  references: ReferenceData,
  normalizedStoreKey: string,
  rawStoreCode?: string | null,
): { store: StoreLookupRow | null; reason?: string; candidates?: string[] } {
  const aliasKey = PILOT_STORE_CODE_ALIASES.get(normalizeRosterKey(rawStoreCode));
  const aliasStore = aliasKey ? references.storesByKey.get(aliasKey) : null;
  if (aliasStore) {
    return { store: aliasStore };
  }

  const direct =
    references.storesByKey.get(normalizedStoreKey) ??
    references.storesByKey.get(normalizeRosterKey(rawStoreCode));
  if (direct) {
    return { store: direct };
  }

  const tightCandidates = references.storesByTightKey.get(tightRosterKey(normalizedStoreKey)) ?? [];
  if (tightCandidates.length === 1) {
    return { store: tightCandidates[0] };
  }
  if (tightCandidates.length > 1) {
    return {
      store: null,
      reason: "store_ambiguous",
      candidates: tightCandidates.map((store) => store.store_name),
    };
  }

  const tokens = storeMatchTokens(normalizedStoreKey);
  if (tokens.length === 0) {
    return { store: null, reason: "store_not_found" };
  }

  const fuzzyCandidates = references.stores.filter((store) => {
    const normalizedName = normalizeRosterKey(store.store_name);
    return tokens.every((token) => normalizedName.includes(token));
  });
  if (fuzzyCandidates.length === 1) {
    return { store: fuzzyCandidates[0] };
  }
  if (fuzzyCandidates.length > 1) {
    return {
      store: null,
      reason: "store_ambiguous",
      candidates: fuzzyCandidates.map((store) => store.store_name),
    };
  }

  return { store: null, reason: "store_not_found" };
}

function splitName(rawName: string) {
  const parts = rawName.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "Pilot", lastName: "Personel" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "-" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "-",
  };
}

async function loadReferenceData(databaseService: DatabaseService): Promise<ReferenceData> {
  const [stores, employees, positions, activeCompanyAssignments] = await Promise.all([
    databaseService.query<StoreLookupRow>(
      `
        SELECT store_id, company_id, region_id, store_code, store_name
        FROM ops.store
        WHERE COALESCE(status, 'active') <> 'inactive'
      `,
    ),
    databaseService.query<EmployeeLookupRow>(
      `
        SELECT
          employee_id,
          company_id,
          external_employee_ref,
          CONCAT_WS(' ', first_name, last_name) AS full_name
        FROM ops.employee
      `,
    ),
    databaseService.query<PositionLookupRow>(
      `
        SELECT position_id, company_id, position_code, position_name
        FROM ops.position
      `,
    ),
    databaseService.query<ActiveCompanyAssignmentLookupRow>(
      `
        SELECT
          s.company_id,
          eah.employee_id,
          eah.store_id,
          eah.position_id
        FROM ops.employee_assignment_history eah
        JOIN ops.store s ON s.store_id = eah.store_id
        WHERE eah.assignment_status = 'active'
          AND eah.end_date IS NULL
          AND s.store_type = 'company'
          AND COALESCE(s.status, 'active') = 'active'
      `,
    ),
  ]);

  const storesByKey = new Map<string, StoreLookupRow>();
  const storesByTightKey = new Map<string, StoreLookupRow[]>();
  stores.rows.forEach((store) => {
    [store.store_code, store.store_name].forEach((value) => {
      const key = normalizeRosterKey(value);
      if (key && !storesByKey.has(key)) {
        storesByKey.set(key, store);
      }
      const tightKey = tightRosterKey(value);
      if (tightKey) {
        storesByTightKey.set(tightKey, [...(storesByTightKey.get(tightKey) ?? []), store]);
      }
    });
  });

  const employeesByCompanyAndKey = new Map<string, EmployeeLookupRow>();
  employees.rows.forEach((employee) => {
    [employee.external_employee_ref, employee.full_name].forEach((value) => {
      const key = companyEmployeeKey(employee.company_id, value);
      if (!key.endsWith(":") && !employeesByCompanyAndKey.has(key)) {
        employeesByCompanyAndKey.set(key, employee);
      }
    });
  });

  const positionsByCompanyAndCode = new Map<string, PositionLookupRow>();
  positions.rows.forEach((position) => {
    positionsByCompanyAndCode.set(
      `${position.company_id}:${normalizeRosterKey(position.position_code)}`,
      position,
    );
  });

  return {
    storesByKey,
    storesByTightKey,
    stores: stores.rows,
    employeesByCompanyAndKey,
    positionsByCompanyAndCode,
    activeCompanyAssignments: activeCompanyAssignments.rows,
  };
}

async function ensureEmployee(input: {
  databaseService: DatabaseService;
  references: ReferenceData;
  companyId: string;
  normalizedEmployeeKey: string;
  rawEmployeeCode: string | null | undefined;
  rawEmployeeName: string;
  employmentStatus: "active" | "inactive";
  allowCreate: boolean;
}) {
  const externalRef = input.rawEmployeeCode || input.normalizedEmployeeKey;
  const existing =
    input.references.employeesByCompanyAndKey.get(
      companyEmployeeKey(input.companyId, externalRef),
    ) ??
    input.references.employeesByCompanyAndKey.get(
      companyEmployeeKey(input.companyId, input.rawEmployeeName),
    );
  if (existing) {
    return existing.employee_id;
  }

  if (!input.allowCreate) {
    return null;
  }

  const { firstName, lastName } = splitName(input.rawEmployeeName);
  const result = await input.databaseService.query<{ employee_id: string }>(
    `
      INSERT INTO ops.employee (
        employee_id,
        company_id,
        external_employee_ref,
        first_name,
        last_name,
        hire_date,
        employment_status,
        employment_type
      )
      VALUES (
        gen_random_uuid(),
        $1::uuid,
        $2,
        $3,
        $4,
        '2026-01-01'::date,
        $5,
        'full_time'
      )
      RETURNING employee_id
    `,
    [input.companyId, externalRef, firstName, lastName, input.employmentStatus],
  );
  const employeeId = result.rows[0]?.employee_id;
  if (!employeeId) {
    throw new Error(`Employee could not be created for ${input.rawEmployeeName}`);
  }

  const row: EmployeeLookupRow = {
    employee_id: employeeId,
    company_id: input.companyId,
    external_employee_ref: externalRef,
    full_name: `${firstName} ${lastName}`.trim(),
  };
  input.references.employeesByCompanyAndKey.set(
    companyEmployeeKey(input.companyId, externalRef),
    row,
  );
  input.references.employeesByCompanyAndKey.set(
    companyEmployeeKey(input.companyId, row.full_name),
    row,
  );
  return employeeId;
}

async function resolvePlan(input: {
  databaseService: DatabaseService;
  references: ReferenceData;
  plan: ReturnType<PilotRosterReconciliationService["buildApplyPlan"]>;
  allowCreateEmployees: boolean;
}): Promise<ResolvedPlan> {
  const issues: ResolveIssue[] = [];
  const activeAssignments: ResolvedPilotRosterActiveAssignment[] = [];
  const inactiveAssignments: ResolvedPilotRosterInactiveAssignment[] = [];
  const targetReferences: ResolvedPilotRosterTargetReference[] = [];
  const turnoverEvents: ResolvedPilotRosterTurnoverEvent[] = [];
  const kpiActuals: ResolvedPilotRosterKpiActual[] = [];
  const employeeByRosterKey = new Map<string, string>();

  for (const candidate of input.plan.activeAssignments) {
    const storeResolution = resolveStore(
      input.references,
      candidate.normalizedStoreKey,
      candidate.rawStoreCode,
    );
    const store = storeResolution.store;
    if (!store) {
      issues.push({
        kind: "active_assignment",
        key: candidate.normalizedStoreKey,
        reason: storeResolution.reason ?? "store_not_found",
        candidates: storeResolution.candidates,
      });
      continue;
    }

    const positionCode = mapPositionCode(candidate.roleClassification);
    const position = positionCode
      ? input.references.positionsByCompanyAndCode.get(
          `${store.company_id}:${normalizeRosterKey(positionCode)}`,
        )
      : null;
    if (!position) {
      issues.push({
        kind: "active_assignment",
        key: `${candidate.normalizedEmployeeKey}:${candidate.roleClassification}`,
        reason: "position_not_found",
      });
      continue;
    }

    const employeeId = await ensureEmployee({
      databaseService: input.databaseService,
      references: input.references,
      companyId: store.company_id,
      normalizedEmployeeKey: candidate.normalizedEmployeeKey,
      rawEmployeeCode: candidate.rawEmployeeCode,
      rawEmployeeName: candidate.rawEmployeeName,
      employmentStatus: "active",
      allowCreate: input.allowCreateEmployees,
    });
    if (!employeeId) {
      issues.push({
        kind: "active_assignment",
        key: candidate.normalizedEmployeeKey,
        reason: "employee_not_found",
      });
      continue;
    }
    employeeByRosterKey.set(candidate.normalizedEmployeeKey, employeeId);

    activeAssignments.push({
      companyId: store.company_id,
      regionId: store.region_id,
      storeId: store.store_id,
      employeeId,
      positionId: position.position_id,
      startDate: "2026-06-01",
    });
  }

  const rosterStoreIds = new Set(activeAssignments.map((assignment) => assignment.storeId));
  const currentAssignmentKeys = new Set(activeAssignments.map(assignmentKey));
  for (const assignment of input.references.activeCompanyAssignments) {
    if (!rosterStoreIds.has(assignment.store_id)) {
      continue;
    }

    const key = assignmentKey({
      employeeId: assignment.employee_id,
      storeId: assignment.store_id,
      positionId: assignment.position_id,
    });
    if (currentAssignmentKeys.has(key)) {
      continue;
    }

    inactiveAssignments.push({
      companyId: assignment.company_id,
      employeeId: assignment.employee_id,
      storeId: assignment.store_id,
      positionId: assignment.position_id,
      endDate: "2026-05-31",
    });
  }

  const resolveStoreEmployee = async (inputRow: {
    kind: string;
    normalizedStoreKey: string;
    normalizedEmployeeKey: string | null;
    rawEmployeeName: string | null;
    sourcePeriod?: string;
    createInactive?: boolean;
  }) => {
    const storeResolution = resolveStore(input.references, inputRow.normalizedStoreKey);
    const store = storeResolution.store;
    if (!store) {
      issues.push({
        kind: inputRow.kind,
        key: inputRow.normalizedStoreKey,
        reason: storeResolution.reason ?? "store_not_found",
        candidates: storeResolution.candidates,
      });
      return null;
    }

    if (!inputRow.normalizedEmployeeKey) {
      return { store, employeeId: null };
    }

    const existingEmployeeId =
      employeeByRosterKey.get(inputRow.normalizedEmployeeKey) ??
      input.references.employeesByCompanyAndKey.get(
        companyEmployeeKey(store.company_id, inputRow.normalizedEmployeeKey),
      )?.employee_id ??
      input.references.employeesByCompanyAndKey.get(
        companyEmployeeKey(store.company_id, inputRow.rawEmployeeName),
      )?.employee_id;
    if (existingEmployeeId) {
      return { store, employeeId: existingEmployeeId };
    }

    if (inputRow.createInactive && inputRow.rawEmployeeName) {
      const employeeId = await ensureEmployee({
        databaseService: input.databaseService,
        references: input.references,
        companyId: store.company_id,
        normalizedEmployeeKey: inputRow.normalizedEmployeeKey,
        rawEmployeeCode: inputRow.normalizedEmployeeKey,
        rawEmployeeName: inputRow.rawEmployeeName,
        employmentStatus: "inactive",
        allowCreate: input.allowCreateEmployees,
      });
      if (!employeeId) {
        issues.push({
          kind: inputRow.kind,
          key: `${inputRow.normalizedStoreKey}:${inputRow.normalizedEmployeeKey}`,
          reason: "employee_not_found",
        });
        return null;
      }
      return { store, employeeId };
    }

    issues.push({
      kind: inputRow.kind,
      key: `${inputRow.normalizedStoreKey}:${inputRow.normalizedEmployeeKey}`,
      reason: "employee_not_found",
    });
    return null;
  };

  for (const target of input.plan.targetReferences) {
    const resolved = await resolveStoreEmployee({
      kind: "target_reference",
      normalizedStoreKey: target.normalizedStoreKey,
      normalizedEmployeeKey: target.normalizedEmployeeKey,
      rawEmployeeName: target.rawEmployeeName,
    });
    if (!resolved?.employeeId) {
      continue;
    }
    targetReferences.push({
      companyId: resolved.store.company_id,
      regionId: resolved.store.region_id,
      storeId: resolved.store.store_id,
      employeeId: resolved.employeeId,
      periodStart: periodStart(target.sourcePeriod),
      targetValue: target.targetAmount,
    });
  }

  for (const actual of input.plan.kpiActuals) {
    const resolved = await resolveStoreEmployee({
      kind: "kpi_actual",
      normalizedStoreKey: actual.normalizedStoreKey,
      normalizedEmployeeKey: actual.normalizedEmployeeKey,
      rawEmployeeName: actual.rawEmployeeName,
    });
    if (!resolved) {
      continue;
    }
    if (actual.scopeType === "employee" && !resolved.employeeId) {
      continue;
    }
    const row: ResolvedPilotRosterKpiActual = {
      companyId: resolved.store.company_id,
      regionId: resolved.store.region_id,
      storeId: resolved.store.store_id,
      employeeId: resolved.employeeId,
      periodStart: periodStart(actual.sourcePeriod),
      scopeType: actual.scopeType,
      kpiCode: actual.kpiCode,
      actualValue: actual.actualValue,
      sourceBatchId: actual.sourceBatchId,
    };
    kpiActuals.push({ ...row, sourcePayloadHash: sourceHash(row) });
  }

  for (const event of input.plan.turnoverEvents) {
    const resolved = await resolveStoreEmployee({
      kind: "turnover_event",
      normalizedStoreKey: event.normalizedStoreKey,
      normalizedEmployeeKey: event.normalizedEmployeeKey,
      rawEmployeeName: event.rawEmployeeName,
      createInactive: true,
    });
    if (!resolved?.employeeId) {
      continue;
    }
    turnoverEvents.push({
      companyId: resolved.store.company_id,
      regionId: resolved.store.region_id,
      storeId: resolved.store.store_id,
      employeeId: resolved.employeeId,
      eventDate: periodEnd(event.sourcePeriod),
    });
  }

  return { activeAssignments, inactiveAssignments, targetReferences, turnoverEvents, kpiActuals, issues };
}

async function main() {
  const args = parseApplyArgs(process.argv.slice(2));
  const rows = args.inputs.flatMap(parseRosterReconciliationInputFile);
  const service = new PilotRosterReconciliationService();
  const plan = service.buildApplyPlan({ rows });
  if (args.shouldApply) {
    service.assertPlanCanApply({ plan, approvalToken: args.approvalToken });
  }

  const pool = new Pool({
    connectionString: databaseUrl(),
    ssl: process.env.DB_SSL_MODE === "require" ? { rejectUnauthorized: false } : false,
  });
  const databaseService = new DatabaseService(pool);

  try {
    const references = await loadReferenceData(databaseService);
    const preflight = await resolvePlan({
      databaseService,
      references,
      plan,
      allowCreateEmployees: false,
    });
    const blockingPreflightIssues = preflight.issues.filter(
      (issue) => issue.reason !== "employee_not_found",
    );
    const resolved =
      args.shouldApply && blockingPreflightIssues.length === 0
        ? await resolvePlan({
            databaseService,
            references,
            plan,
            allowCreateEmployees: true,
          })
        : preflight;
    const summary = {
      mode: args.shouldApply ? "apply" : "dry-run",
      inputRows: plan.totals.inputRows,
      planTotals: plan.totals,
      reviewItems: plan.reviewItems.length,
      approvalRequiredReasons: plan.approvalRequiredReasons,
      preflight: {
        blockingIssues: blockingPreflightIssues.length,
        blockingIssueSamples: blockingPreflightIssues.slice(0, 20),
        wouldCreateEmployees: preflight.issues.filter(
          (issue) => issue.reason === "employee_not_found",
        ).length,
      },
      resolved: {
        activeAssignments: resolved.activeAssignments.length,
        inactiveAssignments: resolved.inactiveAssignments.length,
        targetReferences: resolved.targetReferences.length,
        turnoverEvents: resolved.turnoverEvents.length,
        kpiActuals: resolved.kpiActuals.length,
        issues: resolved.issues.length,
      },
      issueSamples: resolved.issues.slice(0, 20),
    };

    if (!args.shouldApply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if (blockingPreflightIssues.length > 0) {
      throw new Error(
        `Resolved apply has ${blockingPreflightIssues.length} blocking preflight issues.`,
      );
    }

    if (resolved.issues.length > 0) {
      throw new Error(`Resolved apply has ${resolved.issues.length} unresolved rows.`);
    }

    const repository = new PilotRosterReconciliationRepository(databaseService);
    const result = await repository.applyResolvedPlan({
      actorUserId: args.actorUserId,
      activeAssignments: resolved.activeAssignments,
      inactiveAssignments: resolved.inactiveAssignments,
      targetReferences: resolved.targetReferences,
      turnoverEvents: resolved.turnoverEvents,
      kpiActuals: resolved.kpiActuals,
      snapshotPeriodsToRefresh: plan.snapshotPeriodsToRefresh,
    });

    console.log(JSON.stringify({ ...summary, applyResult: result }, null, 2));
  } finally {
    await databaseService.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
