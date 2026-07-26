export const checklistEvidencePolicies = ["none", "optional", "required"] as const;
export type ChecklistEvidencePolicy = (typeof checklistEvidencePolicies)[number];

export const checklistPhotoSources = ["camera", "gallery"] as const;
export type ChecklistPhotoSource = (typeof checklistPhotoSources)[number];

export const mediaAssetStatuses = [
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
] as const;
export type MediaAssetStatus = (typeof mediaAssetStatuses)[number];

export const storeActionPhotoReviewStatuses = [
  "open",
  "in_progress",
  "solution_review_pending",
  "correction_required",
  "closed",
] as const;
export type StoreActionPhotoReviewStatus = (typeof storeActionPhotoReviewStatuses)[number];

export const visualCampaignStatuses = ["draft", "scheduled", "open", "closed", "retired"] as const;
export type VisualCampaignStatus = (typeof visualCampaignStatuses)[number];

export const campaignDeadlineStatuses = [
  "scheduled",
  "open",
  "on_time",
  "missed",
  "exempt",
  "withdrawn",
  "operational_hold",
] as const;
export type CampaignDeadlineStatus = (typeof campaignDeadlineStatuses)[number];

export const campaignReviewStatuses = [
  "not_submitted",
  "review_pending",
  "correction_requested",
  "completed",
] as const;
export type CampaignReviewStatus = (typeof campaignReviewStatuses)[number];

export const visualComparisonStatuses = [
  "queued",
  "processing",
  "completed",
  "abstained",
  "failed_retryable",
  "failed_terminal",
  "human_reviewed",
] as const;
export type VisualComparisonStatus = (typeof visualComparisonStatuses)[number];

export const aiIsolationClasses = ["shadow", "advisory"] as const;
export type AiIsolationClass = (typeof aiIsolationClasses)[number];

export const checklistPhotoEvidenceWorkflowSinks = {
  experimental: ["comparison_evidence", "human_review"] as const,
  official: [
    "checklist_response_score",
    "checklist_total_score",
    "kpi",
    "ranking",
    "competition",
    "store_action_generation",
    "store_action_priority",
    "incentive_projection",
    "incentive_correction",
    "incentive_finalization",
  ] as const,
};

export type ExperimentalVisualOutputSink = (typeof checklistPhotoEvidenceWorkflowSinks.experimental)[number];

export function assertExperimentalVisualOutputSink(sink: string): asserts sink is ExperimentalVisualOutputSink {
  if (!(checklistPhotoEvidenceWorkflowSinks.experimental as readonly string[]).includes(sink)) {
    throw new Error(`Experimental visual output cannot reach non-experimental sink: ${sink}`);
  }
}

export const operationalCampaignOutcomes = [
  "on_time",
  "missed",
  "exempt",
  "withdrawn",
  "operational_hold",
  "reopened_successor",
] as const;
export type OperationalCampaignOutcome = (typeof operationalCampaignOutcomes)[number];
export const operationalCampaignOutcomeSinks = [
  "coverage_read_model",
  "append_only_audit",
  "immutable_revision_history",
] as const;
export type OperationalCampaignOutcomeSink = (typeof operationalCampaignOutcomeSinks)[number];

export function assertOperationalCampaignOutcomeSink(
  outcome: OperationalCampaignOutcome,
  sink: string,
): asserts sink is OperationalCampaignOutcomeSink {
  if (!(operationalCampaignOutcomeSinks as readonly string[]).includes(sink)) {
    throw new Error(`Operational campaign outcome ${outcome} cannot reach non-operational sink: ${sink}`);
  }
}

export const checklistPhotoEvidenceControlNames = [
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
] as const;
export type ChecklistPhotoEvidenceControlName = (typeof checklistPhotoEvidenceControlNames)[number];

export type ChecklistPhotoEvidenceControlState = {
  checklistEvidenceCapture: boolean;
  checklistEvidenceStorageHealthy: boolean;
  requiredEvidenceEnforcement: boolean;
  hasOpenCampaignAssignments: boolean;
  vmCampaignSubmission: boolean;
  vmCampaignDeadlineSettlement: boolean;
  operationalHoldRecorded: boolean;
};

export function assertChecklistPhotoEvidenceControlState(
  state: ChecklistPhotoEvidenceControlState,
): void {
  if (
    state.requiredEvidenceEnforcement &&
    (!state.checklistEvidenceCapture || !state.checklistEvidenceStorageHealthy)
  ) {
    throw new Error("Required-evidence enforcement requires capture and healthy storage");
  }

  const openCampaignControlDisabled =
    state.hasOpenCampaignAssignments &&
    (!state.vmCampaignSubmission || !state.vmCampaignDeadlineSettlement);

  if (openCampaignControlDisabled && !state.operationalHoldRecorded) {
    throw new Error("Open campaign controls require an audited operational hold before disablement");
  }
}

