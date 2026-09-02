import {
  evaluateConnectorReadiness,
  validateConnectorReadinessEvidence,
  type ConnectorReadinessEvidence,
  type NeutralFieldClassification,
} from "./company-daily-kpi-connector-readiness";

const OBSERVATION_DATES = ["2026-08-01", "2026-08-02", "2026-08-03"] as const;

function completeEvidence(): ConnectorReadinessEvidence {
  const operations = ["sales", "footfall", "gsm", "store-directory"] as const;
  const observations = OBSERVATION_DATES.map((observationDate) => ({
    observationDate,
    rowCount: 2,
    responseBytes: 400,
    requestElapsedMs: 100,
    parseElapsedMs: 50,
    totalComponentElapsedMs: 150,
    statusClass: "2xx" as const,
    parseOutcome: "accepted" as const,
  }));

  return {
    schemaVersion: 1,
    dataClass: "sanitized-metadata",
    networkScope: "company-private",
    authCategory: "bearer",
    transport: "https",
    tlsVerification: "verified",
    securityAcceptanceRecorded: false,
    rateLimitKnowledge: "documented",
    operationEvidence: operations.map((operation) => ({
      operation,
      successStatusClass: "2xx" as const,
      contentType: "application/json" as const,
      topLevelShape: "array" as const,
      emptyResultShape: "empty-array" as const,
      failureStatusClasses: ["4xx", "5xx"] as const,
      safeFailureCategories: ["unexpected_status", "transport_failure"] as const,
      observations: observations.map((observation) => ({ ...observation })),
    })),
    neutralFieldClassifications: ([
      ["sales", "sourceDateToken"],
      ["sales", "ephemeralInvoiceId"],
      ["sales", "personnelCode"],
      ["sales", "displayName"],
      ["sales", "storeCode"],
      ["sales", "isReturn"],
      ["sales", "quantity"],
      ["sales", "amountTry"],
      ["footfall", "sourceDateToken"],
      ["footfall", "storeCode"],
      ["footfall", "total"],
      ["gsm", "storeCode"],
      ["gsm", "consent"],
      ["store-directory", "storeCode"],
      ["store-directory", "displayDescription"],
    ] as const).map(([operation, fieldAlias]) => ({
      operation,
      fieldAlias,
      presence: "required" as const,
      acceptedTypes: ["string"] as const,
    }) as NeutralFieldClassification),
    runtimeBudgets: operations.map((operation) => ({
      operation,
      maxRows: 20,
      maxResponseBytes: 2000,
      requestTimeoutMs: 3000,
      parseTimeoutMs: 1000,
      totalComponentTimeoutMs: 5000,
    })),
    ownership: {
      storeMappingOwnerRole: "integration-ops",
      allowlistOwnerRole: "data-ops",
      alertOwnerRole: "incident-ops",
      alertChannelCategory: "incident-system",
    },
    privacyReviewPassed: true,
    evidenceCollectedThrough: "2026-08-03",
    reviewedAt: "2026-08-03",
  };
}

const context = {
  evaluatedAt: "2026-08-04",
  nextRetryBoundaryMs: 60_000,
  approvedOwnerRoleAliases: ["integration-ops", "data-ops", "incident-ops"],
} as const;

