import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import { approveSubmittedCorrectionsSql } from "./sales-target-incentive-approval.sql";
import { companyPayloadSql, companyReadinessSql, companyResponsibilitySql, companyStoresSql } from "./incentive-company-seal.sql";

type Client = Pick<PoolClient, "query">;
export type CompanyStage = "sales_director" | "hr" | "general_manager";
export type CompanyCycleRow = { cycle_id: string; company_id: string; period_key: string; current_revision: number; stage: "preparation" | CompanyStage | "final" };
export type SealPayload = {
  contract: string; companyId: string; companyName: string; period: string; total: string;
  responsibility: Array<{ store_id: string; owners: string[] }>;
  packages: Array<{ sales_target_incentive_region_package_id: string; submitted_by_user_id: string; [key: string]: unknown }>;
  stores: Array<{ store_id: string; region_package_id: string; final_snapshot_id: string; [key: string]: unknown }>;
  rows: Array<{ store_id: string; employee_id: string; participant_type: string; [key: string]: unknown }>;
  roster: Array<Record<string, unknown>>; proposals: Array<Record<string, unknown>>;
};
type Revision = { revision_no: number; seal_hash: string; payload: SealPayload; sealed_at: string };

@Injectable()
export class IncentiveCompanyCycleRepository {
  constructor(private readonly database: DatabaseService) {}

  async read(companyId: string, period: string, actorId: string) {
    return this.database.withTransaction(async client => {
      await this.authorizeRead(client, actorId, companyId);
      const companyName = (await client.query<{ company_name: string }>("SELECT company_name FROM ops.company WHERE company_id=$1::uuid", [companyId])).rows[0].company_name;
      const cycle = (await client.query<CompanyCycleRow>("SELECT * FROM ops.incentive_company_cycle WHERE company_id=$1::uuid AND period_key=$2", [companyId, period])).rows[0];
      if (!cycle) return { companyId, companyName, period, cycle: null, revisions: [], decisions: [] };
      const revisions = (await client.query<Revision>("SELECT revision_no,seal_hash,payload,sealed_at::text FROM ops.incentive_company_revision WHERE cycle_id=$1::uuid ORDER BY revision_no", [cycle.cycle_id])).rows;
      const decisions = (await client.query("SELECT decision_id::text,revision_no,seal_hash,stage,decision,actor_user_id::text,reason_note,decided_at::text FROM ops.incentive_company_decision WHERE cycle_id=$1::uuid ORDER BY revision_no,decided_at", [cycle.cycle_id])).rows;
      return { companyId, companyName: revisions.find(r=>r.revision_no===cycle.current_revision)?.payload.companyName ?? companyName, period, cycle, revisions, decisions };
    });
  }

  async seal(input: { companyId: string; period: string; actorId: string; expectedRevision: number }) {
    return this.database.withTransaction(async client => {
      await lock(client, `incentive-company-cycle:${input.companyId}:${input.period}`);
      await client.query(`INSERT INTO ops.incentive_company_cycle(company_id,period_key) VALUES($1::uuid,$2)
        ON CONFLICT(company_id,period_key) DO NOTHING`, [input.companyId, input.period]);
      const cycle = (await client.query<CompanyCycleRow>("SELECT * FROM ops.incentive_company_cycle WHERE company_id=$1::uuid AND period_key=$2 FOR UPDATE", [input.companyId, input.period])).rows[0];
      if (cycle.stage !== "preparation" || cycle.current_revision !== input.expectedRevision) throw new ConflictException("Company preparation changed; refresh before sealing");
      const prepared = await this.preparePayload(client, input.companyId, input.period);
      const payload = prepared.payload;
      await this.authorize(client, input.actorId, input.companyId, "sales_director");
      if (payload.packages.some(p => p.submitted_by_user_id === input.actorId)) throw new ForbiddenException("Submitter cannot seal own company submission");
      const revision = cycle.current_revision + 1;
      const hash = prepared.seal_hash;
      await client.query(`INSERT INTO ops.incentive_company_revision(cycle_id,revision_no,seal_hash,payload,sealed_by_user_id)
        VALUES($1::uuid,$2,$3,$4::jsonb,$5::uuid)`, [cycle.cycle_id, revision, hash, prepared.payload_text, input.actorId]);
      await client.query("UPDATE ops.incentive_company_cycle SET current_revision=$2,stage='sales_director' WHERE cycle_id=$1::uuid", [cycle.cycle_id, revision]);
      return { cycleId: cycle.cycle_id, companyId: input.companyId, period: input.period, revision, stage: "sales_director", sealHash: hash, total: payload.total };
    });
  }