export const checklistPhotoEvidenceTechnicalDefaults = {
  rawUploadMaxBytes: 15 * 1024 * 1024,
  canonicalLongEdgePx: 2048,
  thumbnailLongEdgePx: 480,
  canonicalQuality: 85,
  initialRetentionDays: 365,
  businessTimezone: "Europe/Istanbul",
} as const;

export type StoreActionSolutionSubmissionContract = {
  actorRole: string;
  isCurrentOwner: boolean;
  hasCurrentAssignedStoreActionScope: boolean;
  resolutionNote: string;
  readyEvidenceCount: number;
  attemptId: string;
  expectedVersion: number;
  idempotencyKey: string;
};

export const storeActionSolutionSubmissionResultStatus = "solution_review_pending" as const;
export const storeActionSolutionReviewResultStatuses = {
  approve: "closed",
  reject: "correction_required",
} as const;

export function assertStoreActionSolutionSubmissionContract(
  input: StoreActionSolutionSubmissionContract,
): void {
  if (input.actorRole !== "STORE_MANAGER" || !input.isCurrentOwner || !input.hasCurrentAssignedStoreActionScope) {
    throw new Error("Solution submission requires the current owner and assigned-store Store Manager scope");
  }
  if (input.resolutionNote.trim().length === 0 || input.readyEvidenceCount < 1) {
    throw new Error("Solution submission requires a note and at least one ready evidence asset");
  }
  if (!input.attemptId || !input.idempotencyKey || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new Error("Solution submission requires attempt, idempotency, and expected-version guards");
  }
}

export function submitStoreActionSolutionContract(
  input: StoreActionSolutionSubmissionContract,
): typeof storeActionSolutionSubmissionResultStatus {
  assertStoreActionSolutionSubmissionContract(input);
  return storeActionSolutionSubmissionResultStatus;
}

export type StoreActionSolutionReviewContract = {
  actorRole: string;
  hasAssignedRegionScope: boolean;
  decision: "approve" | "reject";
  rejectionReason?: string;
  reviewedAttemptId: string;
  currentAttemptId: string;
  expectedVersion: number;
  idempotencyKey: string;
};

export function assertStoreActionSolutionReviewContract(input: StoreActionSolutionReviewContract): void {
  if (input.actorRole !== "REGION_MANAGER" || !input.hasAssignedRegionScope) {
    throw new Error("Solution review requires assigned-region Region Manager scope");
  }
  if (input.decision === "reject" && !input.rejectionReason?.trim()) {
    throw new Error("Solution rejection requires a reason");
  }
  if (input.reviewedAttemptId !== input.currentAttemptId) {
    throw new Error("A superseded solution attempt cannot be reviewed");
  }
  if (!input.idempotencyKey || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new Error("Solution review requires idempotency and expected-version guards");
  }
}

export const visualCampaignMutationGuards = [
  "campaign_row_lock",
  "assignment_row_lock",
  "expected_revision",
  "database_time",
  "atomic_state_and_audit",
] as const;

export type VisualCampaignSubmissionTiming = "not_open" | "on_time" | "closed";

export function classifyVisualCampaignSubmissionTiming(input: {
  startsAtEpochMs: number;
  submissionClosesAtEpochMs: number;
  databaseFinalizedAtEpochMs: number;
}): VisualCampaignSubmissionTiming {
  if (input.startsAtEpochMs >= input.submissionClosesAtEpochMs) {
    throw new Error("Campaign start must be before its exclusive close boundary");
  }
  if (input.databaseFinalizedAtEpochMs < input.startsAtEpochMs) {
    return "not_open";
  }
  return input.databaseFinalizedAtEpochMs < input.submissionClosesAtEpochMs ? "on_time" : "closed";
}

export type ChecklistPhotoEvidenceQuotaPolicy = {
  maxPhotosPerItem: number;
  maxPhotosPerInstance: number;
  maxDailyBytesPerUser: number;
  maxDailyBytesPerStore: number;
  maxConcurrentUploads: number;
  monthlyStorageBytesCeiling: number;
  monthlyEgressBytesCeiling: number;
  monthlyTransformationCeiling: number;
  monthlyAiCostMinorUnitsCeiling: number;
};

