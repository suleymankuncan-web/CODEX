import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../shared/database/database.service";

export type PasswordMetadata = { state: "unknown" | "absent" | "present"; setAt: number | null };
export type SecurityObservation = { user_id: string; provider_subject: string; email: string; observation_id: string };
export type PasswordLink = { request_id: string; user_id: string; provider_subject: string; email: string;
  kind: "setup" | "reset"; state: string; requested_at: Date; send_started_at: Date | null;
  sent_at: Date | null; tracking_expires_at: Date | null; completed_observed_at: Date | null;
  verified_password_set_at: Date | null; error_code: string | null };

export async function enqueuePasswordLink(client: PoolClient, input: {
  userId: string; requestId: string; kind: "setup" | "reset"; actorUserId?: string; automatic?: boolean;
}) {
  const account = await client.query<{ provider_subject: string; email: string; is_active: boolean; auth_provider: string }>(
    "SELECT provider_subject,email,is_active,auth_provider FROM ops.user_account WHERE user_id=$1::uuid FOR UPDATE", [input.userId]);
  const user = account.rows[0];
  if (!user) throw new NotFoundException("User account not found");
  if (!user.is_active || user.auth_provider !== "oidc" || !user.provider_subject) {
    throw new ConflictException("An active mapped Keycloak account is required");
  }
  const existing = await client.query<PasswordLink>("SELECT * FROM ops.password_link_request WHERE request_id=$1::uuid", [input.requestId]);
  if (existing.rows[0]) {
    if (existing.rows[0].user_id !== input.userId || existing.rows[0].kind !== input.kind) throw new ConflictException("Request already used");
    return existing.rows[0];
  }
  if (!input.automatic) {
    const recent = await client.query("SELECT 1 FROM ops.password_link_request WHERE user_id=$1::uuid AND requested_at>NOW()-INTERVAL '1 minute' LIMIT 1", [input.userId]);
    if (recent.rowCount) throw new ConflictException("Wait one minute before requesting another link");
  }
  const job = await client.query<{ identity_lifecycle_job_id: string }>(`
    INSERT INTO ops.identity_lifecycle_job(user_id,operation,idempotency_key,requested_by_user_id)
    VALUES($1::uuid,'password_link',$2,$3) ON CONFLICT DO NOTHING RETURNING identity_lifecycle_job_id`,
  [input.userId, `password-link:${input.requestId}`, input.actorUserId ?? null]);
  if (!job.rows[0]) throw new ConflictException("A password link is already being processed");
  const result = await client.query<PasswordLink>(`
    INSERT INTO ops.password_link_request(request_id,user_id,job_id,provider_subject,email,kind)
    VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6) RETURNING *`,
  [input.requestId, input.userId, job.rows[0].identity_lifecycle_job_id, user.provider_subject, user.email, input.kind]);
  await client.query(`INSERT INTO audit.event_log(actor_user_id,event_type,entity_name,entity_id,scope_type,metadata_json)
    VALUES($1::uuid,'auth_password_link_requested','ops.user_account',$2::uuid,'company',jsonb_build_object('requestId',$3::text,'kind',$4::text))`,
  [input.actorUserId ?? null, input.userId, input.requestId, input.kind]);
  return result.rows[0];
}

@Injectable()
export class AccountSecurityRepository {
  constructor(private readonly database: DatabaseService) {}

  enqueue(input: Parameters<typeof enqueuePasswordLink>[1]) {
    return this.database.withTransaction(client => enqueuePasswordLink(client, input));
  }

