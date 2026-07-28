import {
  StoreActionPlanPriority,
  StoreActionPlanSourceType,
  StoreActionPlanStatus,
} from "./store-action-plan.contract";
import { TaskCommandWorkspaceScope } from "./task-command-workspace-scope";

export type TaskCommandAuditEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  actorDisplayName: string;
  actorRoleLabel: string | null;
  note: string | null;
};

export type TaskCommandWorkspaceItem = {
  actionPlanId: string;
  storeId: string;
  storeName: string | null;
  title: string;
  summary: string | null;
  priority: StoreActionPlanPriority;
  status: StoreActionPlanStatus;
  dueOn: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  resultNote: string | null;
  photoEvidenceVersion: number;
  currentSolutionAttemptId: string | null;
  resolutionWorkflowVersion: 1 | 2;
  source: {
    type: StoreActionPlanSourceType;
    id: string;
    deepLink: string | null;
  };
  events: {
    items: TaskCommandAuditEvent[];
    total: number;
    limit: number;
    hasMore: boolean;
  };
};

export type TaskCommandWorkspace = Pick<TaskCommandWorkspaceScope, "view" | "capabilities"> & {
  items: TaskCommandWorkspaceItem[];
  summary: {
    retained: number;
    actionable: number;
    completed: number;
    cancelled: number;
    checklist: number;
  };
  page: {
    total: number;
    limit: number;
    offset: number;
    count: number;
    hasMore: boolean;
  };
};