export const checklistPhotoEvidenceRoleMatrix = {
  STORE_MANAGER: {
    evidenceRead: "own_store",
    evidenceUpload: "own_store_solution_and_vm_campaign",
    referencePublish: false,
    resolutionReview: "submit_only",
    advisoryDetailRead: "own_store_when_exposed",
  },
  REGION_MANAGER: {
    evidenceRead: "assigned_region",
    evidenceUpload: "authorized_bm_checklist",
    referencePublish: false,
    resolutionReview: "assigned_store_approve_reject",
    advisoryDetailRead: "assigned_region",
  },
  VISUAL_MERCHANDISER: {
    evidenceRead: "assigned_stores_and_references",
    evidenceUpload: "authorized_vm_checklist",
    referencePublish: "permission_required",
    referencePublishPermission: "VM_REFERENCE_PUBLISHER",
    resolutionReview: false,
    advisoryDetailRead: "permission_required",
    advisoryReviewPermission: "VM_VISUAL_REVIEWER",
  },
  REPORT_VIEWER: {
    evidenceRead: "company_approved_only",
    evidenceUpload: false,
    referencePublish: false,
    resolutionReview: false,
    advisoryDetailRead: false,
  },
  HR_ADMIN: {
    evidenceRead: "company_policy_and_template_scope",
    evidenceUpload: false,
    referencePublish: false,
    resolutionReview: false,
    advisoryDetailRead: "policy_aggregate_only",
  },
  SUPER_ADMIN: {
    evidenceRead: "company_policy_and_emergency_controls",
    evidenceUpload: false,
    referencePublish: "audited_recovery_only",
    resolutionReview: "separate_audited_override_only",
    advisoryDetailRead: "configuration_and_audit",
  },
} as const;

export const checklistPhotoEvidenceAuditEventTypes = {
  mediaUploadInitiated: "checklist_photo_evidence.media.upload_initiated",
  mediaUploaded: "checklist_photo_evidence.media.uploaded",
  mediaRejected: "checklist_photo_evidence.media.rejected",
  mediaQuarantined: "checklist_photo_evidence.media.quarantined",
  mediaFinalized: "checklist_photo_evidence.media.finalized",
  mediaViewed: "checklist_photo_evidence.media.viewed",
  mediaDownloaded: "checklist_photo_evidence.media.downloaded",
  mediaRedacted: "checklist_photo_evidence.media.redacted",
  mediaExpired: "checklist_photo_evidence.media.expired",
  mediaDeleted: "checklist_photo_evidence.media.deleted",
  mediaDeletionFailed: "checklist_photo_evidence.media.deletion_failed",
  checklistEvidenceLinked: "checklist_photo_evidence.checklist.linked",
  checklistEvidenceUnlinked: "checklist_photo_evidence.checklist.unlinked",
  referenceDraftCreated: "checklist_photo_evidence.reference.draft_created",
  referencePublished: "checklist_photo_evidence.reference.published",
  referenceRetired: "checklist_photo_evidence.reference.retired",
  referenceSuperseded: "checklist_photo_evidence.reference.superseded",
  campaignScheduled: "checklist_photo_evidence.campaign.scheduled",
  campaignOpened: "checklist_photo_evidence.campaign.opened",
  campaignSubmitted: "checklist_photo_evidence.campaign.submitted",
  campaignClosed: "checklist_photo_evidence.campaign.closed",
  campaignMissed: "checklist_photo_evidence.campaign.missed",
  campaignExempted: "checklist_photo_evidence.campaign.exempted",
  campaignExtended: "checklist_photo_evidence.campaign.extended",
  campaignReopened: "checklist_photo_evidence.campaign.reopened",
  campaignScopeRevised: "checklist_photo_evidence.campaign.scope_revised",
  campaignOperationalHoldRecorded: "checklist_photo_evidence.campaign.operational_hold_recorded",
  actionSolutionSubmitted: "checklist_photo_evidence.action.solution_submitted",
  actionSolutionApproved: "checklist_photo_evidence.action.solution_approved",
  actionSolutionRejected: "checklist_photo_evidence.action.solution_rejected",
  actionSolutionResubmitted: "checklist_photo_evidence.action.solution_resubmitted",
  comparisonQueued: "checklist_photo_evidence.comparison.queued",
  comparisonInvoked: "checklist_photo_evidence.comparison.invoked",
  comparisonCompleted: "checklist_photo_evidence.comparison.completed",
  comparisonAbstained: "checklist_photo_evidence.comparison.abstained",
  comparisonFailed: "checklist_photo_evidence.comparison.failed",
  comparisonRetried: "checklist_photo_evidence.comparison.retried",
  comparisonReviewAccepted: "checklist_photo_evidence.comparison.review_accepted",
  comparisonReviewOverridden: "checklist_photo_evidence.comparison.review_overridden",
  comparisonReviewRejected: "checklist_photo_evidence.comparison.review_rejected",
  comparisonRecaptureRequested: "checklist_photo_evidence.comparison.recapture_requested",
  retentionPolicyChanged: "checklist_photo_evidence.retention.policy_changed",
  retentionCleanupPreviewed: "checklist_photo_evidence.retention.cleanup_previewed",
  retentionCleanupExecuted: "checklist_photo_evidence.retention.cleanup_executed",
  authorizationDenied: "checklist_photo_evidence.authorization.denied",
} as const;