  async decide(input: { companyId: string; period: string; cycleId: string; revision: number; stage: CompanyStage; sealHash: string; actorId: string; decision: "approve" | "return"; reasonNote?: string }) {
    return this.database.withTransaction(async client => {
      await lock(client, `incentive-company-cycle:${input.companyId}:${input.period}`);
      const cycle = (await client.query<CompanyCycleRow>(`SELECT * FROM ops.incentive_company_cycle
        WHERE cycle_id=$1::uuid AND company_id=$2::uuid AND period_key=$3 FOR UPDATE`, [input.cycleId, input.companyId, input.period])).rows[0];
      if (!cycle || cycle.current_revision !== input.revision || cycle.stage !== input.stage) throw new ConflictException("Company revision or stage changed");
      const revision = (await client.query<Revision>("SELECT * FROM ops.incentive_company_revision WHERE cycle_id=$1::uuid AND revision_no=$2 AND seal_hash=$3", [input.cycleId, input.revision, input.sealHash])).rows[0];
      if (!revision) throw new ConflictException("The confirmed company seal changed");
      const packageIds = revision.payload.packages.map(p => p.sales_target_incentive_region_package_id);
      if (input.decision === "approve") {
        const live = await this.preparePayload(client, input.companyId, input.period);
        if (live.seal_hash !== input.sealHash) throw new ConflictException("Sealed source content changed; return and reseal");
      } else {
        // A stale source must still be returnable. Only the archived revision is decided.
        for (const store of revision.payload.stores) await lock(client, `incentive-store-package:${input.period}:${store.store_id}`);
        await client.query("SELECT sales_target_incentive_region_package_id FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=ANY($1::uuid[]) ORDER BY sales_target_incentive_region_package_id FOR UPDATE", [packageIds]);
      }
      await this.authorize(client, input.actorId, input.companyId, input.stage);
      if (revision.payload.packages.some(p => p.submitted_by_user_id === input.actorId)) throw new ForbiddenException("Submitter cannot approve own company submission");
      if (input.decision === "return" && !input.reasonNote?.trim()) throw new ConflictException("Return reason is required");
      await client.query(`INSERT INTO ops.incentive_company_decision(cycle_id,revision_no,seal_hash,stage,decision,actor_user_id,reason_note)
        VALUES($1::uuid,$2,$3,$4,$5,$6::uuid,$7)`, [input.cycleId, input.revision, input.sealHash, input.stage, input.decision, input.actorId, input.reasonNote?.trim() ?? null]);
      if (input.decision === "return") {
        // Submissions remain usable until their current owner actually remediates them.
        // The archived revision and decisions are independent of mutable preparation.
      } else if (input.stage === "general_manager") {
        // Raw baseline arithmetic is unchanged. DB guard binds each application to this exact seal/proposal.
        const applySql = approveSubmittedCorrectionsSql.replace("'source', 'region_manager_approval_package',", "'source', 'region_manager_approval_package', 'companySealHash', $4::text,");
        for (const packageId of packageIds) await client.query(applySql, [packageId, input.actorId, RequestContextStore.getCorrelationId(), input.sealHash]);
        await client.query(`UPDATE ops.sales_target_incentive_region_package SET package_status='admin_approved',reviewed_by_user_id=$2::uuid,
          reviewed_at=clock_timestamp(),review_note=NULL,updated_at=clock_timestamp() WHERE sales_target_incentive_region_package_id=ANY($1::uuid[]) AND package_status='submitted'`, [packageIds, input.actorId]);
      }
      const next = input.decision === "return" ? "preparation" : input.stage === "sales_director" ? "hr" : input.stage === "hr" ? "general_manager" : "final";
      await client.query("UPDATE ops.incentive_company_cycle SET stage=$2 WHERE cycle_id=$1::uuid", [input.cycleId, next]);
      return { cycleId: input.cycleId, companyId: input.companyId, period: input.period, revision: input.revision, stage: next, sealHash: input.sealHash, total: revision.payload.total };
    });
  }

