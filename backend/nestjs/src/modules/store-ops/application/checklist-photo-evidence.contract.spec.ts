import {
  aiIsolationClasses,
  assertChecklistPhotoEvidenceControlState,
  assertOperationalCampaignOutcomeSink,
  assertStoreActionSolutionReviewContract,
  assertStoreActionSolutionSubmissionContract,
  assertExperimentalVisualOutputSink,
  campaignDeadlineStatuses,
  campaignReviewStatuses,
  classifyVisualCampaignSubmissionTiming,
  checklistEvidencePolicies,
  checklistPhotoEvidenceAuditEventTypes,
  checklistPhotoEvidenceControlNames,
  checklistPhotoEvidenceRequirementTrace,
  checklistPhotoEvidenceRoleMatrix,
  checklistPhotoEvidenceTechnicalDefaults,
  checklistPhotoEvidenceVerificationIds,
  checklistPhotoEvidenceWorkflowSinks,
  checklistPhotoSources,
  mediaAssetStatuses,
  operationalCampaignOutcomes,
  storeActionPhotoReviewStatuses,
  storeActionSolutionReviewResultStatuses,
  storeActionSolutionSubmissionResultStatus,
  submitStoreActionSolutionContract,
  visualCampaignStatuses,
  visualCampaignMutationGuards,
  visualComparisonStatuses,
} from "./checklist-photo-evidence.contract";

