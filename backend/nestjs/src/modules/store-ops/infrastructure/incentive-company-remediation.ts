import type { PoolClient } from "pg";
import { ForbiddenException } from "@nestjs/common";

export async function openCompanyRemediation(client: Pick<PoolClient, "query">, period: string, storeId: string, actorId: string) {
  const grant = await client.query(`SELECT assigned.user_id FROM ops.user_action_store_assignment assigned
    JOIN ops.user_account account ON account.user_id=assigned.user_id AND account.is_active
    JOIN ops.user_role_assignment ura ON ura.user_id=account.user_id
    JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='REGION_MANAGER'
    JOIN ops.store store ON store.store_id=assigned.store_id AND store.status='active'
    JOIN ops.company company ON company.company_id=store.company_id AND company.status='active'
    WHERE assigned.user_id=$1::uuid AND assigned.store_id=$2::uuid
      AND assigned.start_at<=clock_timestamp() AND (assigned.end_at IS NULL OR assigned.end_at>clock_timestamp())
      AND ura.start_at<=clock_timestamp() AND (ura.end_at IS NULL OR ura.end_at>clock_timestamp())
      AND ops.store_was_company_during(store.store_id,($3::text||'-01')::date,(($3::text||'-01')::date+INTERVAL '1 month - 1 day')::date)
    FOR SHARE OF assigned,account,ura,store,company`, [actorId,storeId,period]);
  if (!grant.rows.length) throw new ForbiddenException("Current assigned manager authority is required for preparation remediation");
  // Caller holds the store preparation lock. This is not a new company-wide RM round.
  await client.query(`WITH returned AS (
    SELECT p.sales_target_incentive_region_package_id AS package_id,d.actor_user_id,d.reason_note
    FROM ops.sales_target_incentive_region_package p
    JOIN ops.sales_target_incentive_region_package_store ps ON ps.region_package_id=p.sales_target_incentive_region_package_id
    JOIN ops.incentive_company_cycle c ON c.company_id=p.company_id AND c.period_key=p.period_key AND c.stage='preparation'
    JOIN ops.incentive_company_decision d ON d.cycle_id=c.cycle_id AND d.revision_no=c.current_revision AND d.decision='return'
    WHERE ps.store_id=$2::uuid AND p.period_key=$1 AND p.package_status='submitted'
      AND p.package_scope='manager_assignment'
      AND EXISTS (SELECT 1 FROM ops.user_action_store_assignment a
        JOIN ops.user_account account ON account.user_id=a.user_id AND account.is_active
        JOIN ops.user_role_assignment ura ON ura.user_id=account.user_id
        JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='REGION_MANAGER'
        WHERE a.store_id=ps.store_id AND a.user_id=$3::uuid AND a.start_at<=clock_timestamp()
          AND (a.end_at IS NULL OR a.end_at>clock_timestamp()) AND ura.start_at<=clock_timestamp()
          AND (ura.end_at IS NULL OR ura.end_at>clock_timestamp()))
    FOR UPDATE OF p
  ), opened AS (
    UPDATE ops.sales_target_incentive_region_package p SET package_status='admin_returned',
      reviewed_by_user_id=r.actor_user_id,reviewed_at=clock_timestamp(),review_note=r.reason_note,updated_at=clock_timestamp()
    FROM returned r WHERE p.sales_target_incentive_region_package_id=r.package_id RETURNING p.sales_target_incentive_region_package_id,r.actor_user_id,r.reason_note
  ) UPDATE ops.sales_target_incentive_region_correction correction SET correction_status='admin_returned',
    reviewed_by_user_id=o.actor_user_id,reviewed_at=clock_timestamp(),review_note=o.reason_note,updated_at=clock_timestamp()
    FROM opened o WHERE correction.region_package_id=o.sales_target_incentive_region_package_id AND correction.correction_status='submitted'`, [period, storeId, actorId]);
}
