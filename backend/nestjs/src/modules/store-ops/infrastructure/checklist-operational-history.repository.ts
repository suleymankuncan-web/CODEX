import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  ChecklistOperationalHistoryEvent,
  ChecklistOperationalHistoryKind,
  ChecklistOperationalHistoryRange,
} from "../application/checklist-operational-history.contract";
import type { ChecklistOperationalHistoryCursor } from "../application/checklist-operational-history-cursor";

type ReadInput = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  storeId: string;
  range: ChecklistOperationalHistoryRange;
  kinds: ChecklistOperationalHistoryKind[];
  cursor: ChecklistOperationalHistoryCursor | null;
  limit: 21;
};

type QueryRow = {
  store_id: string;
  store_name: string;
  event_count: string | number;
  completed_audit_count: string | number;
  completed_visit_count: string | number;
  assigned_task_count: string | number;
  resolved_task_count: string | number;
  open_task_count: string | number;
  event_id: string | null;
  event_kind: ChecklistOperationalHistoryKind | null;
  occurred_at: string | Date | null;
  event_title: string | null;
  event_detail: string | null;
  actor_display_name: string | null;
  actor_role_label: string | null;
  actor_assignment_label: string | null;
  actor_identity_status: "historical_projection" | "unknown" | null;
  details_json: Array<{ label: string; value: string }> | null;
  event_key: string | null;
  kind_rank: number | null;
};

export type ChecklistOperationalHistoryRepositoryResult = {
  store: { id: string; name: string; city: null; district: null };
  summary: {
    eventCount: number;
    completedAuditCount: number;
    completedVisitCount: number;
    assignedTaskCount: number;
    resolvedTaskCount: number;
    openTaskCount: number;
  };
  items: Array<{ event: ChecklistOperationalHistoryEvent; cursor: ChecklistOperationalHistoryCursor }>;
};

@Injectable()
export class ChecklistOperationalHistoryRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async read(input: ReadInput): Promise<ChecklistOperationalHistoryRepositoryResult | null> {
    const result = await this.databaseService.query<QueryRow>(OPERATIONAL_HISTORY_SQL, [
      input.companyIds,
      input.regionIds,
      input.storeIds,
      input.storeId,
      input.kinds,
      input.range,
      input.cursor?.occurredAt ?? null,
      input.cursor?.kindRank ?? null,
      input.cursor?.eventKey ?? null,
      input.limit,
    ]);
    const first = result.rows[0];
    if (!first) return null;

    return {
      store: { id: first.store_id, name: first.store_name, city: null, district: null },
      summary: {
        eventCount: Number(first.event_count),
        completedAuditCount: Number(first.completed_audit_count),
        completedVisitCount: Number(first.completed_visit_count),
        assignedTaskCount: Number(first.assigned_task_count),
        resolvedTaskCount: Number(first.resolved_task_count),
        openTaskCount: Number(first.open_task_count),
      },
      items: result.rows.flatMap((row) => {
        if (!row.event_id || !row.event_kind || !row.occurred_at || !row.event_title || !row.event_key || !row.kind_rank) return [];
        const occurredAt = new Date(row.occurred_at).toISOString();
        return [{
          event: {
            id: row.event_id,
            kind: row.event_kind,
            occurredAt,
            title: row.event_title,
            detail: row.event_detail,
            actorSnapshot: {
              displayName: row.actor_display_name,
              roleLabel: row.actor_role_label,
              assignmentLabel: row.actor_assignment_label,
              identityStatus: row.actor_identity_status ?? "unknown",
            },
            details: row.details_json ?? [],
          },
          cursor: { occurredAt, kindRank: row.kind_rank, eventKey: row.event_key },
        }];
      }),
    };
  }
}