describe("checklist photo evidence executable contract", () => {
  it("[FR-01][AC-01] freezes item policy, capture source, and evidence lifecycle values", () => {
    expect(checklistEvidencePolicies).toEqual(["none", "optional", "required"]);
    expect(checklistPhotoSources).toEqual(["camera", "gallery"]);
    expect(mediaAssetStatuses).toEqual([
      "initiated",
      "uploaded",
      "quarantined",
      "accepted",
      "canonicalized",
      "ready",
      "rejected",
      "expired",
      "purge_pending",
      "deleted_tombstone",
    ]);
  });

  it("freezes the human-reviewed action lifecycle vocabulary", () => {
    expect(storeActionPhotoReviewStatuses).toEqual([
      "open",
      "in_progress",
      "solution_review_pending",
      "correction_required",
      "closed",
    ]);
  });

  it("keeps campaign, deadline, and review state vocabularies independent", () => {
    expect(visualCampaignStatuses).toEqual(["draft", "scheduled", "open", "closed", "retired"]);
    expect(campaignDeadlineStatuses).toEqual([
      "scheduled",
      "open",
      "on_time",
      "missed",
      "exempt",
      "withdrawn",
      "operational_hold",
    ]);
    expect(campaignReviewStatuses).toEqual([
      "not_submitted",
      "review_pending",
      "correction_requested",
      "completed",
    ]);
  });

  it("[FR-10][FR-11][AC-08][AC-09] permits experimental output only in isolated sinks", () => {
    expect(aiIsolationClasses).toEqual(["shadow", "advisory"]);
    expect(visualComparisonStatuses).toEqual([
      "queued",
      "processing",
      "completed",
      "abstained",
      "failed_retryable",
      "failed_terminal",
      "human_reviewed",
    ]);

    expect(() => assertExperimentalVisualOutputSink("comparison_evidence")).not.toThrow();
    expect(() => assertExperimentalVisualOutputSink("human_review")).not.toThrow();

    for (const sink of checklistPhotoEvidenceWorkflowSinks.official) {
      expect(() => assertExperimentalVisualOutputSink(sink)).toThrow(
        `Experimental visual output cannot reach non-experimental sink: ${sink}`,
      );
    }
    expect(() => assertExperimentalVisualOutputSink("future_official_sink")).toThrow(
      "Experimental visual output cannot reach non-experimental sink: future_official_sink",
    );
  });

  it("[FR-16][AC-16][AC-17][EC-16][EC-19] isolates operational deadline outcomes from official sinks", () => {
    expect(operationalCampaignOutcomes).toEqual([
      "on_time",
      "missed",
      "exempt",
      "withdrawn",
      "operational_hold",
      "reopened_successor",
    ]);
    for (const outcome of operationalCampaignOutcomes) {
      expect(() => assertOperationalCampaignOutcomeSink(outcome, "coverage_read_model")).not.toThrow();
      expect(() => assertOperationalCampaignOutcomeSink(outcome, "append_only_audit")).not.toThrow();
      expect(() => assertOperationalCampaignOutcomeSink(outcome, "immutable_revision_history")).not.toThrow();

      for (const sink of checklistPhotoEvidenceWorkflowSinks.official) {
        expect(() => assertOperationalCampaignOutcomeSink(outcome, sink)).toThrow(
          `Operational campaign outcome ${outcome} cannot reach non-operational sink: ${sink}`,
        );
      }
      expect(() => assertOperationalCampaignOutcomeSink(outcome, "future_official_sink")).toThrow(
        `Operational campaign outcome ${outcome} cannot reach non-operational sink: future_official_sink`,
      );
    }
  });

  it("[FR-05][FR-06][FR-07][AC-05][AC-06][EC-05] enforces submit and review command guards", () => {
    expect(storeActionSolutionSubmissionResultStatus).toBe("solution_review_pending");
    expect(storeActionSolutionReviewResultStatuses).toEqual({
      approve: "closed",
      reject: "correction_required",
    });
    const submission = {
      actorRole: "STORE_MANAGER",
      isCurrentOwner: true,
      hasCurrentAssignedStoreActionScope: true,
      resolutionNote: "Raf duzeni duzeltildi.",
      readyEvidenceCount: 1,
      attemptId: "attempt-2",
      expectedVersion: 4,
      idempotencyKey: "submit-2",
    };
    expect(submitStoreActionSolutionContract(submission)).toBe("solution_review_pending");
    expect(() =>
      assertStoreActionSolutionSubmissionContract({ ...submission, readyEvidenceCount: 0 }),
    ).toThrow("Solution submission requires a note and at least one ready evidence asset");
    expect(() =>
      assertStoreActionSolutionSubmissionContract({ ...submission, isCurrentOwner: false }),
    ).toThrow("Solution submission requires the current owner and assigned-store Store Manager scope");

    const review = {
      actorRole: "REGION_MANAGER",
      hasAssignedRegionScope: true,
      decision: "reject" as const,
      rejectionReason: "Yeni fotograf gerekli.",
      reviewedAttemptId: "attempt-2",
      currentAttemptId: "attempt-2",
      expectedVersion: 5,
      idempotencyKey: "review-2",
    };
    expect(() => assertStoreActionSolutionReviewContract(review)).not.toThrow();
    expect(() =>
      assertStoreActionSolutionReviewContract({ ...review, rejectionReason: "" }),
    ).toThrow("Solution rejection requires a reason");
    expect(() =>
      assertStoreActionSolutionReviewContract({ ...review, currentAttemptId: "attempt-3" }),
    ).toThrow("A superseded solution attempt cannot be reviewed");
  });

  it("[FR-15][AC-15][AC-18][EC-15][EC-16] freezes half-open database-time and mutation guards", () => {
    expect(visualCampaignMutationGuards).toEqual([
      "campaign_row_lock",
      "assignment_row_lock",
      "expected_revision",
      "database_time",
      "atomic_state_and_audit",
    ]);
    const startsAtEpochMs = Date.parse("2026-07-05T00:00:00+03:00");
    const submissionClosesAtEpochMs = Date.parse("2026-07-11T00:00:00+03:00");
    expect(classifyVisualCampaignSubmissionTiming({
      startsAtEpochMs,
      submissionClosesAtEpochMs,
      databaseFinalizedAtEpochMs: startsAtEpochMs - 1,
    })).toBe("not_open");
    expect(classifyVisualCampaignSubmissionTiming({
      startsAtEpochMs,
      submissionClosesAtEpochMs,
      databaseFinalizedAtEpochMs: submissionClosesAtEpochMs - 1,
    })).toBe("on_time");
    expect(classifyVisualCampaignSubmissionTiming({
      startsAtEpochMs,
      submissionClosesAtEpochMs,
      databaseFinalizedAtEpochMs: submissionClosesAtEpochMs,
    })).toBe("closed");
  });

  it("[NFR-04][AC-08][AC-19][EC-19] freezes independent feature controls and fail-closed dependencies", () => {
    expect(checklistPhotoEvidenceControlNames).toEqual([
      "checklist_evidence_capture",
      "required_evidence_enforcement",
      "store_action_photo_resolution",
      "region_manager_solution_review",
      "vm_reference_publishing",
      "vm_campaign_submission",
      "vm_campaign_deadline_settlement",
      "visual_comparison_enqueue",
      "visual_comparison_delivery",
      "advisory_result_visibility",
      "scheduled_retention_cleanup",
    ]);

    expect(() =>
      assertChecklistPhotoEvidenceControlState({
        checklistEvidenceCapture: false,
        checklistEvidenceStorageHealthy: true,
        requiredEvidenceEnforcement: true,
        hasOpenCampaignAssignments: false,
        vmCampaignSubmission: false,
        vmCampaignDeadlineSettlement: false,
        operationalHoldRecorded: false,
      }),
    ).toThrow("Required-evidence enforcement requires capture and healthy storage");

    expect(() =>
      assertChecklistPhotoEvidenceControlState({
        checklistEvidenceCapture: true,
        checklistEvidenceStorageHealthy: true,
        requiredEvidenceEnforcement: true,
        hasOpenCampaignAssignments: true,
        vmCampaignSubmission: false,
        vmCampaignDeadlineSettlement: true,
        operationalHoldRecorded: false,
      }),
    ).toThrow("Open campaign controls require an audited operational hold before disablement");

    expect(() =>
      assertChecklistPhotoEvidenceControlState({
        checklistEvidenceCapture: true,
        checklistEvidenceStorageHealthy: true,
        requiredEvidenceEnforcement: true,
        hasOpenCampaignAssignments: true,
        vmCampaignSubmission: false,
        vmCampaignDeadlineSettlement: false,
        operationalHoldRecorded: true,
      }),
    ).not.toThrow();
  });

  it("[NFR-06][NFR-09] records configurable technical defaults without inventing owner quotas", () => {
    expect(checklistPhotoEvidenceTechnicalDefaults).toEqual({
      rawUploadMaxBytes: 15 * 1024 * 1024,
      canonicalLongEdgePx: 2048,
      thumbnailLongEdgePx: 480,
      canonicalQuality: 85,
      initialRetentionDays: 365,
      businessTimezone: "Europe/Istanbul",
    });
    expect(checklistPhotoEvidenceTechnicalDefaults).not.toHaveProperty("maxPhotosPerItem");
    expect(checklistPhotoEvidenceTechnicalDefaults).not.toHaveProperty("companyCostCeiling");
  });

  it("[FR-14][AC-02] freezes the approved role/action matrix without broadening Report Viewer", () => {
    expect(checklistPhotoEvidenceRoleMatrix.REPORT_VIEWER).toEqual({
      evidenceRead: "company_approved_only",
      evidenceUpload: false,
      referencePublish: false,
      resolutionReview: false,
      advisoryDetailRead: false,
    });
    expect(checklistPhotoEvidenceRoleMatrix.VISUAL_MERCHANDISER.referencePublishPermission).toBe(
      "VM_REFERENCE_PUBLISHER",
    );
    expect(checklistPhotoEvidenceRoleMatrix.VISUAL_MERCHANDISER.advisoryReviewPermission).toBe(
      "VM_VISUAL_REVIEWER",
    );
  });

  it("[NFR-03][NFR-09] defines immutable audit event names before runtime writes", () => {
    expect(new Set(Object.values(checklistPhotoEvidenceAuditEventTypes)).size).toBe(
      Object.values(checklistPhotoEvidenceAuditEventTypes).length,
    );
    expect(checklistPhotoEvidenceAuditEventTypes).toMatchObject({
      mediaFinalized: "checklist_photo_evidence.media.finalized",
      actionSolutionSubmitted: "checklist_photo_evidence.action.solution_submitted",
      actionSolutionApproved: "checklist_photo_evidence.action.solution_approved",
      campaignMissed: "checklist_photo_evidence.campaign.missed",
      campaignOperationalHoldRecorded: "checklist_photo_evidence.campaign.operational_hold_recorded",
      comparisonCompleted: "checklist_photo_evidence.comparison.completed",
      retentionCleanupExecuted: "checklist_photo_evidence.retention.cleanup_executed",
      authorizationDenied: "checklist_photo_evidence.authorization.denied",
    });
  });

  it("traces every FR/NFR/AC/EC identifier to a planned implementation PR", () => {
    expect(checklistPhotoEvidenceVerificationIds.functional).toHaveLength(16);
    expect(checklistPhotoEvidenceVerificationIds.nonFunctional).toHaveLength(10);
    expect(checklistPhotoEvidenceVerificationIds.acceptance).toHaveLength(19);
    expect(checklistPhotoEvidenceVerificationIds.edgeCases).toHaveLength(19);

    const allIds = Object.values(checklistPhotoEvidenceVerificationIds).flat();
    expect(Object.keys(checklistPhotoEvidenceRequirementTrace).sort()).toEqual([...allIds].sort());

    for (const entry of Object.values(checklistPhotoEvidenceRequirementTrace)) {
      expect(entry.implementationPrs.length).toBeGreaterThan(0);
      for (const implementationPr of entry.implementationPrs) {
        expect(implementationPr).toBeGreaterThanOrEqual(1);
        expect(implementationPr).toBeLessThanOrEqual(10);
      }
      expect(entry.proofObligations.length).toBeGreaterThan(0);
      for (const proof of entry.proofObligations) {
        expect(proof.trim().length).toBeGreaterThan(8);
      }
    }
  });
});
