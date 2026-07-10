export type TargetClass = "disposable" | "staging";

export type CheckRow = {
  check_id: string;
  category: string;
  violation_count: number | string;
  sample_refs: unknown;
};

type CandidateKeyState = {
  regionCompositeUniquePresent: boolean;
  storeCompositeUniquePresent: boolean;
};

type ClassificationContext = {
  candidateKeys: CandidateKeyState;
  targetClass: TargetClass;
};

type ExpectedStagingIdentity = {
  database?: string;
  host?: string;
};

const safeSampleReference = /^[a-f0-9]{12}$/;

export function mapCheckResult(row: CheckRow, context: ClassificationContext) {
  const violationCount = Number(row.violation_count);
  if (!Number.isSafeInteger(violationCount) || violationCount < 0) {
    throw new Error("invalid_violation_count");
  }

  const sampleRefs = readSafeSampleReferences(row.sample_refs);
  const candidate = classifyCandidate(row.check_id, violationCount, context);

  return {
    category: row.category,
    checkId: row.check_id,
    classification: candidate.classification,
    reason: candidate.reason,
    sampleRefs,
    violationCount,
  };
}

export function classifyCandidate(
  checkId: string,
  violationCount: number,
  context: ClassificationContext,
) {
  if (violationCount > 0) {
    return {
      classification: "requires_data_correction",
      reason: checkId === "ASSIGN-01"
        ? "violations_present_and_temporal_semantics_unapproved"
        : "violations_present_no_automatic_repair",
    } as const;
  }
  if (["ASSIGN-01", "TARGET-02", "TARGET-03"].includes(checkId)) {
    return {
      classification: "requires_business_decision",
      reason: checkId === "ASSIGN-01"
        ? "primary_assignment_temporal_semantics_unapproved"
        : "target_duplicate_state_enforcement_unapproved",
    } as const;
  }
  if (checkId === "KEY-01") {
    if (
      context.candidateKeys.regionCompositeUniquePresent &&
      context.candidateKeys.storeCompositeUniquePresent
    ) {
      return {
        classification: "redundant_existing",
        reason: "candidate_parent_composite_keys_already_present",
      } as const;
    }
    return {
      classification: "deferred_lock_or_performance",
      reason: "candidate_parent_key_validation_cost_not_measured",
    } as const;
  }
  if (context.targetClass === "disposable") {
    return {
      classification: "blocked_live_evidence",
      reason: "disposable_zero_count_is_not_live_evidence",
    } as const;
  }
  return {
    classification: "safe_to_enforce",
    reason: "approved_staging_target_reports_zero_violations",
  } as const;
}

export function resolveDecision(targetClass: TargetClass, violationCount: number) {
  if (violationCount > 0) return "blocked_violations";
  return targetClass === "disposable" ? "clean_local" : "blocked_business_decision";
}

export function classifySafeError(error: unknown) {
  if (
    error instanceof Error &&
    [
      "approval_missing",
      "database_url_missing",
      "invalid_target_class",
      "invalid_database_protocol",
      "invalid_database_url",
      "invalid_violation_count",
      "non_disposable_target_refused",
      "production_refused",
      "production_target_refused",
      "read_only_not_enforced",
      "staging_approval_missing",
      "staging_target_identity_mismatch",
      "staging_target_identity_missing",
      "too_many_sample_refs",
      "unsafe_sample_ref",
    ].includes(error.message)
  ) {
    return error.message;
  }
  return "database_preflight_failed";
}

export function assertConnectionBoundary(
  targetClass: TargetClass,
  connectionString: string,
  expectedStaging: ExpectedStagingIdentity,
) {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("invalid_database_url");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("invalid_database_protocol");
  }

  let database: string;
  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("invalid_database_url");
  }
  if (!parsed.hostname || !database || database.includes("/")) {
    throw new Error("invalid_database_url");
  }

  const host = parsed.hostname.toLowerCase();
  if (targetClass === "disposable") {
    if (
      !["localhost", "127.0.0.1"].includes(host) ||
      !/^store_ops_fresh_migration_smoke_preflight(?:_[a-z0-9_]+)?$/.test(database)
    ) {
      throw new Error("non_disposable_target_refused");
    }
    return;
  }

  const expectedHost = expectedStaging.host?.trim().toLowerCase();
  const expectedDatabase = expectedStaging.database?.trim();
  if (!expectedHost || !expectedDatabase) {
    throw new Error("staging_target_identity_missing");
  }
  if (host !== expectedHost || database !== expectedDatabase) {
    throw new Error("staging_target_identity_mismatch");
  }
  if (isProductionMarker(host) || isProductionMarker(database)) {
    throw new Error("production_target_refused");
  }
}

function isProductionMarker(value: string) {
  return /(^|[._-])(prod|production)([._-]|$)/i.test(value);
}

function readSafeSampleReferences(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > 5) throw new Error("too_many_sample_refs");
  if (value.some((item) => typeof item !== "string" || !safeSampleReference.test(item))) {
    throw new Error("unsafe_sample_ref");
  }
  return value as string[];
}
