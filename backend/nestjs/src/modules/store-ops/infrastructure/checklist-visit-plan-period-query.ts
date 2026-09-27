import { checklistVisitPlanScoreBands } from "../application/checklist-visit-plan.contract";

export function periodPlanSql(orderBy: string) {
  const { highBelow, mediumFrom, mediumThrough, strongFrom } = checklistVisitPlanScoreBands;
  return `
    WITH period_bounds AS (
      SELECT
        to_date($2::text, 'YYYY-MM') AS period_start,
        (to_date($2::text, 'YYYY-MM') + INTERVAL '1 month')::date AS period_end
    ),
    scoped_stores AS (
      SELECT store.store_id, store.store_code, store.store_name,
             region.region_id, region.region_name
      FROM ops.store store
      INNER JOIN ops.region region
        ON region.region_id = store.region_id
       AND region.company_id = store.company_id
      INNER JOIN ops.company company ON company.company_id = store.company_id
      WHERE ($1::uuid IS NULL OR store.region_id = $1::uuid)
        AND store.store_id = ANY($9::uuid[])
        AND store.status = 'active'
        AND region.status = 'active'
        AND company.status = 'active'
    ),
    monthly_checklist AS (
      SELECT
        ci.store_id,
        AVG(ci.total_score) FILTER (WHERE ct.template_type = 'BM_STORE_VISIT')::numeric(12,2) AS bm_score,
        AVG(ci.total_score) FILTER (WHERE ct.template_type = 'VM_STORE_VISIT')::numeric(12,2) AS vm_score,
        COUNT(*) FILTER (WHERE ct.template_type = 'BM_STORE_VISIT')::int AS bm_completed_count
      FROM ops.checklist_instance ci
      INNER JOIN scoped_stores store ON store.store_id = ci.store_id
      INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
      CROSS JOIN period_bounds bounds
      WHERE ci.status = 'completed'
        AND ci.completed_at IS NOT NULL
        AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
        AND ci.completed_at >= (bounds.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
        AND ci.completed_at < (bounds.period_end::timestamp AT TIME ZONE 'Europe/Istanbul')
      GROUP BY ci.store_id
    ),
    manual_visits AS (
      SELECT
        item.store_id,
        MAX(completion.completed_at) AS last_completed_visit_at,
        COUNT(*) FILTER (
          WHERE completion.completed_at >= (bounds.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
            AND completion.completed_at < (bounds.period_end::timestamp AT TIME ZONE 'Europe/Istanbul')
        )::int AS period_visit_count
      FROM ops.region_weekly_visit_plan_completion completion
      INNER JOIN ops.region_weekly_visit_plan_item item
        ON item.plan_item_id = completion.plan_item_id
      INNER JOIN scoped_stores store ON store.store_id = item.store_id
      CROSS JOIN period_bounds bounds
      GROUP BY item.store_id
    ),
    latest_completed AS (
      SELECT visits.store_id, MAX(visits.last_completed_visit_at) AS last_completed_visit_at
      FROM (
        SELECT ci.store_id, MAX(ci.completed_at) AS last_completed_visit_at
        FROM ops.checklist_instance ci
        INNER JOIN scoped_stores store ON store.store_id = ci.store_id
        INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
        WHERE ci.status = 'completed'
          AND ci.completed_at IS NOT NULL
          AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
        GROUP BY ci.store_id
        UNION ALL
        SELECT manual.store_id, manual.last_completed_visit_at
        FROM manual_visits manual
      ) visits
      GROUP BY visits.store_id
    ),
    active_drafts AS (
      SELECT ci.store_id, COUNT(*)::int AS active_draft_count
      FROM ops.checklist_instance ci
      INNER JOIN scoped_stores store ON store.store_id = ci.store_id
      INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
      WHERE ci.status IN ('planned', 'in_progress')
        AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
      GROUP BY ci.store_id
    ),
    pending_acknowledgements AS (
      SELECT
        ci.store_id,
        COUNT(*)::int AS pending_count,
        BOOL_OR(EXISTS (
          SELECT 1
          FROM ops.checklist_response response
          INNER JOIN ops.checklist_template_item item
            ON item.template_item_id = response.template_item_id
          WHERE response.checklist_instance_id = ci.checklist_instance_id
            AND item.max_score > 0
            AND ROUND((response.score_value / item.max_score) * 100) < ${highBelow}
        )) AS has_low_response
      FROM ops.checklist_instance ci
      INNER JOIN scoped_stores store ON store.store_id = ci.store_id
      INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
      LEFT JOIN ops.checklist_acknowledgement acknowledgement
        ON acknowledgement.checklist_instance_id = ci.checklist_instance_id
      CROSS JOIN period_bounds bounds
      WHERE ci.status = 'completed'
        AND ci.completed_at IS NOT NULL
        AND acknowledgement.checklist_acknowledgement_id IS NULL
        AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
        AND ci.completed_at >= (bounds.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
        AND ci.completed_at < (bounds.period_end::timestamp AT TIME ZONE 'Europe/Istanbul')
      GROUP BY ci.store_id
    ),
    plan_occurrences AS (
      SELECT
        item.store_id,
        item.plan_item_id,
        plan.plan_id,
        revision.revision_no,
        plan.week_start_date,
        item.planned_date,
         item.display_order,
         CASE
           WHEN completed.checklist_instance_id IS NOT NULL THEN 'completed'
           WHEN visit.visit_completion_id IS NOT NULL THEN 'completed'
           WHEN item.planned_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'planned'
           WHEN item.planned_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'waiting'
           ELSE 'missed'
         END AS plan_item_status,
         completed.checklist_instance_id,
         visit.completed_at AS visit_completed_at,
         COALESCE(completed.completed_at, visit.completed_at) AS completed_at
      FROM ops.region_weekly_visit_plan plan
      INNER JOIN ops.region_weekly_visit_plan_revision revision
        ON revision.plan_id = plan.plan_id AND revision.is_current = TRUE
      INNER JOIN ops.region_weekly_visit_plan_item item
        ON item.revision_id = revision.revision_id
      INNER JOIN scoped_stores store ON store.store_id = item.store_id
      CROSS JOIN period_bounds bounds
      LEFT JOIN LATERAL (
        SELECT ci.checklist_instance_id, ci.completed_at
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        WHERE ci.store_id = item.store_id
          AND ci.status = 'completed'
          AND ct.template_type = 'BM_STORE_VISIT'
          AND (ci.completed_at AT TIME ZONE 'Europe/Istanbul')::date = item.planned_date
        ORDER BY ci.completed_at ASC, ci.checklist_instance_id ASC
        LIMIT 1
       ) completed ON TRUE
       LEFT JOIN ops.region_weekly_visit_plan_completion visit
         ON visit.plan_item_id = item.plan_item_id
       WHERE ($1::uuid IS NULL OR plan.region_id = $1::uuid)
        AND plan.visit_type = 'BM_STORE_VISIT'
        AND item.planned_date >= bounds.period_start
        AND item.planned_date < bounds.period_end
    ),
    plan_aggregate AS (
      SELECT
        occurrence.store_id,
        COUNT(*)::int AS plan_item_count,
        COUNT(*) FILTER (WHERE occurrence.plan_item_status = 'waiting')::int AS waiting_count,
        COUNT(*) FILTER (WHERE occurrence.plan_item_status = 'missed')::int AS missed_count,
        COUNT(*) FILTER (WHERE occurrence.plan_item_status = 'completed')::int AS completed_count,
        COUNT(DISTINCT occurrence.plan_item_status)::int AS distinct_status_count,
        MIN(occurrence.planned_date) FILTER (WHERE occurrence.plan_item_status <> 'completed') AS next_plan_date,
        MAX(occurrence.plan_item_status) AS only_status,
        jsonb_agg(jsonb_build_object(
          'planItemId', occurrence.plan_item_id,
          'planId', occurrence.plan_id,
          'revision', occurrence.revision_no,
          'weekStart', occurrence.week_start_date,
          'storeId', store.store_id,
          'storeCode', store.store_code,
          'storeName', store.store_name,
          'plannedDate', occurrence.planned_date,
          'displayOrder', occurrence.display_order,
           'status', occurrence.plan_item_status,
           'checklistInstanceId', occurrence.checklist_instance_id,
           'visitCompletedAt', occurrence.visit_completed_at,
           'completedAt', occurrence.completed_at
        ) ORDER BY occurrence.planned_date, occurrence.display_order, occurrence.plan_item_id) AS plan_items
      FROM plan_occurrences occurrence
      INNER JOIN scoped_stores store ON store.store_id = occurrence.store_id
      GROUP BY occurrence.store_id
    ),
    fact_base AS (
      SELECT
        store.*,
        score.bm_score,
        score.vm_score,
        COALESCE(score.bm_completed_count, 0)::int AS bm_completed_count,
        latest.last_completed_visit_at,
        CASE WHEN latest.last_completed_visit_at IS NULL THEN NULL ELSE
          (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
          - (latest.last_completed_visit_at AT TIME ZONE 'Europe/Istanbul')::date
        END AS elapsed_days_since_last_visit,
        COALESCE(draft.active_draft_count, 0)::int AS active_draft_count,
        COALESCE(pending.pending_count, 0)::int AS pending_count,
        COALESCE(pending.has_low_response, FALSE) AS has_low_response,
        COALESCE(plan.plan_item_count, 0)::int AS plan_item_count,
        COALESCE(plan.waiting_count, 0)::int AS waiting_count,
        COALESCE(plan.missed_count, 0)::int AS missed_count,
        COALESCE(plan.completed_count, 0)::int AS completed_count,
        plan.next_plan_date,
        COALESCE(plan.plan_items, '[]'::jsonb) AS plan_items,
        CASE
          WHEN COALESCE(plan.plan_item_count, 0) = 0 THEN 'unplanned'
          WHEN plan.distinct_status_count = 1 THEN plan.only_status
          ELSE 'mixed'
        END AS plan_status,
         (COALESCE(score.bm_completed_count, 0) = 0 AND COALESCE(manual.period_visit_count, 0) = 0) AS reason_missing,
        ((score.bm_score < ${highBelow} OR score.vm_score < ${highBelow}) OR COALESCE(pending.has_low_response, FALSE)) AS reason_low,
        (NOT COALESCE(score.bm_score < ${highBelow} OR score.vm_score < ${highBelow}, FALSE)
          AND COALESCE(score.bm_score BETWEEN ${mediumFrom} AND ${mediumThrough} OR score.vm_score BETWEEN ${mediumFrom} AND ${mediumThrough}, FALSE)) AS reason_watch,
        (COALESCE(draft.active_draft_count, 0) > 0) AS reason_active,
        (COALESCE(pending.pending_count, 0) > 0) AS reason_pending,
        (COALESCE(score.bm_completed_count, 0) > 0 AND score.bm_score IS NULL) AS reason_insufficient,
         (COALESCE(score.bm_completed_count, 0) > 0 OR COALESCE(manual.period_visit_count, 0) > 0) AS reason_completed
      FROM scoped_stores store
      LEFT JOIN monthly_checklist score ON score.store_id = store.store_id
      LEFT JOIN manual_visits manual ON manual.store_id = store.store_id
      LEFT JOIN latest_completed latest ON latest.store_id = store.store_id
      LEFT JOIN active_drafts draft ON draft.store_id = store.store_id
      LEFT JOIN pending_acknowledgements pending ON pending.store_id = store.store_id
      LEFT JOIN plan_aggregate plan ON plan.store_id = store.store_id
    ),
    reasoned AS (
      SELECT
        fact.*,
        CASE
          WHEN fact.reason_missing OR fact.reason_low THEN 'high'
          WHEN fact.reason_pending OR fact.reason_active OR fact.reason_watch OR fact.reason_insufficient THEN 'medium'
          ELSE 'low'
        END AS risk,
        array_remove(ARRAY[
          CASE WHEN fact.reason_missing THEN 'missing_current_month_visit' END,
          CASE WHEN fact.reason_low THEN 'low_checklist_score' END,
          CASE WHEN fact.reason_pending THEN 'pending_acknowledgement' END,
          CASE WHEN fact.reason_active THEN 'active_draft' END,
          CASE WHEN fact.reason_watch THEN 'watch_checklist_result' END,
          CASE WHEN fact.reason_insufficient THEN 'insufficient_signal' END,
          CASE WHEN fact.reason_completed
            AND NOT (fact.reason_missing OR fact.reason_low OR fact.reason_pending OR fact.reason_active OR fact.reason_watch OR fact.reason_insufficient)
            AND (fact.bm_score IS NOT NULL OR fact.vm_score IS NOT NULL)
            AND COALESCE(fact.bm_score, ${strongFrom}) >= ${strongFrom}
            AND COALESCE(fact.vm_score, ${strongFrom}) >= ${strongFrom}
            THEN 'strong_score' END,
          CASE WHEN fact.reason_completed THEN 'visit_completed' END
        ], NULL)::text[] AS reason_codes,
        (CASE
          WHEN fact.reason_missing OR fact.reason_low THEN 300
          WHEN fact.reason_pending OR fact.reason_active OR fact.reason_watch OR fact.reason_insufficient THEN 200
          ELSE 100
        END)
        + CASE WHEN fact.reason_missing THEN 80 ELSE 0 END
        + CASE WHEN fact.reason_low THEN 70 ELSE 0 END
        + CASE WHEN fact.reason_pending THEN 45 ELSE 0 END
        + CASE WHEN fact.reason_active THEN 40 ELSE 0 END
        + CASE WHEN fact.reason_watch THEN 35 ELSE 0 END
        + CASE WHEN fact.reason_insufficient THEN 30 ELSE 0 END
        + CASE WHEN fact.reason_completed THEN 10 ELSE 0 END
        + CASE WHEN fact.reason_missing THEN 5 ELSE 0 END AS risk_score
      FROM fact_base fact
    ),
    filtered AS (
      SELECT *
      FROM reasoned
      WHERE (
        $3::text IS NULL
        OR store_code ILIKE '%' || $3::text || '%' ESCAPE '\\'
        OR store_name ILIKE '%' || $3::text || '%' ESCAPE '\\'
      )
        AND ($4::text = 'all' OR risk = $4::text)
        AND ($5::text = 'all' OR $5::text = ANY(reason_codes))
        AND ($6::text = 'all' OR plan_status = $6::text)
    ),
    paged AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS sort_rank
      FROM filtered
      ORDER BY ${orderBy}
      LIMIT $7 OFFSET $8
    )
    SELECT
      COALESCE((SELECT MAX(region_name) FROM scoped_stores), '') AS region_name,
      (SELECT COUNT(*)::int FROM filtered) AS total_count,
      jsonb_build_object(
        'totalStores', (SELECT COUNT(*)::int FROM reasoned),
        'high', (SELECT COUNT(*)::int FROM reasoned WHERE risk = 'high'),
        'medium', (SELECT COUNT(*)::int FROM reasoned WHERE risk = 'medium'),
        'low', (SELECT COUNT(*)::int FROM reasoned WHERE risk = 'low'),
        'planned', (SELECT COUNT(*)::int FROM reasoned WHERE plan_item_count > 0),
        'unplanned', (SELECT COUNT(*)::int FROM reasoned WHERE plan_item_count = 0),
        'waiting', COALESCE((SELECT SUM(waiting_count)::int FROM reasoned), 0),
        'missed', COALESCE((SELECT SUM(missed_count)::int FROM reasoned), 0),
        'completed', COALESCE((SELECT SUM(completed_count)::int FROM reasoned), 0)
      ) AS metrics_json,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'storeId', page.store_id,
        'storeCode', page.store_code,
        'storeName', page.store_name,
        'regionId', page.region_id,
        'regionName', page.region_name,
        'bmScore', page.bm_score,
        'vmScore', page.vm_score,
        'lastCompletedVisitAt', page.last_completed_visit_at,
        'elapsedDaysSinceLastVisit', page.elapsed_days_since_last_visit,
        'risk', page.risk,
        'reasonCodes', page.reason_codes,
        'planStatus', page.plan_status,
        'planItems', page.plan_items
      ) ORDER BY page.sort_rank) FROM paged page), '[]'::jsonb) AS items_json
  `;
}
