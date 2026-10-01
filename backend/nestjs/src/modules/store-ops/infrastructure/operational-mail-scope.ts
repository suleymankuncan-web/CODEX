import type { DatabaseService } from "../../../shared/database/database.service";
import type { OperationalReportManager } from "./operational-mail.types";

export const operationalRoleScopeSql=`ura.start_at<=clock_timestamp() AND (ura.end_at IS NULL OR ura.end_at>clock_timestamp())
  AND (ura.scope_type='global' OR (ura.scope_type='company' AND ura.company_id=store.company_id)
    OR (ura.scope_type='region' AND ura.region_id=store.region_id) OR (ura.scope_type='store' AND ura.store_id=store.store_id))`;
export const operationalStoreRolesSql=`SELECT DISTINCT account.user_id::text,lower(account.email) AS email,role.role_code
  FROM ops.store store JOIN ops.company company ON company.company_id=store.company_id AND company.status='active'
  JOIN ops.user_action_store_assignment assigned ON assigned.store_id=store.store_id
    AND assigned.start_at<=clock_timestamp() AND (assigned.end_at IS NULL OR assigned.end_at>clock_timestamp())
  JOIN ops.user_account account ON account.user_id=assigned.user_id AND account.is_active
  JOIN ops.user_role_assignment ura ON ura.user_id=account.user_id AND ${operationalRoleScopeSql}
  JOIN ops.role role ON role.role_id=ura.role_id
  WHERE store.store_id=$1::uuid AND store.status='active' AND role.role_code IN ('REGION_MANAGER','STORE_MANAGER')`;

export async function operationalReportManagers(db:DatabaseService,userId?:string) {
  return (await db.query<OperationalReportManager>(`SELECT account.user_id::text,lower(account.email) AS email,
    array_agg(DISTINCT store.store_id::text ORDER BY store.store_id::text) AS store_ids,
    array_agg(DISTINCT store.company_id::text ORDER BY store.company_id::text) AS company_ids
    FROM ops.store store JOIN ops.company company ON company.company_id=store.company_id AND company.status='active'
    JOIN ops.user_action_store_assignment assigned ON assigned.store_id=store.store_id
      AND assigned.start_at<=clock_timestamp() AND (assigned.end_at IS NULL OR assigned.end_at>clock_timestamp())
    JOIN ops.user_account account ON account.user_id=assigned.user_id AND account.is_active
    JOIN ops.user_role_assignment ura ON ura.user_id=account.user_id AND ${operationalRoleScopeSql}
    JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='REGION_MANAGER'
    WHERE store.status='active' AND ($1::text IS NULL OR account.user_id::text=$1)
    GROUP BY account.user_id,account.email`,[userId ?? null])).rows;
}
