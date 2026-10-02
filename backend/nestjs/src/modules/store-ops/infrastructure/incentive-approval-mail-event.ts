import type { PoolClient } from "pg";

export type ApprovalMailStage = "region_manager" | "sales_director" | "hr" | "general_manager";
export type ApprovalMailEvent = {
  event_id: string; company_id: string; period_key: string; stage: ApprovalMailStage;
  actor_user_id: string; approver_name: string; company_name: string;
  package_id: string | null; cycle_id: string | null; revision_no: number | null; seal_hash: string | null;
};

/** Must run in the same transaction as the approved submission/decision. No money is copied. */
export async function enqueueApprovalMail(client: Pick<PoolClient, "query">, input: {
  key: string; companyId: string; period: string; stage: ApprovalMailStage; actorId: string;
  packageId?: string; cycleId?: string; revision?: number; sealHash?: string;
}) {
  await client.query(`INSERT INTO ops.incentive_approval_mail_event
    (event_key,company_id,period_key,stage,actor_user_id,approver_name,company_name,package_id,cycle_id,revision_no,seal_hash)
    SELECT $1,$2::uuid,$3,$4,account.user_id,
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ',account.first_name,account.last_name)),''),
        NULLIF(BTRIM(CONCAT_WS(' ',employee.first_name,employee.last_name)),''),'Kullanıcı'),
      company.company_name,$6::uuid,$7::uuid,$8,$9
    FROM ops.user_account account JOIN ops.company company ON company.company_id=$2::uuid
      LEFT JOIN ops.employee employee ON employee.employee_id=account.employee_id
    WHERE account.user_id=$5::uuid ON CONFLICT(event_key) DO NOTHING`,
  [input.key,input.companyId,input.period,input.stage,input.actorId,input.packageId ?? null,input.cycleId ?? null,input.revision ?? null,input.sealHash ?? null]);
}
