import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type MasterDataQualitySeverity = "critical" | "warning" | "info";
export type MasterDataQualityEntityType = "store" | "personnel" | "assignment" | "import";

export type MasterDataQualityIssueRow = {
  issue_id: string;
  issue_code: string;
  severity: MasterDataQualitySeverity;
  entity_type: MasterDataQualityEntityType;
  entity_id: string;
  entity_label: string;
  secondary_label: string | null;
  problem_label: string;
  recommended_action: string;
  affected_modules: string[];
  last_seen_at: string;
  source: string;
  total_count: string;
  critical_count: string;
  warning_count: string;
  info_count: string;
  store_count: string;
  personnel_count: string;
  assignment_count: string;
  import_count: string;
};

export type MasterDataQualityAuditRow = {
  event_id: string;
  event_type: string;
  entity_type: "store" | "personnel" | "import";
  entity_id: string | null;
  entity_label: string;
  actor_label: string;
  occurred_at: string;
  metadata_json: Record<string, unknown>;
  total_count: string;
};

@Injectable()
export class MasterDataQualityRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listIssues(input: {
    actorCompanyIds: string[];
    q?: string;
    entityType?: MasterDataQualityEntityType;
    severity?: MasterDataQualitySeverity;
    issueCode?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [input.actorCompanyIds];
    const filters: string[] = [];

    if (input.q?.trim()) {
      params.push(`%${input.q.trim()}%`);
      filters.push(`(
        issue_code ILIKE $${params.length}
        OR entity_label ILIKE $${params.length}
        OR COALESCE(secondary_label, '') ILIKE $${params.length}
        OR problem_label ILIKE $${params.length}
      )`);
    }

    if (input.entityType) {
      params.push(input.entityType);
      filters.push(`entity_type = $${params.length}`);
    }

    if (input.severity) {
      params.push(input.severity);
      filters.push(`severity = $${params.length}`);
    }

    if (input.issueCode) {
      params.push(input.issueCode);
      filters.push(`issue_code = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    params.push(input.limit, input.offset);
    const limitIndex = params.length - 1;
    const offsetIndex = params.length;

    const result = await this.databaseService.query<MasterDataQualityIssueRow>(
      `
        WITH active_manager_assignments AS (
          SELECT DISTINCT eah.store_id
          FROM ops.employee_assignment_history eah
          INNER JOIN ops.employee e
            ON e.employee_id = eah.employee_id
           AND e.employment_status = 'active'
          INNER JOIN ops.position p
            ON p.position_id = eah.position_id
           AND p.is_managerial = TRUE
          WHERE eah.is_primary_assignment = TRUE
            AND eah.assignment_status = 'active'
            AND eah.end_date IS NULL
        ),
        duplicate_seller_codes AS (
          SELECT LOWER(BTRIM(external_employee_ref)) AS seller_code
          FROM ops.employee
          WHERE company_id = ANY($1::uuid[])
            AND employment_status = 'active'
            AND external_employee_ref IS NOT NULL
            AND BTRIM(external_employee_ref) <> ''
          GROUP BY LOWER(BTRIM(external_employee_ref))
          HAVING COUNT(*) > 1
        ),
        issues AS (
          SELECT
            CONCAT('store_missing_region_assignment:', s.store_id::text) AS issue_id,
            'store_missing_region_assignment' AS issue_code,
            'critical' AS severity,
            'store' AS entity_type,
            s.store_id::text AS entity_id,
            s.store_name AS entity_label,
            s.store_code AS secondary_label,
            'Bölge bağlantısı eksik veya pasif' AS problem_label,
            'Aktif bir bölge seçin' AS recommended_action,
            ARRAY['KPI', 'Hedefler', 'Primler', 'Raporlar']::text[] AS affected_modules,
            s.updated_at::text AS last_seen_at,
            'store' AS source
          FROM ops.store s
          LEFT JOIN ops.region r
            ON r.region_id = s.region_id
          WHERE s.company_id = ANY($1::uuid[])
            AND s.status = 'active'
            AND (r.region_id IS NULL OR r.status <> 'active')

          UNION ALL

          SELECT
            CONCAT('store_missing_store_manager:', s.store_id::text),
            'store_missing_store_manager',
            'warning',
            'store',
            s.store_id::text,
            s.store_name,
            s.store_code,
            'Mağaza müdürü ataması bulunamadı',
            'Aktif mağaza müdürü atayın',
            ARRAY['Hedefler', 'Görevler', 'Checklist', 'Raporlar']::text[],
            s.updated_at::text,
            'store'
          FROM ops.store s
          LEFT JOIN active_manager_assignments manager_assignment
            ON manager_assignment.store_id = s.store_id
          WHERE s.company_id = ANY($1::uuid[])
            AND s.status = 'active'
            AND manager_assignment.store_id IS NULL

          UNION ALL

          SELECT
            CONCAT('personnel_missing_store_assignment:', e.employee_id::text),
            'personnel_missing_store_assignment',
            'critical',
            'personnel',
            e.employee_id::text,
            CONCAT_WS(' ', BTRIM(e.first_name), BTRIM(e.last_name)),
            e.external_employee_ref,
            'Aktif mağaza ataması bulunamadı',
            'Personeli aktif mağazaya bağlayın',
            ARRAY['Norm Kadro', 'Hedefler', 'Primler', 'Raporlar']::text[],
            e.updated_at::text,
            'personnel'
          FROM ops.employee e
          LEFT JOIN LATERAL (
            SELECT eah.assignment_id
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = e.employee_id
              AND eah.is_primary_assignment = TRUE
              AND eah.assignment_status = 'active'
              AND eah.end_date IS NULL
            LIMIT 1
          ) assignment ON TRUE
          WHERE e.company_id = ANY($1::uuid[])
            AND e.employment_status = 'active'
            AND assignment.assignment_id IS NULL

          UNION ALL

          SELECT
            CONCAT('personnel_missing_position:', e.employee_id::text),
            'personnel_missing_position',
            'warning',
            'personnel',
            e.employee_id::text,
            CONCAT_WS(' ', BTRIM(e.first_name), BTRIM(e.last_name)),
            COALESCE(s.store_name, e.external_employee_ref),
            'Pozisyon eşleşmesi bulunamadı',
            'Geçerli pozisyon seçin',
            ARRAY['Norm Kadro', 'Primler', 'Hedefler']::text[],
            GREATEST(e.updated_at, COALESCE(assignment.updated_at, e.updated_at))::text,
            'personnel'
          FROM ops.employee e
          INNER JOIN LATERAL (
            SELECT eah.position_id, eah.store_id, eah.updated_at
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = e.employee_id
              AND eah.is_primary_assignment = TRUE
              AND eah.assignment_status = 'active'
              AND eah.end_date IS NULL
            ORDER BY eah.start_date DESC, eah.created_at DESC
            LIMIT 1
          ) assignment ON TRUE
          LEFT JOIN ops.position p
            ON p.position_id = assignment.position_id
          LEFT JOIN ops.store s
            ON s.store_id = assignment.store_id
          WHERE e.company_id = ANY($1::uuid[])
            AND e.employment_status = 'active'
            AND p.position_id IS NULL

          UNION ALL

          SELECT
            CONCAT('personnel_missing_seller_code:', e.employee_id::text),
            'personnel_missing_seller_code',
            'warning',
            'personnel',
            e.employee_id::text,
            CONCAT_WS(' ', BTRIM(e.first_name), BTRIM(e.last_name)),
            COALESCE(s.store_name, 'Mağaza ataması yok'),
            'Satıcı kodu bulunamadı',
            'Satıcı kodunu tamamlayın',
            ARRAY['Satış', 'KPI', 'Primler', 'Ranking']::text[],
            GREATEST(e.updated_at, COALESCE(assignment.updated_at, e.updated_at))::text,
            'personnel'
          FROM ops.employee e
          LEFT JOIN LATERAL (
            SELECT eah.store_id, eah.updated_at
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = e.employee_id
              AND eah.is_primary_assignment = TRUE
              AND eah.assignment_status = 'active'
              AND eah.end_date IS NULL
            ORDER BY eah.start_date DESC, eah.created_at DESC
            LIMIT 1
          ) assignment ON TRUE
          LEFT JOIN ops.store s
            ON s.store_id = assignment.store_id
          WHERE e.company_id = ANY($1::uuid[])
            AND e.employment_status = 'active'
            AND (e.external_employee_ref IS NULL OR BTRIM(e.external_employee_ref) = '')

          UNION ALL

          SELECT
            CONCAT('personnel_duplicate_seller_code:', e.employee_id::text),
            'personnel_duplicate_seller_code',
            'critical',
            'personnel',
            e.employee_id::text,
            CONCAT_WS(' ', BTRIM(e.first_name), BTRIM(e.last_name)),
            e.external_employee_ref,
            'Satıcı kodu birden fazla aktif personelde kullanılıyor',
            'Satıcı kodunu tekil hale getirin',
            ARRAY['Satış', 'KPI', 'Primler', 'Ranking']::text[],
            e.updated_at::text,
            'personnel'
          FROM ops.employee e
          INNER JOIN duplicate_seller_codes duplicate
            ON duplicate.seller_code = LOWER(BTRIM(e.external_employee_ref))
          WHERE e.company_id = ANY($1::uuid[])
            AND e.employment_status = 'active'

          UNION ALL

          SELECT
            CONCAT('inactive_store_has_active_personnel:', s.store_id::text),
            'inactive_store_has_active_personnel',
            'warning',
            'store',
            s.store_id::text,
            s.store_name,
            s.store_code,
            'Pasif mağazada aktif personel görünüyor',
            'Personel atamalarını güncelleyin',
            ARRAY['Norm Kadro', 'Hedefler', 'Raporlar']::text[],
            s.updated_at::text,
            'assignment'
          FROM ops.store s
          WHERE s.company_id = ANY($1::uuid[])
            AND s.status <> 'active'
            AND EXISTS (
              SELECT 1
              FROM ops.employee_assignment_history eah
              INNER JOIN ops.employee e
                ON e.employee_id = eah.employee_id
               AND e.employment_status = 'active'
              WHERE eah.store_id = s.store_id
                AND eah.is_primary_assignment = TRUE
                AND eah.assignment_status = 'active'
                AND eah.end_date IS NULL
            )

          UNION ALL

          SELECT
            CONCAT('import_batch_blocked:', batch.master_data_bootstrap_batch_id::text),
            'import_batch_blocked',
            'warning',
            'import',
            batch.master_data_bootstrap_batch_id::text,
            batch.source_label,
            batch.bootstrap_entity,
            'İçe aktarımda kontrol bekleyen kayıt var',
            'Bekleyen satırları inceleyin',
            ARRAY['İçe Aktarım', 'Ana Veri', 'Raporlar']::text[],
            COALESCE(batch.validated_at, batch.promoted_at, batch.created_at)::text,
            'import'
          FROM stg.master_data_bootstrap_batch batch
          WHERE batch.company_id = ANY($1::uuid[])
            AND batch.batch_status IN ('uploaded', 'validated', 'ready_to_promote')
            AND (batch.needs_review_count > 0 OR batch.invalid_count > 0)
        ),
        filtered AS (
          SELECT *
          FROM issues
          ${whereClause}
        )
        SELECT
          issue_id,
          issue_code,
          severity::text AS severity,
          entity_type::text AS entity_type,
          entity_id,
          entity_label,
          secondary_label,
          problem_label,
          recommended_action,
          affected_modules,
          last_seen_at,
          source,
          COUNT(*) OVER()::text AS total_count,
          COUNT(*) FILTER (WHERE severity = 'critical') OVER()::text AS critical_count,
          COUNT(*) FILTER (WHERE severity = 'warning') OVER()::text AS warning_count,
          COUNT(*) FILTER (WHERE severity = 'info') OVER()::text AS info_count,
          COUNT(*) FILTER (WHERE entity_type = 'store') OVER()::text AS store_count,
          COUNT(*) FILTER (WHERE entity_type = 'personnel') OVER()::text AS personnel_count,
          COUNT(*) FILTER (WHERE entity_type = 'assignment') OVER()::text AS assignment_count,
          COUNT(*) FILTER (WHERE entity_type = 'import') OVER()::text AS import_count
        FROM filtered
        ORDER BY
          CASE severity
            WHEN 'critical' THEN 1
            WHEN 'warning' THEN 2
            ELSE 3
          END,
          last_seen_at DESC,
          entity_label ASC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      params,
    );

    const firstRow = result.rows[0];

    return {
      rows: result.rows,
      total: Number(firstRow?.total_count ?? 0),
      summary: {
        severity: {
          critical: Number(firstRow?.critical_count ?? 0),
          warning: Number(firstRow?.warning_count ?? 0),
          info: Number(firstRow?.info_count ?? 0),
        },
        entityType: {
          store: Number(firstRow?.store_count ?? 0),
          personnel: Number(firstRow?.personnel_count ?? 0),
          assignment: Number(firstRow?.assignment_count ?? 0),
          import: Number(firstRow?.import_count ?? 0),
        },
      },
    };
  }

  async listAudit(input: {
    actorCompanyIds: string[];
    entityType?: "store" | "personnel" | "import";
    entityId?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [input.actorCompanyIds];
    const filters: string[] = [
      `events.event_type IN (
        'store_master_data.updated',
        'personnel_master_data.updated',
        'import_batch.created',
        'import_batch.retried',
        'master_data_bootstrap.batch.created',
        'master_data_bootstrap.batch.validated',
        'master_data_bootstrap.stores.promoted',
        'master_data_bootstrap.personnel.promoted'
      )`,
    ];

    if (input.entityType) {
      params.push(input.entityType);
      filters.push(`events.entity_type = $${params.length}`);
    }

    if (input.entityId) {
      params.push(input.entityId);
      filters.push(`events.entity_id = $${params.length}::uuid`);
    }

    params.push(input.limit, input.offset);
    const limitIndex = params.length - 1;
    const offsetIndex = params.length;

    const result = await this.databaseService.query<MasterDataQualityAuditRow>(
      `
        WITH events AS (
          SELECT
            event.event_log_id::text AS event_id,
            event.event_type,
            CASE
              WHEN event.entity_name = 'ops.store' THEN 'store'
              WHEN event.entity_name = 'ops.employee' THEN 'personnel'
              ELSE 'import'
            END AS entity_type,
            event.entity_id,
            COALESCE(
              store.store_name,
              CONCAT_WS(' ', BTRIM(employee.first_name), BTRIM(employee.last_name)),
              batch.source_label,
              event.entity_id::text,
              'Kayıt'
            ) AS entity_label,
            COALESCE(
              CONCAT_WS(' ', BTRIM(actor_employee.first_name), BTRIM(actor_employee.last_name)),
              actor.username,
              actor.email,
              'Sistem'
            ) AS actor_label,
            event.occurred_at::text AS occurred_at,
            event.metadata_json,
            COUNT(*) OVER()::text AS total_count
          FROM audit.event_log event
          LEFT JOIN ops.store store
            ON event.entity_name = 'ops.store'
           AND store.store_id = event.entity_id
           AND store.company_id = ANY($1::uuid[])
          LEFT JOIN ops.employee employee
            ON event.entity_name = 'ops.employee'
           AND employee.employee_id = event.entity_id
           AND employee.company_id = ANY($1::uuid[])
          LEFT JOIN stg.master_data_bootstrap_batch batch
            ON event.entity_name IN ('stg.import_batch', 'stg.master_data_bootstrap_batch')
           AND batch.master_data_bootstrap_batch_id = event.entity_id
           AND batch.company_id = ANY($1::uuid[])
          LEFT JOIN ops.user_account actor
            ON actor.user_id = event.actor_user_id
          LEFT JOIN ops.employee actor_employee
            ON actor_employee.employee_id = actor.employee_id
          WHERE (
              store.store_id IS NOT NULL
              OR employee.employee_id IS NOT NULL
              OR batch.master_data_bootstrap_batch_id IS NOT NULL
            )
        )
        SELECT *
        FROM events
        WHERE ${filters.join(" AND ")}
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      params,
    );

    return {
      rows: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }
}
