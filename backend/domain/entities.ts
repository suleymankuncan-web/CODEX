export type ScopeType = "company" | "region" | "store";
export type EmploymentStatus = "active" | "inactive" | "terminated" | "leave";
export type AssignmentStatus = "active" | "ended" | "planned";
export type ChecklistStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type TargetDirection = "higher_is_better" | "lower_is_better";

export interface Company {
  companyId: string;
  companyCode: string;
  companyName: string;
  status: string;
  createdAt: string;
}

export interface Region {
  regionId: string;
  companyId: string;
  regionCode: string;
  regionName: string;
  status: string;
  createdAt: string;
}

export interface Store {
  storeId: string;
  companyId: string;
  regionId: string;
  storeCode: string;
  storeName: string;
  storeType: string;
  openDate?: string;
  closeDate?: string;
  status: string;
  timezone: string;
  createdAt: string;
}

export interface Employee {
  employeeId: string;
  companyId: string;
  externalEmployeeRef?: string;
  firstName: string;
  lastName: string;
  hireDate: string;
  terminationDate?: string;
  employmentStatus: EmploymentStatus;
  employmentType: string;
  createdAt: string;
}

export interface EmployeeAssignmentHistory {
  assignmentId: string;
  employeeId: string;
  storeId: string;
  regionId: string;
  positionId: string;
  managerEmployeeId?: string;
  startDate: string;
  endDate?: string;
  isPrimaryAssignment: boolean;
  fteRatio: number;
  assignmentStatus: AssignmentStatus;
  createdAt: string;
}

export interface UserRoleAssignment {
  userRoleAssignmentId: string;
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  companyId?: string;
  regionId?: string;
  storeId?: string;
  startAt: string;
  endAt?: string;
}

export interface ChecklistInstance {
  checklistInstanceId: string;
  checklistTemplateId: string;
  storeId: string;
  assignedEmployeeId?: string;
  auditorEmployeeId?: string;
  plannedAt?: string;
  startedAt?: string;
  completedAt?: string;
  status: ChecklistStatus;
  totalScore?: number;
  complianceRate?: number;
  createdAt: string;
}

export interface KpiActual {
  kpiActualId: string;
  kpiId: string;
  scopeType: ScopeType;
  companyId?: string;
  regionId?: string;
  storeId?: string;
  employeeId?: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number;
  calculatedAt: string;
  sourceType: string;
}

export interface WorkforceNormPlan {
  normPlanId: string;
  companyId: string;
  regionId?: string;
  storeId?: string;
  positionId: string;
  periodStart: string;
  periodEnd: string;
  plannedHeadcount: number;
  plannedFte: number;
  approvedBy?: string;
  approvedAt?: string;
}

export interface SnapshotRun {
  snapshotRunId: string;
  snapshotDate: string;
  snapshotType: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;
  sourceBatchNo?: string;
}

export interface IntegrationImportBatch {
  importBatchId: string;
  integrationSourceId: string;
  entityType: string;
  startedAt: string;
  finishedAt?: string;
  status: "pending" | "processing" | "completed" | "failed";
  rawFileName?: string;
  recordCount: number;
  errorCount: number;
}

export interface AuditEventLog {
  eventLogId: string;
  occurredAt: string;
  actorUserId?: string;
  eventType: string;
  entityName: string;
  entityId?: string;
  scopeType: ScopeType;
  companyId?: string;
  regionId?: string;
  storeId?: string;
  requestId?: string;
  ipAddress?: string;
  metadataJson: Record<string, unknown>;
}