describe("company daily KPI connector readiness", () => {
  it("accepts complete sanitized evidence and derives a deterministic implementation-ready summary", () => {
    const evidence = completeEvidence();

    expect(validateConnectorReadinessEvidence(evidence)).toEqual({
      valid: true,
      errors: [],
    });
    expect(evaluateConnectorReadiness(evidence, context)).toEqual({
      state: "ready_for_connector_implementation",
      evidenceCollectedThrough: "2026-08-03",
      reviewedAt: "2026-08-03",
      evaluatedAt: "2026-08-04",
      evidenceAgeDays: 1,
      completedGates: [
        "evidence_structure",
        "operation_completeness",
        "operation_envelope_review",
        "neutral_field_completeness",
        "observation_coverage",
        "runtime_budgets",
        "retry_boundary",
        "transport_security",
        "rate_limit_posture",
        "ownership",
        "privacy_review",
        "evidence_freshness",
        "date_ordering",
      ],
      missingGates: [],
    });
  });

  it("rejects unknown keys, duplicate operations, duplicate dates, and duplicate neutral fields", () => {
    const evidence = completeEvidence() as unknown as Record<string, unknown>;
    evidence.extra = true;
    expect(validateConnectorReadinessEvidence(evidence).valid).toBe(false);

    const duplicateOperation = completeEvidence();
    duplicateOperation.operationEvidence = [
      ...duplicateOperation.operationEvidence,
      { ...duplicateOperation.operationEvidence[0] },
    ];
    expect(validateConnectorReadinessEvidence(duplicateOperation).valid).toBe(false);

    const duplicateDate = completeEvidence();
    duplicateDate.operationEvidence[0].observations = [
      ...duplicateDate.operationEvidence[0].observations,
      { ...duplicateDate.operationEvidence[0].observations[0] },
    ];
    expect(validateConnectorReadinessEvidence(duplicateDate).valid).toBe(false);

    const duplicateField = completeEvidence();
    duplicateField.neutralFieldClassifications = [
      ...duplicateField.neutralFieldClassifications,
      { ...duplicateField.neutralFieldClassifications[0] },
    ];
    expect(validateConnectorReadinessEvidence(duplicateField).valid).toBe(false);
  });

  it("rejects malformed numbers, dates, timings, private values, and contradictory transport", () => {
    const malformedNumber = completeEvidence();
    malformedNumber.operationEvidence[0].observations[0].rowCount = Number.NaN;
    expect(validateConnectorReadinessEvidence(malformedNumber).valid).toBe(false);

    const malformedTiming = completeEvidence();
    malformedTiming.operationEvidence[0].observations[0].totalComponentElapsedMs = 100;
    expect(validateConnectorReadinessEvidence(malformedTiming).valid).toBe(false);

    const malformedDate = completeEvidence();
    malformedDate.reviewedAt = "2026-02-30";
    expect(validateConnectorReadinessEvidence(malformedDate).valid).toBe(false);

    const privateOwner = completeEvidence();
    privateOwner.ownership.alertOwnerRole = "alerts@example.test";
    expect(validateConnectorReadinessEvidence(privateOwner).valid).toBe(false);

    const contradictoryTransport = completeEvidence();
    contradictoryTransport.tlsVerification = "not-applicable";
    expect(validateConnectorReadinessEvidence(contradictoryTransport).valid).toBe(false);
  });

  it("keeps missing, unknown, stale, and unreviewed gates closed", () => {
    const unknownAuth = completeEvidence();
    unknownAuth.authCategory = "unknown";
    unknownAuth.securityAcceptanceRecorded = true;
    const summary = evaluateConnectorReadiness(unknownAuth, context);
    expect(summary.state).toBe("not_ready");
    expect(summary.missingGates).toContain("transport_security");

    const unknownRateLimit = completeEvidence();
    unknownRateLimit.rateLimitKnowledge = "unknown";
    expect(evaluateConnectorReadiness(unknownRateLimit, context).missingGates).toContain(
      "rate_limit_posture",
    );

    const stale = completeEvidence();
    expect(
      evaluateConnectorReadiness(stale, {
        ...context,
        evaluatedAt: "2026-09-04",
      }).missingGates,
    ).toContain("evidence_freshness");

    const unreviewed = completeEvidence();
    unreviewed.privacyReviewPassed = false;
    expect(evaluateConnectorReadiness(unreviewed, context).missingGates).toContain("privacy_review");
  });

  it("requires eligible three-date observations and derives freshness from the slowest required operation", () => {
    const ineligible = completeEvidence();
    ineligible.operationEvidence[0].observations[2].parseOutcome = "rejected";
    expect(evaluateConnectorReadiness(ineligible, context).missingGates).toContain(
      "observation_coverage",
    );

    const mismatchedCollectedThrough = completeEvidence();
    mismatchedCollectedThrough.evidenceCollectedThrough = "2026-08-02";
    expect(validateConnectorReadinessEvidence(mismatchedCollectedThrough).valid).toBe(false);

    const newerDirectory = completeEvidence();
    newerDirectory.operationEvidence[3].observations = [
      ...newerDirectory.operationEvidence[3].observations.slice(0, 2),
      {
        ...newerDirectory.operationEvidence[3].observations[2],
        observationDate: "2026-08-20",
      },
    ];
    newerDirectory.evidenceCollectedThrough = "2026-08-03";
    expect(validateConnectorReadinessEvidence(newerDirectory).valid).toBe(false);
  });

  it("requires an explicit positive retry boundary and never treats missing context as activation", () => {
    const evidence = completeEvidence();

    expect(
      evaluateConnectorReadiness(evidence, {
        evaluatedAt: context.evaluatedAt,
        nextRetryBoundaryMs: 5000,
        approvedOwnerRoleAliases: [...context.approvedOwnerRoleAliases],
      }).state,
    ).toBe("not_ready");
    expect(
      evaluateConnectorReadiness(evidence, {
        evaluatedAt: context.evaluatedAt,
        nextRetryBoundaryMs: Number.NaN,
        approvedOwnerRoleAliases: [...context.approvedOwnerRoleAliases],
      }).missingGates,
    ).toContain("retry_boundary");
    expect(
      evaluateConnectorReadiness(evidence, {
        evaluatedAt: context.evaluatedAt,
        approvedOwnerRoleAliases: [...context.approvedOwnerRoleAliases],
      } as never).state,
    ).toBe("not_ready");
  });

  it("keeps date ordering non-negative and output order stable regardless of evidence array order", () => {
    const evidence = completeEvidence();
    const reversed = {
      ...evidence,
      operationEvidence: [...evidence.operationEvidence].reverse(),
      runtimeBudgets: [...evidence.runtimeBudgets].reverse(),
      neutralFieldClassifications: [...evidence.neutralFieldClassifications].reverse(),
    };
    expect(evaluateConnectorReadiness(reversed, context)).toEqual(
      evaluateConnectorReadiness(evidence, context),
    );

    const beforeReview = evaluateConnectorReadiness(evidence, {
      evaluatedAt: "2026-08-02",
      nextRetryBoundaryMs: context.nextRetryBoundaryMs,
      approvedOwnerRoleAliases: [...context.approvedOwnerRoleAliases],
    });
    expect(beforeReview.state).toBe("not_ready");
    expect(beforeReview.evidenceAgeDays).toBeGreaterThanOrEqual(0);
    expect(beforeReview.missingGates).toContain("date_ordering");
  });

  it("rejects runtime timeout sums that exceed the component budget and equal the retry boundary", () => {
    const overBudget = completeEvidence();
    overBudget.runtimeBudgets[0].parseTimeoutMs = 3000;
    expect(validateConnectorReadinessEvidence(overBudget).valid).toBe(false);

    const equalBoundary = evaluateConnectorReadiness(evidenceForBoundary(), {
      ...context,
      nextRetryBoundaryMs: 5000,
    });
    expect(equalBoundary.state).toBe("not_ready");
    expect(equalBoundary.missingGates).toContain("retry_boundary");

    const overBoundary = evaluateConnectorReadiness(evidenceForBoundary(), {
      ...context,
      nextRetryBoundaryMs: 4999,
    });
    expect(overBoundary.state).toBe("not_ready");
    expect(overBoundary.missingGates).toContain("retry_boundary");
  });

  it("requires an explicit approved owner-role list and rejects sentinel or unapproved roles", () => {
    const unknownRole = completeEvidence();
    unknownRole.ownership.alertOwnerRole = "unknown";
    expect(validateConnectorReadinessEvidence(unknownRole).valid).toBe(false);

    const unapproved = evaluateConnectorReadiness(completeEvidence(), {
      ...context,
      approvedOwnerRoleAliases: ["integration-ops", "data-ops", "other-ops"],
    });
    expect(unapproved.state).toBe("not_ready");
    expect(unapproved.missingGates).toContain("ownership");

    const missingList = evaluateConnectorReadiness(completeEvidence(), {
      evaluatedAt: context.evaluatedAt,
      nextRetryBoundaryMs: context.nextRetryBoundaryMs,
    });
    expect(missingList.state).toBe("not_ready");
    expect(missingList.missingGates).toContain("ownership");
    expect(missingList.missingGates).toContain("retry_boundary");

    const malformedList = evaluateConnectorReadiness(completeEvidence(), {
      ...context,
      approvedOwnerRoleAliases: ["unknown"],
    });
    expect(malformedList.state).toBe("not_ready");
    expect(malformedList.missingGates).toContain("ownership");

    const extraContextKey = evaluateConnectorReadiness(completeEvidence(), {
      ...context,
      unapprovedContextValue: "synthetic-value",
    });
    expect(extraContextKey.state).toBe("not_ready");
    expect(extraContextKey.missingGates).toContain("ownership");
    expect(extraContextKey.missingGates).toContain("retry_boundary");
  });
});

function evidenceForBoundary(): ConnectorReadinessEvidence {
  return completeEvidence();
}