const OPERATIONAL_HISTORY_SQL = `
WITH scoped_store AS (
  SELECT store.store_id, store.store_name, store.company_id, store.region_id
  FROM ops.store AS store
  WHERE store.store_id = $4::uuid
    AND (
      (store.company_id = ANY($1::uuid[]))
      OR (store.region_id = ANY($2::uuid[]))
      OR (store.store_id = ANY($3::uuid[]))
    )
),
scoped_checklist_instance AS (
  SELECT instance.checklist_instance_id
  FROM ops.checklist_instance AS instance
  JOIN scoped_store ON scoped_store.store_id = instance.store_id
  WHERE instance.status = 'completed'
    AND instance.completed_at IS NOT NULL
),
completion_audit AS (
  SELECT DISTINCT ON (event.entity_id)
    event.entity_id, event.occurred_at, event.actor_user_id
  FROM audit.event_log AS event
  JOIN scoped_checklist_instance AS scoped_instance ON scoped_instance.checklist_instance_id = event.entity_id
  WHERE event.event_type = 'checklist_instance.completed'
    AND event.entity_name = 'ops.checklist_instance'
  ORDER BY event.entity_id, event.occurred_at, event.event_log_id
),
acknowledgement_audit AS (
  SELECT DISTINCT ON (event.entity_id)
    event.entity_id, event.event_log_id, event.occurred_at, event.actor_user_id
  FROM audit.event_log AS event
  CROSS JOIN scoped_store
  WHERE event.event_type = 'checklist_instance.acknowledged'
    AND event.store_id = scoped_store.store_id
  ORDER BY event.entity_id, event.occurred_at, event.event_log_id
),
revision_order AS (
  SELECT revision.*,
    LAG(revision.revision_id) OVER (PARTITION BY revision.plan_id ORDER BY revision.revision_no) AS previous_revision_id
  FROM ops.region_weekly_visit_plan_revision AS revision
  CROSS JOIN scoped_store
  WHERE revision.region_id = scoped_store.region_id
),
revision_affected_store AS (
  SELECT revision.revision_id, item.store_id
  FROM revision_order AS revision
  JOIN ops.region_weekly_visit_plan_item AS item ON item.revision_id = revision.revision_id
  UNION
  SELECT revision.revision_id, item.store_id
  FROM revision_order AS revision
  JOIN ops.region_weekly_visit_plan_item AS item ON item.revision_id = revision.previous_revision_id
),
all_events AS (
  SELECT
    instance.checklist_instance_id AS source_id,
    'checklist_completed'::text AS kind,
    5 AS kind_rank,
    COALESCE(completion_audit.occurred_at, instance.completed_at) AS occurred_at,
    COALESCE(
      completion_audit.actor_user_id,
      CASE WHEN instance.completed_by_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN instance.completed_by_user_id::uuid ELSE NULL END
    ) AS actor_user_id,
    'Denetim tamamlandı'::text AS title,
    'Mağaza denetimi tamamlandı.'::text AS detail,
    CASE template.template_type WHEN 'BM_STORE_VISIT' THEN 'Bölge Müdürü ziyareti' ELSE 'Görsel düzenleme ziyareti' END AS source_label,
    NULL::text AS source_aux
  FROM ops.checklist_instance AS instance
  JOIN scoped_store ON scoped_store.store_id = instance.store_id
  JOIN ops.checklist_template AS template ON template.checklist_template_id = instance.checklist_template_id
  LEFT JOIN completion_audit ON completion_audit.entity_id = instance.checklist_instance_id
  WHERE instance.status = 'completed'
    AND instance.completed_at IS NOT NULL
    AND template.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')

  UNION ALL

  SELECT
    visit.visit_completion_id,
    'visit_completed', 6, visit.completed_at, visit.completed_by_user_id,
    'Ziyaret tamamlandı', 'Planlanan mağaza ziyareti tamamlandı.',
    item.planned_date::text, NULL
  FROM ops.region_weekly_visit_plan_completion AS visit
  JOIN ops.region_weekly_visit_plan_item AS item ON item.plan_item_id = visit.plan_item_id
  JOIN scoped_store ON scoped_store.store_id = item.store_id

  UNION ALL

  SELECT
    acknowledgement.event_log_id,
    'acknowledgement', 4, acknowledgement.occurred_at, acknowledgement.actor_user_id,
    'Denetim sonucu incelendi', 'Mağaza denetim sonucu görüntülendi ve onaylandı.',
    NULL, NULL
  FROM acknowledgement_audit AS acknowledgement

  UNION ALL

  SELECT
    task.store_action_plan_id,
    'task_assigned', 3, task.created_at, task.created_by_user_id,
    'Görev atandı', 'Mağaza için operasyon görevi atandı.',
    CASE task.priority WHEN 'high' THEN 'Yüksek' WHEN 'low' THEN 'Düşük' ELSE 'Orta' END,
    task.due_on::text
  FROM ops.store_action_plan AS task
  JOIN scoped_store ON scoped_store.store_id = task.store_id

  UNION ALL

  SELECT
    task.store_action_plan_id,
    'task_resolved', 2, task.closed_at, task.closed_by_user_id,
    'Görev çözüldü', 'Atanan operasyon görevi tamamlandı.',
    NULL, NULL
  FROM ops.store_action_plan AS task
  JOIN scoped_store ON scoped_store.store_id = task.store_id
  WHERE task.status = 'closed' AND task.closed_at IS NOT NULL

  UNION ALL

  SELECT
    revision.revision_id,
    'visit_plan_revised', 1, revision.created_at, revision.created_by_user_id,
    'Ziyaret planı güncellendi', 'Haftalık mağaza ziyaret planı revize edildi.',
    revision.week_start_date::text, revision.revision_no::text
  FROM revision_order AS revision
  JOIN revision_affected_store AS affected ON affected.revision_id = revision.revision_id
  JOIN scoped_store ON scoped_store.store_id = affected.store_id
),
keyed_events AS (
  SELECT all_events.*, md5(all_events.kind || ':' || all_events.source_id::text) AS event_key
  FROM all_events
),
summary AS (
  SELECT
    COUNT(*)::bigint AS event_count,
    COUNT(*) FILTER (WHERE kind = 'checklist_completed')::bigint AS completed_audit_count,
    COUNT(*) FILTER (WHERE kind IN ('checklist_completed', 'visit_completed'))::bigint AS completed_visit_count,
    COUNT(*) FILTER (WHERE kind = 'task_assigned')::bigint AS assigned_task_count,
    COUNT(*) FILTER (WHERE kind = 'task_resolved')::bigint AS resolved_task_count,
    (SELECT COUNT(*)::bigint FROM ops.store_action_plan AS task JOIN scoped_store ON scoped_store.store_id = task.store_id WHERE task.status IN ('open', 'in_progress', 'blocked')) AS open_task_count
  FROM keyed_events
),
filtered_events AS (
  SELECT event.*
  FROM keyed_events AS event
  WHERE event.kind = ANY($5::text[])
    AND event.occurred_at >= CASE $6::text
      WHEN '3m' THEN NOW() - INTERVAL '3 months'
      WHEN '6m' THEN NOW() - INTERVAL '6 months'
      WHEN '12m' THEN NOW() - INTERVAL '12 months'
      ELSE '-infinity'::timestamptz
    END
    AND (
      $7::timestamptz IS NULL
      OR (event.occurred_at, event.kind_rank, event.event_key) < ($7::timestamptz, $8::integer, $9::text)
    )
  ORDER BY event.occurred_at DESC, event.kind_rank DESC, event.event_key DESC
  LIMIT $10
),
actor_candidates AS (
  SELECT
    event.*,
    COALESCE(
      NULLIF(BTRIM(CONCAT_WS(' ', employee.first_name, employee.last_name)), ''),
      NULLIF(BTRIM(CONCAT_WS(' ', auditor.first_name, auditor.last_name)), '')
    ) AS actor_display_name,
    role.role_name AS actor_role_label,
    CASE assignment.scope_type
      WHEN 'store' THEN assignment_store.store_name
      WHEN 'region' THEN assignment_region.region_name
      WHEN 'company' THEN assignment_company.company_name
      WHEN 'global' THEN 'Genel kapsam'
      ELSE NULL
    END AS actor_assignment_label,
    CASE WHEN account.user_id IS NOT NULL OR auditor.employee_id IS NOT NULL
      THEN 'historical_projection' ELSE 'unknown' END AS actor_identity_status,
    ROW_NUMBER() OVER (
      PARTITION BY event.kind, event.source_id
      ORDER BY
        CASE assignment.scope_type WHEN 'store' THEN 1 WHEN 'region' THEN 2 WHEN 'company' THEN 3 ELSE 4 END,
        role.role_code NULLS LAST,
        assignment.user_role_assignment_id NULLS LAST
    ) AS actor_rank
  FROM filtered_events AS event
  CROSS JOIN scoped_store
  LEFT JOIN ops.user_account AS account ON account.user_id = event.actor_user_id
  LEFT JOIN ops.employee AS employee ON employee.employee_id = account.employee_id
  LEFT JOIN ops.checklist_instance AS completed_instance
    ON event.kind = 'checklist_completed' AND completed_instance.checklist_instance_id = event.source_id
  LEFT JOIN ops.employee AS auditor ON auditor.employee_id = completed_instance.auditor_employee_id
  LEFT JOIN ops.user_role_assignment AS assignment
    ON assignment.user_id = event.actor_user_id
    AND assignment.start_at <= event.occurred_at
    AND (assignment.end_at IS NULL OR assignment.end_at >= event.occurred_at)
    AND (
      (assignment.scope_type = 'store' AND assignment.store_id = scoped_store.store_id)
      OR (assignment.scope_type = 'region' AND assignment.region_id = scoped_store.region_id)
      OR (assignment.scope_type = 'company' AND assignment.company_id = scoped_store.company_id)
      OR assignment.scope_type = 'global'
    )
  LEFT JOIN ops.role AS role ON role.role_id = assignment.role_id
  LEFT JOIN ops.store AS assignment_store ON assignment_store.store_id = assignment.store_id
  LEFT JOIN ops.region AS assignment_region ON assignment_region.region_id = assignment.region_id
  LEFT JOIN ops.company AS assignment_company ON assignment_company.company_id = assignment.company_id
),
projected_events AS (
  SELECT *
  FROM actor_candidates
  WHERE actor_rank = 1
)
SELECT
  scoped_store.store_id,
  scoped_store.store_name,
  summary.event_count,
  summary.completed_audit_count,
  summary.completed_visit_count,
  summary.assigned_task_count,
  summary.resolved_task_count,
  summary.open_task_count,
  CASE WHEN event.event_key IS NULL THEN NULL ELSE 'evt_' || event.event_key END AS event_id,
  event.kind AS event_kind,
  event.occurred_at,
  event.title AS event_title,
  event.detail AS event_detail,
  NULLIF(event.actor_display_name, '') AS actor_display_name,
  event.actor_role_label,
  event.actor_assignment_label,
  event.actor_identity_status,
  CASE event.kind
    WHEN 'checklist_completed' THEN jsonb_build_array(jsonb_build_object('label', 'Denetim türü', 'value', event.source_label))
    WHEN 'visit_completed' THEN jsonb_build_array(jsonb_build_object('label', 'Planlanan tarih', 'value', event.source_label))
    WHEN 'task_assigned' THEN jsonb_build_array(
      jsonb_build_object('label', 'Öncelik', 'value', event.source_label),
      jsonb_build_object('label', 'Bitiş tarihi', 'value', event.source_aux)
    )
    WHEN 'visit_plan_revised' THEN jsonb_build_array(
      jsonb_build_object('label', 'Hafta', 'value', event.source_label),
      jsonb_build_object('label', 'Revizyon', 'value', event.source_aux)
    )
    ELSE '[]'::jsonb
  END AS details_json,
  event.event_key,
  event.kind_rank
FROM scoped_store
CROSS JOIN summary
LEFT JOIN projected_events AS event ON TRUE
ORDER BY event.occurred_at DESC, event.kind_rank DESC, event.event_key DESC;
`;