export const checklistPhotoEvidenceVerificationIds = {
  functional: [
    "FR-01", "FR-02", "FR-03", "FR-04", "FR-05", "FR-06", "FR-07", "FR-08",
    "FR-09", "FR-10", "FR-11", "FR-12", "FR-13", "FR-14", "FR-15", "FR-16",
  ],
  nonFunctional: [
    "NFR-01", "NFR-02", "NFR-03", "NFR-04", "NFR-05",
    "NFR-06", "NFR-07", "NFR-08", "NFR-09", "NFR-10",
  ],
  acceptance: [
    "AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08",
    "AC-09", "AC-10", "AC-11", "AC-12", "AC-13", "AC-14", "AC-15", "AC-16",
    "AC-17", "AC-18", "AC-19",
  ],
  edgeCases: [
    "EC-01", "EC-02", "EC-03", "EC-04", "EC-05", "EC-06", "EC-07", "EC-08",
    "EC-09", "EC-10", "EC-11", "EC-12", "EC-13", "EC-14", "EC-15", "EC-16",
    "EC-17", "EC-18", "EC-19",
  ],
} as const;

export type ChecklistPhotoEvidenceRequirementId =
  (typeof checklistPhotoEvidenceVerificationIds)[keyof typeof checklistPhotoEvidenceVerificationIds][number];

export type ChecklistPhotoEvidenceRequirementTraceEntry = {
  implementationPrs: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)[];
  proofObligations: readonly string[];
};

function trace(
  implementationPrs: ChecklistPhotoEvidenceRequirementTraceEntry["implementationPrs"],
  ...proofObligations: string[]
): ChecklistPhotoEvidenceRequirementTraceEntry {
  return { implementationPrs, proofObligations };
}

