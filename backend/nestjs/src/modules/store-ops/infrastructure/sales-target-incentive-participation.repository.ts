import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import { latestFinalSnapshotCte } from "./sales-target-incentive-approval.sql";
import { openCompanyRemediation } from "./incentive-company-remediation";

export type IncentiveParticipationExclusion = { employeeId: string; displayName: string; positionCode: string; reasonNote: string };
export type IncentiveParticipationRevision = {
  final_snapshot_id: string; revision_no: number; exclusions_json: IncentiveParticipationExclusion[];
};

@Injectable()
export class SalesTargetIncentiveParticipationRepository {
  constructor(private readonly database: DatabaseService) {}

  async setParticipation(input: {
    period: string; storeId: string; employeeId: string; included: boolean; reasonNote?: string;
    expectedRevision: number; expectedSnapshotId: string; actorUserId: string;
  }) {
    return this.database.withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`sales-target-incentive-store-review:${input.period}:${input.storeId}`]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`incentive-store-package:${input.period}:${input.storeId}`]);
      const grant = await client.query(`
        SELECT account.user_id FROM ops.user_account account
        JOIN ops.user_role_assignment role_assignment ON role_assignment.user_id = account.user_id
        JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
        JOIN ops.user_action_store_assignment assignment ON assignment.user_id = account.user_id
        JOIN ops.store store ON store.store_id = assignment.store_id AND store.status = 'active' AND store.store_type = 'company'
        JOIN ops.company company ON company.company_id = store.company_id AND company.status = 'active'
        WHERE account.user_id = $1::uuid AND account.is_active AND assignment.store_id = $2::uuid
          AND role_assignment.start_at <= clock_timestamp() AND (role_assignment.end_at IS NULL OR role_assignment.end_at > clock_timestamp())
          AND assignment.start_at <= clock_timestamp() AND (assignment.end_at IS NULL OR assignment.end_at > clock_timestamp())
          AND ops.store_was_company_during(store.store_id, ($3::text||'-01')::date,
            (($3::text||'-01')::date + INTERVAL '1 month - 1 day')::date)
        FOR SHARE OF account, role_assignment, assignment, store, company
      `, [input.actorUserId, input.storeId, input.period]);
      if (!grant.rows.length) throw new ForbiddenException("Assigned store permission is no longer active");
      await openCompanyRemediation(client, input.period, input.storeId, input.actorUserId);
      const locked = await client.query(`
        SELECT package.package_status FROM ops.sales_target_incentive_region_package package
        JOIN ops.sales_target_incentive_region_package_store package_store
          ON package_store.region_package_id = package.sales_target_incentive_region_package_id
        WHERE package_store.store_id = $1::uuid AND package.period_key = $2
          AND package.package_status IN ('submitted', 'admin_approved')
      `, [input.storeId, input.period]);
      if (locked.rows.length) throw new ConflictException("Submitted or approved packages are locked");
      const source = await client.query<{ final_snapshot_id: string; company_id: string }>(`
        ${latestFinalSnapshotCte}
        SELECT snapshot.sales_target_incentive_final_snapshot_id::text AS final_snapshot_id, snapshot.company_id::text
        FROM latest_final_snapshot latest JOIN rpt.sales_target_incentive_final_snapshot snapshot
          ON snapshot.sales_target_incentive_final_snapshot_id = latest.sales_target_incentive_final_snapshot_id
        JOIN ops.store store ON store.store_id = snapshot.store_id AND store.company_id = snapshot.company_id
      `, [input.period, [input.storeId]]);
      const snapshot = source.rows[0];
      if (!snapshot) throw new BadRequestException("Closed final snapshot is required");
      if (snapshot.final_snapshot_id !== input.expectedSnapshotId.toLowerCase()) throw new ConflictException("Closed source changed; refresh the workspace");
      const latest = await client.query<IncentiveParticipationRevision>(`
        SELECT final_snapshot_id::text, revision_no, exclusions_json
        FROM ops.sales_target_incentive_participation_revision
        WHERE store_id=$1::uuid AND period_key=$2 ORDER BY revision_no DESC LIMIT 1
      `, [input.storeId, input.period]);
      const previous = latest.rows[0];
      const currentRevision = previous?.final_snapshot_id === snapshot.final_snapshot_id ? previous.revision_no : 0;
      if (currentRevision !== input.expectedRevision) throw new ConflictException("Participation revision changed; refresh the workspace");
      const target = await client.query<{ employee_id: string; display_name: string; position_code: string }>(`
        SELECT employee.employee_id::text,
          COALESCE(NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''), employee.external_employee_ref, employee.employee_id::text) AS display_name,
          COALESCE(assignment.position_code, final_row.position_code) AS position_code
        FROM ops.employee employee
        LEFT JOIN LATERAL (
          SELECT position.position_code FROM ops.employee_assignment_history history
          JOIN ops.position position ON position.position_id=history.position_id
          WHERE history.employee_id=employee.employee_id AND history.store_id=$2::uuid AND history.is_primary_assignment
            AND history.start_date <= (($3::text||'-01')::date + INTERVAL '1 month - 1 day')::date
            AND (history.end_date IS NULL OR history.end_date >= (($3::text||'-01')::date + INTERVAL '1 month - 1 day')::date)
          ORDER BY history.start_date DESC, history.created_at DESC, history.assignment_id DESC LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN LATERAL (
          SELECT position_code FROM rpt.sales_target_incentive_final_row
          WHERE final_snapshot_id=$4::uuid AND employee_id=employee.employee_id LIMIT 1
        ) final_row ON TRUE
        WHERE employee.employee_id=$1::uuid AND (assignment.position_code IS NOT NULL OR final_row.position_code IS NOT NULL)
        FOR SHARE OF employee
      `, [input.employeeId, input.storeId, input.period, snapshot.final_snapshot_id]);
      const recorded = previous?.final_snapshot_id === snapshot.final_snapshot_id ? previous.exclusions_json.find((item) => item.employeeId === input.employeeId.toLowerCase()) : undefined;
      const person = target.rows[0] ?? (recorded ? { employee_id: recorded.employeeId, display_name: recorded.displayName, position_code: recorded.positionCode } : undefined);
      if (!person) throw new NotFoundException("Personnel are not part of this store period");
      const exclusions = previous?.final_snapshot_id === snapshot.final_snapshot_id ? previous.exclusions_json : [];
      const next = exclusions.filter((item) => item.employeeId !== person.employee_id);
      if (!input.included) next.push({ employeeId: person.employee_id, displayName: person.display_name, positionCode: person.position_code, reasonNote: input.reasonNote!.trim() });
      next.sort((left, right) => left.employeeId.localeCompare(right.employeeId));
      const revision = (previous?.revision_no ?? 0) + 1;
      if (revision > 2147483647) throw new ConflictException("Participation revision limit reached");
      const inserted = await client.query<{ participation_revision_id: string }>(`
        INSERT INTO ops.sales_target_incentive_participation_revision
          (company_id,store_id,period_key,final_snapshot_id,revision_no,exclusions_json,created_by_user_id)
        VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::uuid) RETURNING participation_revision_id
      `, [snapshot.company_id, input.storeId, input.period, snapshot.final_snapshot_id, revision, JSON.stringify(next), input.actorUserId]);
      await client.query(`INSERT INTO audit.event_log
        (actor_user_id,event_type,entity_name,entity_id,scope_type,company_id,store_id,metadata_json)
        VALUES ($1::uuid,'incentive_participation.changed','ops.sales_target_incentive_participation_revision',$2::uuid,'store',$3::uuid,$4::uuid,$5::jsonb)`,
      [input.actorUserId, inserted.rows[0].participation_revision_id, snapshot.company_id, input.storeId,
        JSON.stringify({ employeeId: person.employee_id, included: input.included, reasonNote: input.included ? null : input.reasonNote!.trim(), revision, finalSnapshotId: snapshot.final_snapshot_id, correlationId: RequestContextStore.getCorrelationId() })]);
      return { revision, finalSnapshotId: snapshot.final_snapshot_id, employeeId: person.employee_id, included: input.included };
    });
  }
}