  async read(userId: string) {
    const account = await this.database.query(`SELECT ua.last_login_at,ua.last_active_at,
      snapshot.password_state,snapshot.password_set_at,snapshot.observed_at
      FROM ops.user_account ua LEFT JOIN ops.account_security_snapshot snapshot
        ON snapshot.user_id=ua.user_id AND ua.auth_provider='oidc'
        AND snapshot.provider_subject=ua.provider_subject AND LOWER(snapshot.email)=LOWER(ua.email)
      WHERE ua.user_id=$1::uuid`, [userId]);
    if (!account.rows[0]) throw new NotFoundException("User account not found");
    const links = await this.database.query<PasswordLink>(`SELECT request_id,kind,state,requested_at,send_started_at,
      sent_at,tracking_expires_at,completed_observed_at,verified_password_set_at,error_code
      FROM ops.password_link_request WHERE user_id=$1::uuid ORDER BY request_sequence DESC LIMIT 20`, [userId]);
    return { account: account.rows[0], links: links.rows };
  }

  async getLink(jobId: string) {
    const result = await this.database.query<PasswordLink>("SELECT * FROM ops.password_link_request WHERE job_id=$1::uuid", [jobId]);
    return result.rows[0];
  }

  async beginSend(jobId: string, metadata: PasswordMetadata) {
    const result = await this.database.query<PasswordLink>(`UPDATE ops.password_link_request request
      SET state='sending',send_started_at=clock_timestamp(),tracking_expires_at=clock_timestamp()+INTERVAL '24 hours',
        baseline_state=$2,baseline_password_set_at=to_timestamp($3::double precision/1000)
      FROM ops.user_account account WHERE request.job_id=$1::uuid AND request.state='queued'
        AND account.user_id=request.user_id AND account.is_active AND account.auth_provider='oidc'
        AND account.provider_subject=request.provider_subject AND LOWER(account.email)=LOWER(request.email)
      RETURNING request.*`, [jobId, metadata.state, metadata.setAt]);
    return result.rows[0];
  }

  async outcome(jobId: string, state: "sent" | "failed" | "unconfirmed", errorCode: string | null) {
    await this.database.query(`UPDATE ops.password_link_request SET state=$2,
      sent_at=CASE WHEN $2='sent' THEN clock_timestamp() ELSE NULL END,error_code=$3
      WHERE job_id=$1::uuid AND state IN ('queued','sending')`, [jobId, state, errorCode]);
  }

  async claimObservations(): Promise<SecurityObservation[]> {
    return this.database.withTransaction(async client => {
      await client.query(`UPDATE ops.password_link_request SET state='unconfirmed',error_code='send_unconfirmed'
        WHERE state='sending' AND send_started_at<NOW()-INTERVAL '2 minutes'`);
      const result = await client.query<SecurityObservation>(`WITH candidate AS (
        SELECT account.user_id,account.provider_subject,account.email FROM ops.user_account account
        LEFT JOIN ops.account_security_snapshot snapshot ON snapshot.user_id=account.user_id
        WHERE account.is_active AND account.auth_provider='oidc' AND account.provider_subject IS NOT NULL
          AND (snapshot.lease_until IS NULL OR snapshot.lease_until<NOW())
          AND (snapshot.user_id IS NULL OR snapshot.provider_subject<>account.provider_subject OR snapshot.email<>account.email
            OR snapshot.next_observation_at<=NOW()
            OR (snapshot.observed_at<NOW()-INTERVAL '2 minutes' AND EXISTS(
              SELECT 1 FROM ops.password_link_request request WHERE request.user_id=account.user_id
                AND request.state IN ('queued','sending','sent','unconfirmed')
                AND (request.tracking_expires_at IS NULL OR request.tracking_expires_at>NOW()))))
        ORDER BY snapshot.next_observation_at NULLS FIRST,account.user_id FOR UPDATE OF account SKIP LOCKED LIMIT 5
      ) INSERT INTO ops.account_security_snapshot(user_id,provider_subject,email,observation_id,lease_until)
        SELECT user_id,provider_subject,email,gen_random_uuid(),NOW()+INTERVAL '2 minutes' FROM candidate
        ON CONFLICT(user_id) DO UPDATE SET observation_id=EXCLUDED.observation_id,lease_until=EXCLUDED.lease_until,
          provider_subject=EXCLUDED.provider_subject,email=EXCLUDED.email,
          password_state=CASE WHEN account_security_snapshot.provider_subject<>EXCLUDED.provider_subject
            OR account_security_snapshot.email<>EXCLUDED.email THEN 'unknown' ELSE account_security_snapshot.password_state END,
          password_set_at=CASE WHEN account_security_snapshot.provider_subject<>EXCLUDED.provider_subject
            OR account_security_snapshot.email<>EXCLUDED.email THEN NULL ELSE account_security_snapshot.password_set_at END,
          observed_at=CASE WHEN account_security_snapshot.provider_subject<>EXCLUDED.provider_subject
            OR account_security_snapshot.email<>EXCLUDED.email THEN NULL ELSE account_security_snapshot.observed_at END
        RETURNING user_id::text,provider_subject,email,observation_id::text`);
      return result.rows;
    });
  }