export const checklistPhotoEvidenceRequirementTrace = {
  "FR-01": trace([2, 4], "versioned item policy schema", "required-policy completion tests"),
  "FR-02": trace([3, 4], "authorized camera/gallery upload contract", "item ownership negative tests"),
  "FR-03": trace([3], "decode, scan, canonicalize, and ready-state tests"),
  "FR-04": trace([4], "server completion rejects missing or non-ready required evidence"),
  "FR-05": trace([5], "solution submit requires note and ready evidence"),
  "FR-06": trace([5], "assigned-region approve/reject authorization tests"),
  "FR-07": trace([2, 5], "immutable attempt schema", "reject/resubmit history tests"),
  "FR-08": trace([2, 6], "immutable reference version schema", "publisher permission tests"),
  "FR-09": trace([2, 4, 6], "exact instance/item/reference foreign keys", "old-version pinning tests"),
  "FR-10": trace([8, 9], "provider-neutral adapter contract", "durable asynchronous queue tests"),
  "FR-11": trace([1, 8, 9, 10], "fail-closed sink allowlist", "human override history", "official-path isolation tests"),
  "FR-12": trace([2, 7], "versioned retention and hold schema", "cleanup and tombstone rehearsal"),
  "FR-13": trace([1, 9], "independent AI controls", "provider outage manual-flow regression"),
  "FR-14": trace([3, 10], "company-approved read scope", "Report Viewer write and advisory-detail denials"),
  "FR-15": trace([2, 6], "immutable window and assignment snapshot schema", "Europe/Istanbul boundary tests"),
  "FR-16": trace([1, 6], "operational-outcome sink allowlist", "idempotent close and no-downstream-write tests"),
  "NFR-01": trace([2, 3], "private object ownership constraints", "signed-read and cross-tenant denial tests"),
  "NFR-02": trace([3, 7, 8], "metadata stripping and restricted-content tests", "provider privacy gate"),
  "NFR-03": trace([2, 4, 5, 6], "immutable links and revisions", "append-only audit enforcement"),
  "NFR-04": trace([1, 9], "independent controls", "retry, circuit-breaker, and manual fallback tests"),
  "NFR-05": trace([3, 10], "non-blocking upload contract", "thumbnail list and on-demand canonical reads"),
  "NFR-06": trace([1, 3, 7, 9], "configurable quota shape", "storage, egress, transform, and AI ceiling alarms"),
  "NFR-07": trace([4, 5, 10], "keyboard and screen-reader interaction tests"),
  "NFR-08": trace([4, 10], "iOS Safari and Android Chrome evidence"),
  "NFR-09": trace([1, 3, 7, 9], "typed audit and failure vocabulary", "secret and image-content log redaction"),
  "NFR-10": trace([3, 7], "inventory reconciliation", "database and object restore rehearsal"),
  "AC-01": trace([4], "none, optional, required completion matrix"),
  "AC-02": trace([3, 4, 5, 6], "cross-company, store, role, and assignment denials"),
  "AC-03": trace([3], "spoof, unsafe, size, pixel, and quarantine negative tests"),
  "AC-04": trace([2, 3, 4], "capture source, hash, actor, item, and completion audit proof"),
  "AC-05": trace([1, 5], "submission contract returns solution_review_pending and never closed"),
  "AC-06": trace([1, 5], "assigned-region review, required reject reason, immutable history"),
  "AC-07": trace([2, 6], "published-reference mutation denial", "historical version pinning"),
  "AC-08": trace([1, 9], "AI controls independent from manual workflows", "outage regression"),
  "AC-09": trace([1, 8, 9], "fail-closed official sink isolation", "static consumer-boundary tests"),
  "AC-10": trace([2, 7], "hold-aware expiry selection", "dry-run, purge, and tombstone proof"),
  "AC-11": trace([3, 7], "storage reconciliation and restore rehearsal receipt"),
  "AC-12": trace([8], "blinded accuracy, error, subgroup, latency, cost, and contract report"),
  "AC-13": trace([4, 10], "representative real-device capture and long-review evidence"),
  "AC-14": trace([1, 10], "production remains disabled", "controlled-staging-only pilot evidence"),
  "AC-15": trace([1, 6], "half-open database-finalization boundary tests"),
  "AC-16": trace([1, 6], "idempotent missed transition", "operational-only sink isolation"),
  "AC-17": trace([2, 6], "reasoned permission and immutable before/after revision audit"),
  "AC-18": trace([1, 2, 6], "lock and expected-revision contract", "database-time race tests", "atomic audit"),
  "AC-19": trace([1, 6], "hold-before-disable invariant", "held-assignment settlement skip and recovery"),
  "EC-01": trace([3, 4], "finalize versus completion race test"),
  "EC-02": trace([3, 4, 9], "idempotent media finalize", "duplicate completion", "duplicate queue delivery"),
  "EC-03": trace([3, 4], "fresh scope recheck at finalize and completion"),
  "EC-04": trace([4, 6], "in-progress checklist retains pinned reference"),
  "EC-05": trace([5], "review versus resubmit expected-attempt race test"),
  "EC-06": trace([2, 7], "active action/review protection from cleanup"),
  "EC-07": trace([9], "late provider success idempotency and timeout reconciliation"),
  "EC-08": trace([8, 10], "unsupported variant abstain/recapture path"),
  "EC-09": trace([3, 8], "unsafe content rejection", "image text treated as untrusted data"),
  "EC-10": trace([3, 7], "object-without-row and row-without-object reconciliation"),
  "EC-11": trace([2, 7], "policy change affects future assets unless explicit impact command"),
  "EC-12": trace([5], "legacy closed V1 action remains grandfathered without backfill"),
  "EC-13": trace([1, 2, 4], "configurable per-item count", "ordered multi-photo link tests"),
  "EC-14": trace([3, 4], "interrupted upload retry and abandoned-part cleanup"),
  "EC-15": trace([3, 6], "database finalization at exclusive deadline boundary"),
  "EC-16": trace([1, 6], "close versus valid-finalize lock and CAS race"),
  "EC-17": trace([6, 10], "review after deadline cannot rewrite deadline outcome"),
  "EC-18": trace([2, 6], "immutable add, withdraw, close, reassign, and exempt revisions"),
  "EC-19": trace([1, 6], "operational hold before disablement", "audited reconcile and reopen recovery"),
} satisfies Record<ChecklistPhotoEvidenceRequirementId, ChecklistPhotoEvidenceRequirementTraceEntry>;