  private async preparePayload(client: Client, companyId: string, period: string): Promise<{ payload: SealPayload; seal_hash: string; payload_text: string }> {
    await lock(client, `sales_target_incentive_ownership:${companyId}`);
    const ids = (await client.query<{ store_id: string }>(companyStoresSql, [companyId, period])).rows.map(s => s.store_id);
    if (!ids.length) throw new ConflictException("Company preparation has no owned stores");
    for (const id of ids) {
      await lock(client, `sales-target-incentive-store-review:${period}:${id}`);
      await lock(client, `incentive-store-package:${period}:${id}`);
    }
    await client.query(`SELECT account.user_id FROM ops.user_account account WHERE EXISTS (
      SELECT 1 FROM ops.user_action_store_assignment assigned WHERE assigned.user_id=account.user_id AND assigned.store_id=ANY($1::uuid[])
    ) ORDER BY account.user_id FOR SHARE`, [ids]);
    await client.query(`SELECT ura.user_role_assignment_id FROM ops.user_role_assignment ura WHERE EXISTS (
      SELECT 1 FROM ops.user_action_store_assignment assigned WHERE assigned.user_id=ura.user_id AND assigned.store_id=ANY($1::uuid[])
    ) ORDER BY ura.user_role_assignment_id FOR SHARE`, [ids]);
    await client.query(`SELECT e.employee_id FROM ops.employee e WHERE EXISTS (
      SELECT 1 FROM ops.employee_assignment_history h WHERE h.employee_id=e.employee_id AND h.store_id=ANY($1::uuid[])
    ) OR EXISTS (SELECT 1 FROM rpt.sales_target_incentive_final_row row JOIN rpt.sales_target_incentive_final_snapshot s
      ON s.sales_target_incentive_final_snapshot_id=row.final_snapshot_id WHERE row.employee_id=e.employee_id
        AND s.store_id=ANY($1::uuid[]) AND s.period_key=$2) ORDER BY e.employee_id FOR SHARE`, [ids,period]);
    await client.query("SELECT assignment_id FROM ops.employee_assignment_history WHERE store_id=ANY($1::uuid[]) ORDER BY assignment_id FOR SHARE", [ids]);
    await client.query("SELECT target_distribution_request_id FROM ops.target_distribution_request WHERE store_id=ANY($1::uuid[]) AND request_month=($2::text||'-01')::date ORDER BY target_distribution_request_id FOR SHARE", [ids,period]);
    await client.query("SELECT personnel_target_reference_id FROM ops.personnel_target_reference WHERE store_id=ANY($1::uuid[]) AND period_start=($2::text||'-01')::date ORDER BY personnel_target_reference_id FOR SHARE", [ids,period]);
    // Lock FK parents after current data owners, so assignment writers can finish
    // before we freeze membership instead of deadlocking on their FK key-share checks.
    await client.query("SELECT store_id FROM ops.store WHERE company_id=$1::uuid ORDER BY store_id FOR UPDATE", [companyId]);
    const currentStores = (await client.query<{ store_id: string }>(companyStoresSql, [companyId,period])).rows.map(s=>s.store_id);
    if (JSON.stringify(currentStores)!==JSON.stringify(ids)) throw new ConflictException("Company store scope changed while waiting");
    const responsibilities = (await client.query<{ store_id: string; owners: string[] | null }>(companyResponsibilitySql, [companyId, period])).rows;
    if (responsibilities.length !== ids.length || responsibilities.some((s, i) => s.store_id !== ids[i] || s.owners?.length !== 1)) throw new ConflictException("All company stores require one current responsible manager");
    const ready = (await client.query<{ store_id: string; package_id: string; owner_id: string; package_status: string; package_company_id: string; package_period: string; package_scope: string; ready: boolean }>(companyReadinessSql, [companyId, period, ids])).rows;
    if (ready.length !== ids.length || ready.some((s, i) => s.store_id !== ids[i] || !s.ready || s.package_status !== "submitted" ||
      s.package_company_id !== companyId || s.package_period !== period || s.package_scope !== "manager_assignment" || s.owner_id !== responsibilities[i].owners![0])) throw new ConflictException("Every current manager store must be closed, reviewed and submitted");
    const packages = [...new Set(ready.map(s => s.package_id))].sort();
    await client.query("SELECT sales_target_incentive_region_package_id FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=ANY($1::uuid[]) ORDER BY sales_target_incentive_region_package_id FOR UPDATE", [packages]);
    const copied = (await client.query<{ store_id: string }>("SELECT store_id::text FROM ops.sales_target_incentive_region_package_store WHERE region_package_id=ANY($1::uuid[]) ORDER BY store_id", [packages])).rows;
    const competing = (await client.query("SELECT sales_target_incentive_region_package_id FROM ops.sales_target_incentive_region_package WHERE company_id=$1::uuid AND period_key=$2 AND package_status IN ('submitted','admin_approved') AND NOT(sales_target_incentive_region_package_id=ANY($3::uuid[]))", [companyId, period, packages])).rows;
    if (competing.length || copied.length !== ids.length || copied.some((s, i) => s.store_id !== ids[i])) throw new ConflictException("Company preparation contains competing or incomplete submissions");
    const targets = (await client.query<{ store_id: string; employee_id: string; participant_type: string }>(`SELECT ps.store_id::text,row.employee_id::text,row.participant_type
      FROM ops.sales_target_incentive_region_package_store ps JOIN rpt.sales_target_incentive_final_row row ON row.final_snapshot_id=ps.final_snapshot_id
      WHERE ps.region_package_id=ANY($1::uuid[]) ORDER BY ps.store_id,row.employee_id,row.participant_type`, [packages])).rows;
    for (const target of targets) await lock(client, ["sales_target_incentive_adjustment", period, target.store_id, target.employee_id, target.participant_type, "final_snapshot"].join(":"));
    // Readiness is read again after package/money waits; never authorize a pre-wait snapshot.
    const refreshed = (await client.query(companyReadinessSql, [companyId, period, ids])).rows;
    if (JSON.stringify(refreshed) !== JSON.stringify(ready)) throw new ConflictException("Company sources changed during preparation");
    const currentOwners = (await client.query(companyResponsibilitySql, [companyId, period])).rows;
    if (JSON.stringify(currentOwners) !== JSON.stringify(responsibilities)) throw new ConflictException("Live responsibility changed while waiting");
    // Hash before JSON crosses the JS decimal boundary. The exact text is also persisted without reparsing.
    const sealed = (await client.query<{ payload: SealPayload; seal_hash: string; payload_text: string }>(`SELECT payload,payload::text AS payload_text,
      encode(digest(payload::text,'sha256'),'hex') AS seal_hash FROM (${companyPayloadSql}) archived`, [companyId, period, packages, JSON.stringify(responsibilities)])).rows[0];
    const payload = sealed.payload;
    const proposalCount = (await client.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_region_correction WHERE region_package_id=ANY($1::uuid[]) AND correction_status='submitted'", [packages])).rows[0].count;
    if (payload.proposals.length !== proposalCount || payload.proposals.some(p => p.company_id !== companyId || p.period_key !== period ||
      !payload.rows.some(row => row.sales_target_incentive_final_row_id === p.final_row_id && row.store_id === p.store_id && row.employee_id === p.employee_id && row.participant_type === p.participant_type))) throw new ConflictException("Submitted proposals do not exactly match their company source targets");
    return sealed;
  }

  private async authorize(client: Client, actorId: string, companyId: string, stage: CompanyStage) {
    await this.lockAuthority(client, actorId, companyId);
    const result = await client.query<{ allowed: boolean }>("SELECT ops.incentive_stage_authorized($1::uuid,$2::uuid,$3) AS allowed", [actorId, companyId, stage]);
    if (!result.rows[0]?.allowed) throw new ForbiddenException("Live matching company stage capability is required");
  }

  private async authorizeRead(client: Client, actorId: string, companyId: string) {
    await this.lockAuthority(client, actorId, companyId);
    const result = await client.query<{ allowed: boolean }>(`SELECT ops.incentive_stage_authorized($1::uuid,$2::uuid,'sales_director')
      OR ops.incentive_stage_authorized($1::uuid,$2::uuid,'hr') OR ops.incentive_stage_authorized($1::uuid,$2::uuid,'general_manager')
      OR ops.incentive_stage_authorized($1::uuid,$2::uuid,'payroll') AS allowed`, [actorId, companyId]);
    if (!result.rows[0]?.allowed) throw new ForbiddenException("Company incentive capability is required");
  }

  private async lockAuthority(client: Client, actorId: string, companyId: string) {
    await client.query("SELECT user_id FROM ops.user_account WHERE user_id=$1::uuid FOR SHARE", [actorId]);
    await client.query("SELECT company_id FROM ops.company WHERE company_id=$1::uuid FOR SHARE", [companyId]);
    await client.query("SELECT user_role_assignment_id FROM ops.user_role_assignment WHERE user_id=$1::uuid AND company_id=$2::uuid ORDER BY user_role_assignment_id FOR SHARE", [actorId, companyId]);
    await client.query("SELECT user_permission_assignment_id FROM ops.user_permission_assignment WHERE user_id=$1::uuid AND company_id=$2::uuid ORDER BY user_permission_assignment_id FOR SHARE", [actorId, companyId]);
  }
}

async function lock(client: Client, key: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [key]);
}