  async observe(claim: SecurityObservation, metadata: PasswordMetadata | null) {
    await this.database.withTransaction(async client => {
      const applied = await client.query(`UPDATE ops.account_security_snapshot snapshot SET provider_subject=$2,email=$3,
        password_state=COALESCE($5,'unknown'),
        password_set_at=CASE WHEN snapshot.provider_subject<>$2 OR snapshot.email<>$3 THEN to_timestamp($6::double precision/1000)
          ELSE GREATEST(snapshot.password_set_at,to_timestamp($6::double precision/1000)) END,
        observed_at=CASE WHEN $5 IS NULL THEN snapshot.observed_at ELSE clock_timestamp() END,lease_until=NULL,observation_id=NULL,
        next_observation_at=NOW()+CASE WHEN $5 IS NULL OR EXISTS(SELECT 1 FROM ops.password_link_request request
          WHERE request.user_id=snapshot.user_id AND request.state IN ('queued','sending','sent','unconfirmed')
            AND (request.tracking_expires_at IS NULL OR request.tracking_expires_at>NOW()))
          THEN INTERVAL '2 minutes' ELSE INTERVAL '1 hour' END
        FROM ops.user_account account WHERE snapshot.user_id=$1::uuid AND snapshot.observation_id=$4::uuid
          AND account.user_id=snapshot.user_id AND account.is_active AND account.auth_provider='oidc'
          AND account.provider_subject=$2 AND LOWER(account.email)=LOWER($3) RETURNING snapshot.user_id`,
      [claim.user_id, claim.provider_subject, claim.email, claim.observation_id, metadata?.state ?? null, metadata?.setAt ?? null]);
      if (!applied.rowCount || metadata?.state !== "present" || metadata.setAt === null) return;
      await client.query(`UPDATE ops.password_link_request SET state='completed',completed_observed_at=clock_timestamp(),
        verified_password_set_at=to_timestamp($4::double precision/1000),error_code=NULL
        WHERE user_id=$1::uuid AND provider_subject=$2 AND LOWER(email)=LOWER($3)
          AND state IN ('sent','unconfirmed') AND send_started_at<to_timestamp($4::double precision/1000)
          AND tracking_expires_at>=to_timestamp($4::double precision/1000)
          AND (baseline_state='absent' OR (baseline_state='present' AND baseline_password_set_at<to_timestamp($4::double precision/1000)))
          AND request_sequence=(SELECT MAX(request_sequence) FROM ops.password_link_request WHERE user_id=$1::uuid)`,
      [claim.user_id, claim.provider_subject, claim.email, metadata.setAt]);
    });
  }

  async activity(userId: string) {
    await this.database.query(`UPDATE ops.user_account SET last_active_at=clock_timestamp()
      WHERE user_id=$1::uuid AND is_active AND (last_active_at IS NULL OR last_active_at<NOW()-INTERVAL '2 minutes')`, [userId]);
  }
}
