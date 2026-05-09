const IMPORT_STUCK_THRESHOLD_MINUTES = 30;

const IN_PROGRESS_STATUSES = ["pending", "queued", "processing"];

export type ImportBatchDependencySummary = {
  employee: number;
  store: number;
  position: number;
  region: number;
  company: number;
  manager: number;
};

export type ImportBatchRowStatusSummary = {
  processed: number;
  validationFailed: number;
  retryableError: number;
  pending: number;
};

export function getRecommendedImportOrder(): string[] {
  return ["company", "region", "store", "position", "employee", "assignment", "kpi"];
}

export function getBlockedByEntityTypes(
  dependencySummary: ImportBatchDependencySummary,
): string[] {
  const blocked = new Set<string>();

  if (dependencySummary.company > 0) blocked.add("company");
  if (dependencySummary.region > 0) blocked.add("region");
  if (dependencySummary.store > 0) blocked.add("store");
  if (dependencySummary.position > 0) blocked.add("position");
  if (dependencySummary.employee > 0) blocked.add("employee");
  if (dependencySummary.manager > 0) blocked.add("employee");

  return getRecommendedImportOrder().filter((entityType) => blocked.has(entityType));
}

export function getListHealthState(input: {
  status: string;
  errorCount: number;
  startedAt: string;
}) {
  if (input.status === "completed" && input.errorCount === 0) return "healthy";
  if (IN_PROGRESS_STATUSES.includes(input.status) && isImportStuck(input.startedAt)) {
    return "stuck";
  }
  if (IN_PROGRESS_STATUSES.includes(input.status)) return "in_progress";
  return "needs_action";
}

export function getDetailHealthState(input: {
  status: string;
  rowStatusSummary: ImportBatchRowStatusSummary;
  blockedByEntityTypes: string[];
  canRetryNow: boolean;
}) {
  if (
    input.status === "completed" &&
    input.rowStatusSummary.validationFailed === 0 &&
    input.rowStatusSummary.retryableError === 0
  ) {
    return "healthy";
  }

  if (IN_PROGRESS_STATUSES.includes(input.status)) {
    return "in_progress";
  }

  if (input.blockedByEntityTypes.length > 0) {
    return "blocked";
  }

  if (
    ["failed", "completed_with_errors"].includes(input.status) &&
    input.rowStatusSummary.retryableError > 0 &&
    input.canRetryNow
  ) {
    return "retry_ready";
  }

  return "needs_action";
}

export function getImportStuckBeforeIso() {
  return new Date(Date.now() - IMPORT_STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
}

export function isImportStuck(startedAt: string) {
  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) {
    return false;
  }

  return Date.now() - startedAtMs >= IMPORT_STUCK_THRESHOLD_MINUTES * 60 * 1000;
}
